"""Contribution-limits answer key: 401(k), IRAs, the Roth IRA income limit, HSAs, the health FSA, the tax that HSA money
taken through payroll saves, the IRA / HSA deadline and 529 gifts. One CSV of invented households.

Run:  python3 tools/golden_limits/limits_key.py [out_dir] [--mutate NAME] [--skip-examples]
Writes tests/golden/limits/households.csv (3,000 rows). Standard library only, exact arithmetic (fractions.Fraction and
integers), deterministic (random.Random(20261031)). The figures and the model come from rules.py next to this file;
the sources and the reasons are in tests/golden/limits/RULES.md and in README.md here. Nothing under modules/, core/
or tests/*.test.mjs was opened, and the app is never imported.

Model (the brief, made exact by rules.py; where the law says otherwise the main columns follow the law, RULES.md
section 12, and a contrast column keeps the page's simplification only where the brief asks for one):
  * 401(k): 402(g) limit + 414(v) catch-up by the age reached on December 31 (50+, the higher amount at 60-63);
    pre-tax and Roth share one limit. Contrast: the 415(c) annual additions (deferrals without catch-up + match).
  * IRA: one limit for traditional and Roth, catch-up from 50. Roth income limit: MAGI (AGI with the traditional IRA
    deduction added back), the year's range by filing status (separate and together 0-10,000; separate and apart
    all year = single), reduction = limit x (MAGI - start) / width rounded down to $10, a result between $0 and $200
    raised to $200; allowed = min(reduced limit, limit with catch-up - traditional). Traditional IRA deducted in full
    (the page), contrast: the real 219(g) deduction.
  * HSA: self-only / family limit + $1,000 catch-up at 55 into the person's own HSA; spouses with family cover share
    one family limit; employer money counts. Per person: the most that person could have given the other spouse's
    actual money. Household: the limit, the total, room and over; the least money that must come out.
  * Tax saved by the HSA payroll money: federal income tax without minus with it, Social Security only below the
    wage base, Medicare, the 0.9% additional Medicare tax. Contrast: the page's flat 7.65%.
  * Health FSA (A's employer): limit, carryover maximum, over, unspent, forfeit, the FSA + HSA warning.
  * Deadline: April 15 of the next year moved past weekends and D.C. holidays. 529: exclusion and 5 x exclusion.
  * 2027: only the HSA outputs and the deadline (Rev. Proc. 2026-24); the rest was not published by 2026-10-31.

Two derivations of every value, run on every row (kept or redrawn) before anything is written:
  derivation 1  rules.py: work_household (every rule), hsa_positions (the per-person excess), roth_range, ira_limit and
                phase_out(method='worksheet') (the Pub. 590-A Worksheet 2-2 side column). The only glue here is the
                box-1 wages column, tied back to rules.py's MAGI on every row.
  derivation 2  this file, written separately in integers of half a cent (200 to the dollar) and basis points: the
                age from the first four characters of the birth date; the catch-up from an age table; the HSA limit as
                the brief's own min(...) formula clamped at the catch-up, and the excess by "equal halves, then the
                unused half goes to the other spouse"; the phase-out as one integer floor division; the worksheet with
                an integer three-place ratio; the traditional-IRA range from a lookup table keyed by (return kind,
                in a plan, spouse in a plan); the income tax from the printed "$X plus N% of the excess over" bases
                of the Rev. Procs (rules.py adds the bracket slices instead) with the bracket found by bisection; the
                payroll taxes in basis points; the deadline from a day-by-day D.C. holiday test written from the
                D.C. Code text (rules.py builds a holiday set).
The script refuses to write the CSV if an amount differs by more than a cent, or any other value (age, status, flag,
date) differs at all, between the two. --mutate NAME puts one deliberate mistake into derivation 2 (see MUTATIONS)
to show the guard refuses; --skip-examples turns off the RULES.md examples check so the row guard has to find it.
"""
import sys
sys.dont_write_bytecode = True  # before importing rules.py, so no __pycache__ lands in the repo

import csv
import datetime as dt
import random
import time
from bisect import bisect_left
from collections import Counter
from decimal import Decimal as D
from fractions import Fraction as F
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import rules as R  # noqa: E402  (importing it runs rules.check_tables())

ROOT = HERE.parents[1]
OUT_DIR = ROOT / 'tests' / 'golden' / 'limits'
CSV_NAME = 'households.csv'
SEED = 20261031
N_ROWS = 3000
N_2027 = 100                     # rows of the one later year with published figures (HSA limits only)
YEARS = (2025, 2026)             # every rule
HSA_ONLY_YEARS = tuple(y for y in sorted(R.HSA_LIMIT) if y not in R.ELECTIVE_DEFERRAL)
assert YEARS == tuple(sorted(R.ELECTIVE_DEFERRAL)) == tuple(sorted(R.BRACKETS)) == tuple(sorted(R.FSA_LIMIT))
assert YEARS == tuple(sorted(R.GIFT_EXCLUSION)) == tuple(sorted(R.IRA_LIMIT)) and HSA_ONLY_YEARS == (2027,)
ZERO, CENT = F(0), F(1, 100)
STEP_MARGIN = F(1, 10 ** 6)      # random rows: an exact phase-out reduction within $0.000001 of a $10 step -> redrawn
MARRIED = ('married_joint', 'married_separate')
ABBR = {'single': 'sgl', 'married_joint': 'mfj', 'married_separate': 'mfs', 'head_of_household': 'hoh'}
FIELDS = ('pay', 'k401', 'roth401k', 'k401_match', 'trad_ira', 'roth_ira', 'hsa_payroll', 'hsa_employer')
EDGE_AGES = (49, 50, 54, 55, 59, 60, 63, 64)

MUTATIONS = {
    'roth_round_nearest': 'Roth reduction rounded to the nearest $10 instead of down',
    'roth_no_floor': 'no $200 floor in the phase-out',
    'roth_start_ok': "exactly the start of the joint or single range labelled 'ok' (Pub. 590-A Table 2-1 says reduced)",
    'roth_zero_partial': "MAGI exactly 0 on the separate-and-together range labelled 'partial' (Table 2-1 says up to the limit)",
    'mfs_single_range': 'married filing separately and living together uses the single range',
    'age_on_today': "age on the row's 'today' instead of on December 31",
    'catch_up_60_63_missing': 'the 60-63 catch-up treated as the ordinary catch-up',
    'ira_catch_up_1000': 'the IRA catch-up kept at $1,000 (not indexed)',
    'roth401k_own_limit': 'Roth 401(k) money not counted against the 402(g) limit',
    'hsa_catch_up_pooled': "one spouse may use the other spouse's HSA catch-up",
    'ss_no_wage_base': 'Social Security saved on all the HSA money, wage base ignored',
    'addl_medicare_per_person': 'additional Medicare threshold applied per person on a joint return',
    'fsa_not_excluded': 'the FSA salary reduction left in wages',
    'excess_deferral_not_income': 'a pre-tax 401(k) deferral over the limit kept out of income',
    'trad_spouse_rule_off': 'a non-participant whose spouse is in a plan uses the participant range',
    'deadline_no_emancipation_day': 'D.C. Emancipation Day left out of the holidays',
}
MUT = None


# ======================================== small helpers ========================================

def fr(x):
    """str / int / Decimal / Fraction -> exact Fraction (never float)."""
    if isinstance(x, float):
        raise TypeError('no floats')
    if isinstance(x, F):
        return x
    if isinstance(x, int):
        return F(x)
    return F(D(str(x)))


def to_cents(x):
    """Exact value -> integer cents, halves away from zero (half up for the non-negative values here)."""
    x = fr(x)
    n = abs(x) * 100
    k = (2 * n.numerator + n.denominator) // (2 * n.denominator)
    return k if x >= 0 else -k


def money(x):
    """Dollars with two decimals, half up; '' for None."""
    if x is None:
        return ''
    c = to_cents(x)
    sign = '-' if c < 0 else ''
    c = abs(c)
    return f'{sign}{c // 100}.{c % 100:02d}'


def half_cent(x):
    return x is not None and not isinstance(x, (str, dt.date)) and (fr(x) * 100).denominator == 2


def leap(y):
    return y % 4 == 0 and (y % 100 != 0 or y % 400 == 0)


def pick(rng, pairs):
    total = sum(w for _, w in pairs)
    r = rng.randrange(total)
    for v, w in pairs:
        if r < w:
            return v
        r -= w
    raise AssertionError


def rand_date(rng, year, lo=None, hi=None):
    lo = lo or dt.date(year, 1, 1)
    hi = hi or dt.date(year, 12, 31)
    return (lo + dt.timedelta(days=rng.randrange((hi - lo).days + 1))).isoformat()


def birth_on(rng, year, age, kind='random'):
    """A birth date that makes the person reach `age` in `year` (the age on December 31)."""
    by = year - age
    if kind == 'jan1':
        return f'{by}-01-01'
    if kind == 'dec31':
        return f'{by}-12-31'
    if kind == 'feb29':
        assert leap(by), by
        return f'{by}-02-29'
    return rand_date(rng, by)


def today_before_birthday(rng, year, birth):
    """A 'today' in `year` before this year's birthday, so the age today is one less than on December 31 (the
    birthday itself when it is January 1). A February 29 birthday in a common year is taken as March 1 here."""
    m, d = int(birth[5:7]), int(birth[8:10])
    bday = dt.date(year, 3, 1) if (m, d) == (2, 29) and not leap(year) else dt.date(year, m, d)
    if bday == dt.date(year, 1, 1):
        return bday.isoformat()
    return rand_date(rng, year, hi=bday - dt.timedelta(days=1))


def amount(rng, lo, hi, cents=0.15):
    """A whole-dollar amount in [lo, hi], or with cents in a share of draws."""
    if rng.random() < cents:
        return F(rng.randint(int(lo * 100), int(hi * 100)), 100)
    return F(rng.randint(int(lo), int(hi)))


def person(birth, pay=0, k401=0, roth401k=0, match=0, trad=0, roth=0, hsa_p=0, hsa_e=0):
    return {'birth': birth, 'pay': fr(pay), 'k401': fr(k401), 'roth401k': fr(roth401k), 'k401_match': fr(match),
            'trad_ira': fr(trad), 'roth_ira': fr(roth), 'hsa_payroll': fr(hsa_p), 'hsa_employer': fr(hsa_e)}


def case(year, fs, a, b=None, apart=0, coverage='none', other=0, fsa_e=0, fsa_s=0, today=None, note=''):
    assert today is not None
    return {'year': year, 'today': today, 'filing_status': fs, 'lived_apart': apart, 'coverage': coverage,
            'other_income': fr(other), 'fsa_election': fr(fsa_e), 'fsa_spent': fr(fsa_s), 'A': a, 'B': b,
            'note': note}


def people(c):
    return ('A', 'B') if c['B'] is not None else ('A',)


def validate(c):
    """Every invented household must be a possible one under the brief."""
    y, fs = c['year'], c['filing_status']
    assert fs in ABBR and c['coverage'] in R.COVERAGES
    assert (c['B'] is not None) == (fs in MARRIED), c
    assert c['lived_apart'] in (0, 1) and (c['lived_apart'] == 0 or fs in MARRIED)
    assert dt.date.fromisoformat(c['today']).year == y
    assert c['other_income'] >= 0 and c['fsa_spent'] >= 0 and c['fsa_spent'] <= c['fsa_election']
    for p in people(c):
        h = c[p]
        age = y - dt.date.fromisoformat(h['birth']).year
        assert 22 <= age <= 64, (c, age)
        assert all(h[k] >= 0 for k in FIELDS)
        from_pay = h['k401'] + h['roth401k'] + h['hsa_payroll'] + (c['fsa_election'] if p == 'A' else 0)
        assert from_pay <= h['pay'], ('payroll money above pay', c)
        assert (h['k401'] + h['roth401k']) > 0 or h['k401_match'] == 0   # a match needs a deferral
    if y not in R.ELECTIVE_DEFERRAL:   # 2027: HSA rows only
        assert c['fsa_election'] == 0
        for p in people(c):
            assert all(c[p][k] == 0 for k in ('k401', 'roth401k', 'k401_match', 'trad_ira', 'roth_ira'))


# ===================================== the CSV columns ======================================

INPUT_COLS = ['year', 'today', 'filing_status', 'lived_apart', 'coverage', 'other_income', 'fsa_election',
              'fsa_spent'] + [f'{p}_{k}' for p in 'ab' for k in ('birth',) + FIELDS]
OUT_ADULT = ('age', 'k401_limit', 'k401_catch_up', 'k401_used', 'k401_room', 'k401_over', 'k401_in_income',
             'ira_limit', 'ira_catch_up', 'ira_used', 'ira_room', 'ira_over', 'ira_compensation', 'ira_comp_ok',
             'wages', 'magi', 'agi', 'trad_ira_page_deduction',
             'roth_status', 'roth_reduced_limit', 'roth_allowed', 'roth_over',
             'hsa_eligible', 'hsa_limit', 'hsa_used', 'hsa_room', 'hsa_over', 'hsa_excess')
OUT_HOUSEHOLD = ('magi', 'agi', 'hsa_limit_household', 'hsa_total', 'hsa_room_household', 'hsa_over_household',
                 'hsa_excess_to_remove', 'income_tax_with', 'income_tax_without', 'income_tax_saved', 'fica_saved_ss',
                 'fica_saved_medicare', 'fica_saved', 'addl_medicare_saved', 'fsa_limit', 'fsa_carryover', 'fsa_over',
                 'fsa_unspent', 'fsa_forfeit', 'fsa_with_hsa', 'ira_hsa_deadline', 'gift_exclusion',
                 'qtp_five_year_max')
CONTRAST_ADULT = ('trad_ira_deductible', 'agi_real_deduction', 'annual_additions', 'limit_415c', 'over_415c',
                  'exceeds_415c', 'active_participant', 'roth_allowed_worksheet')
CONTRAST_HOUSEHOLD = ('agi_real_deduction', 'fica_saved_flat')
OUTPUT_COLS = ([f'a_{k}' for k in OUT_ADULT] + [f'b_{k}' for k in OUT_ADULT] + list(OUT_HOUSEHOLD)
               + [f'a_{k}' for k in CONTRAST_ADULT] + [f'b_{k}' for k in CONTRAST_ADULT] + list(CONTRAST_HOUSEHOLD))
COLUMNS = ['case_id'] + INPUT_COLS + OUTPUT_COLS + ['note']
assert len(set(COLUMNS)) == len(COLUMNS)
NOT_MONEY = {'age', 'ira_comp_ok', 'roth_status', 'hsa_eligible', 'exceeds_415c', 'active_participant',
             'fsa_with_hsa', 'ira_hsa_deadline'}


def is_money(col):
    base = col[2:] if col[:2] in ('a_', 'b_') else col
    return base not in NOT_MONEY


MONEY_COLS = [k for k in OUTPUT_COLS if is_money(k)]
EXACT_COLS = [k for k in OUTPUT_COLS if not is_money(k)]


# ================================ derivation 1: rules.py ================================

def to_rules_case(c):
    return {'year': c['year'], 'today': c['today'], 'filing_status': c['filing_status'],
            'lived_apart': c['lived_apart'], 'coverage': c['coverage'], 'other_income': c['other_income'],
            'fsa_election': c['fsa_election'], 'fsa_spent': c['fsa_spent'],
            'adults': {p: dict({'birth_date': c[p]['birth']}, **{k: c[p][k] for k in FIELDS}) for p in people(c)}}


def returns_of(fs):
    """(status, members) of each return in the household."""
    if fs == 'married_joint':
        return [('married_joint', ('A', 'B'))]
    if fs == 'married_separate':
        return [('married_separate', ('A',)), ('married_separate', ('B',))]
    return [(fs, ('A',))]


def work1(c):
    y, fs = c['year'], c['filing_status']
    ppl = people(c)
    married = fs in MARRIED
    apart = fs == 'married_separate' and c['lived_apart'] == 1
    o = R.work_household(to_rules_case(c))
    published = y in R.ELECTIVE_DEFERRAL
    d = {k: None for k in OUTPUT_COLS}
    for p in ppl:
        pre = p.lower() + '_'
        for k in OUT_ADULT + CONTRAST_ADULT:
            if f'{p}_{k}' in o:
                d[pre + k] = o[f'{p}_{k}']
    for k in OUT_HOUSEHOLD + CONTRAST_HOUSEHOLD:
        if k in o:
            d[k] = o[k]
    d['ira_hsa_deadline'] = o['ira_hsa_deadline'].isoformat()
    # the per-person HSA excess at the least-over division (rules.hsa_positions; work_household reports the sum)
    ages = {p: o[p + '_age'] for p in ppl}
    uses = {p: c[p]['hsa_payroll'] + c[p]['hsa_employer'] for p in ppl}
    per, hh = R.hsa_positions(y, c['coverage'], ages, uses, married)
    assert hh['excess'] == o['hsa_excess_to_remove']
    for p in ppl:
        d[p.lower() + '_hsa_excess'] = per[p]['excess']
    if not published:
        return d
    # box-1 wages: the same terms rules.work_household adds up, tied back to its MAGI just below
    excl = min(c['fsa_election'], F(R.FSA_LIMIT[y]))
    for p in ppl:
        h = c[p]
        d[p.lower() + '_wages'] = (h['pay'] - h['k401'] + o[p + '_k401_in_income'] - (excl if p == 'A' else ZERO)
                                   - h['hsa_payroll'] + per[p]['excess'])
    for status, members in returns_of(fs):
        share = c['other_income'] / 2 if status == 'married_separate' else c['other_income']
        magi = sum((d[q.lower() + '_wages'] for q in members), ZERO) + share
        real = magi - sum((o[q + '_trad_ira_deductible'] for q in members), ZERO)
        for q in members:
            assert o[q + '_magi'] == magi, ('box-1 glue does not match rules.py', c)
            d[q.lower() + '_agi_real_deduction'] = real
    # Pub. 590-A Worksheet 2-2 (three-place ratio, line 8 "Round the result up to the nearest $10. If the result is
    # less than $200, enter $200", line 11 the lesser of line 8 and line 10) for MAGI inside the range
    for p in ppl:
        lim, cu = R.ira_limit(y, ages[p])
        full = lim + cu
        s, e = R.roth_range(y, fs, apart)
        magi = o[p + '_magi']
        ws = R.phase_out(full, magi, s, e, 'worksheet')
        if s < magi < e:
            ws = max(F(R.PHASEOUT_FLOOR), ws)
        d[p.lower() + '_roth_allowed_worksheet'] = max(ZERO, min(ws, full - c[p]['trad_ira']))
    return d


# ============================ derivation 2: this file, in integers ============================

U = 200      # money in half cents: 200 units to the dollar (separate returns halve the other income)
BP = 10000   # rates in basis points


def un(x):
    v = fr(x) * U
    if v.denominator != 1:
        raise ValueError(f'{x} is not a whole number of half cents')
    return v.numerator


def bp_of(rate):
    v = fr(rate) * BP
    assert v.denominator == 1, rate
    return v.numerator


SS_BP, MED_BP, ADDL_BP, FLAT_BP = bp_of(R.SS_RATE), bp_of(R.MEDICARE_RATE), bp_of(R.ADDL_MEDICARE_RATE), bp_of(R.FLAT_FICA_RATE)
assert (SS_BP, MED_BP, ADDL_BP, FLAT_BP) == (620, 145, 90, 765)
TEN_U, FLOOR_U = 10 * U, R.PHASEOUT_FLOOR * U
_T2 = {}


def tables_2(y):
    """The year's figures from rules.py's tables, in units (no rules.py function is called)."""
    if y in _T2:
        return _T2[y]
    t = {'hsa': (R.HSA_LIMIT[y][0] * U, R.HSA_LIMIT[y][1] * U), 'published': y in R.ELECTIVE_DEFERRAL}
    if t['published']:
        t.update(k401=R.ELECTIVE_DEFERRAL[y] * U, cu50=R.CATCH_UP_50[y] * U, cu6063=R.CATCH_UP_60_63[y] * U,
                 a415=R.ANNUAL_ADDITIONS[y] * U, ira=R.IRA_LIMIT[y] * U, ira_cu=R.IRA_CATCH_UP[y] * U,
                 roth={k: (s * U, e * U) for k, (s, e) in R.ROTH_PHASEOUT[y].items()},
                 trad={k: (s * U, e * U) for k, (s, e) in R.TRAD_PHASEOUT[y].items()},
                 fsa=R.FSA_LIMIT[y] * U, fsa_co=R.FSA_CARRYOVER[y] * U, gift=R.GIFT_EXCLUSION[y] * U,
                 std={k: v * U for k, v in R.STANDARD_DEDUCTION[y].items()}, ss_base=R.SS_WAGE_BASE[y] * U,
                 brackets={st: ([up * U for up, _ in tb[:-1]], [bp_of(r) for _, r in tb],
                                [un(b) for b in R.BRACKET_BASES[y][st]]) for st, tb in R.BRACKETS[y].items()})
    _T2[y] = t
    return t


def dc_holiday_2(d):
    """D.C. Code 28-2701 read day by day: the fixed days, a Saturday holiday kept on the Friday before and a Sunday
    holiday on the Monday after; the Monday holidays by their day range; Thanksgiving; Inauguration Day (Jan 20 after
    a leap year, a Sunday moved to Monday, no Saturday shift)."""
    fixed = {(1, 1), (6, 19), (7, 4), (11, 11), (12, 25)}
    if MUT != 'deadline_no_emancipation_day':
        fixed.add((4, 16))
    wd = d.weekday()
    if (d.month, d.day) in fixed:
        return True
    nxt, prv = d + dt.timedelta(days=1), d - dt.timedelta(days=1)
    if wd == 4 and (nxt.month, nxt.day) in fixed:
        return True
    if wd == 0 and (prv.month, prv.day) in fixed:
        return True
    if wd == 0 and ((d.month in (1, 2) and 15 <= d.day <= 21) or (d.month == 5 and d.day >= 25)
                    or (d.month == 9 and d.day <= 7) or (d.month == 10 and 8 <= d.day <= 14)):
        return True
    if wd == 3 and d.month == 11 and 22 <= d.day <= 28:
        return True
    if d.year % 4 == 1 and d.month == 1 and ((d.day == 20 and wd != 6) or (d.day == 21 and wd == 0)):
        return True
    return False


def deadline_2(tax_year):
    d = dt.date(tax_year + 1, 4, 15)
    while d.weekday() >= 5 or dc_holiday_2(d):
        d += dt.timedelta(days=1)
    return d


def catch_up_401k_2(t, age):
    """414(v): the first row of the table the age reaches."""
    table = ((64, t['cu50']), (60, t['cu50'] if MUT == 'catch_up_60_63_missing' else t['cu6063']), (50, t['cu50']),
             (0, 0))
    for at_least, amt in table:
        if age >= at_least:
            return amt


def phase_2(full, x, start, end):
    """The reduced dollar limit, in units: one integer floor division for the $10 rounding, then the $200 floor."""
    if x <= start:
        return full
    if x >= end:
        return 0
    width = end - start
    if MUT == 'roth_round_nearest':
        red = (2 * full * (x - start) + TEN_U * width) // (2 * TEN_U * width) * TEN_U
    else:
        red = full * (x - start) // (TEN_U * width) * TEN_U
    lim = full - red
    if 0 < lim < FLOOR_U and MUT != 'roth_no_floor':
        lim = FLOOR_U
    return max(0, lim)


def worksheet_2(full, x, start, end):
    """Pub. 590-A Worksheet 2-2, lines 5 to 8, in units, for MAGI inside the range."""
    width = end - start
    r = min(1000, (2000 * (x - start) + width) // (2 * width))     # line 5, thousandths, half up, at most 1.000
    line7 = r * full // 1000
    assert r * full % 1000 == 0
    line8 = -((line7 - full) // TEN_U) * TEN_U                      # up to the next $10
    return max(FLOOR_U, line8)


def tax_2(t, status, taxable):
    """Rate schedule from the printed bases ("$X plus N% of the excess over"), in units x basis points."""
    if taxable <= 0:
        return 0
    uppers, rates, bases = t['brackets'][status]
    i = bisect_left(uppers, taxable)
    lower = 0 if i == 0 else uppers[i - 1]
    base = 0 if i == 0 else bases[i - 1]
    return base * BP + rates[i] * (taxable - lower)


def hsa_2(t, cov, ppl, age, use):
    self_u, fam_u = t['hsa']
    base = {'none': 0, 'self': self_u, 'family': fam_u}[cov]
    elig = {p: cov == 'family' or (cov == 'self' and p == 'A') for p in ppl}
    cu = {p: R.HSA_CATCH_UP * U if elig[p] and age[p] >= R.HSA_CATCH_UP_AGE else 0 for p in ppl}
    shared = cov == 'family' and len(ppl) == 2
    lim, exc = {}, {}
    for p in ppl:
        q = 'B' if p == 'A' else 'A'
        if not elig[p]:
            lim[p] = 0
        elif shared and MUT == 'hsa_catch_up_pooled':
            lim[p] = base + cu[p] + cu[q] - use[q]
        elif shared:   # the brief's formula, never below the person's own catch-up
            lim[p] = max(cu[p], min(base + cu[p] - use[p], base + cu[p] + cu[q] - use[p] - use[q]) + use[p])
        else:
            lim[p] = base + cu[p]
    if shared and MUT != 'hsa_catch_up_pooled':   # equal halves, then a half one spouse leaves unused goes to the other
        half = base // 2
        need = {p: max(0, use[p] - cu[p]) for p in ppl}
        spare = {p: max(0, half - need[p]) for p in ppl}
        for p in ppl:
            q = 'B' if p == 'A' else 'A'
            exc[p] = max(0, need[p] - half - spare[q])
    else:
        for p in ppl:
            exc[p] = max(0, use[p] - lim[p])
    hh_lim = base + sum(cu.values()) if any(elig.values()) else 0
    return elig, lim, exc, hh_lim


TRAD_KEY = {('joint', 1, 0): 'joint', ('joint', 1, 1): 'joint', ('joint', 0, 1): 'spouse', ('joint', 0, 0): None,
            ('together', 1, 0): 'separate', ('together', 1, 1): 'separate', ('together', 0, 1): 'separate',
            ('together', 0, 0): None,
            ('alone', 1, 0): 'single', ('alone', 1, 1): 'single', ('alone', 0, 1): None, ('alone', 0, 0): None}


def work2(c):
    y, fs = c['year'], c['filing_status']
    t = tables_2(y)
    ppl = people(c)
    apart = fs == 'married_separate' and c['lived_apart'] == 1
    m = {p: {k: un(c[p][k]) for k in FIELDS} for p in ppl}
    age = {}
    for p in ppl:
        by = int(c[p]['birth'][:4])
        age[p] = y - by
        if MUT == 'age_on_today' and c['today'][5:] < c[p]['birth'][5:]:
            age[p] -= 1
    v = {k: None for k in OUTPUT_COLS}           # values in units; non-money values as they are
    v['ira_hsa_deadline'] = deadline_2(y).isoformat()
    lo = {p: p.lower() + '_' for p in ppl}
    for p in ppl:
        v[lo[p] + 'age'] = age[p]

    use = {p: m[p]['hsa_payroll'] + m[p]['hsa_employer'] for p in ppl}
    elig, hlim, exc, hh_lim = hsa_2(t, c['coverage'], ppl, age, use)
    for p in ppl:
        v[lo[p] + 'hsa_eligible'] = 1 if elig[p] else 0
        v[lo[p] + 'hsa_limit'] = hlim[p]
        v[lo[p] + 'hsa_used'] = use[p]
        v[lo[p] + 'hsa_room'] = max(0, hlim[p] - use[p])
        v[lo[p] + 'hsa_over'] = max(0, use[p] - hlim[p])
        v[lo[p] + 'hsa_excess'] = exc[p]
    total = sum(use.values())
    v.update(hsa_limit_household=hh_lim, hsa_total=total, hsa_room_household=max(0, hh_lim - total),
             hsa_over_household=max(0, total - hh_lim), hsa_excess_to_remove=sum(exc.values()))
    if not t['published']:
        return to_dollars(v, bp_keys=())

    # 401(k)
    k = {}
    for p in ppl:
        h = m[p]
        used = h['k401'] + (0 if MUT == 'roth401k_own_limit' else h['roth401k'])
        cu = min(catch_up_401k_2(t, age[p]), max(0, h['pay'] - min(used, t['k401'])))
        cap = t['k401'] + cu
        over = max(0, used - cap)
        beyond = used - t['k401']
        cu_used = 0 if beyond <= 0 else min(beyond, cu)
        add = (h['k401'] + h['roth401k']) - cu_used + h['k401_match']
        lim415 = min(t['a415'], h['pay'])
        k[p] = {'over': over, 'in_income': 0 if MUT == 'excess_deferral_not_income' else max(0, over - h['roth401k']),
                'active': 1 if h['k401'] + h['roth401k'] + h['k401_match'] > 0 else 0}
        v.update({lo[p] + 'k401_limit': t['k401'], lo[p] + 'k401_catch_up': cu, lo[p] + 'k401_used': used,
                  lo[p] + 'k401_room': max(0, cap - used), lo[p] + 'k401_over': over,
                  lo[p] + 'k401_in_income': k[p]['in_income'], lo[p] + 'annual_additions': add,
                  lo[p] + 'limit_415c': lim415, lo[p] + 'over_415c': max(0, add - lim415),
                  lo[p] + 'exceeds_415c': 1 if add > lim415 else 0, lo[p] + 'active_participant': k[p]['active']})

    # FSA through A's employer
    el, sp = un(c['fsa_election']), un(c['fsa_spent'])
    unspent = max(0, el - sp)
    v.update(fsa_limit=t['fsa'], fsa_carryover=t['fsa_co'], fsa_over=max(0, el - t['fsa']), fsa_unspent=unspent,
             fsa_forfeit=max(0, unspent - t['fsa_co']), fsa_with_hsa=1 if el > 0 and total > 0 else 0,
             gift_exclusion=t['gift'], qtp_five_year_max=5 * t['gift'])
    fsa_out = {p: (0 if MUT == 'fsa_not_excluded' else min(el, t['fsa'])) if p == 'A' else 0 for p in ppl}

    # wages with and without the HSA payroll money (the HSA position worked again on employer money alone)
    _, _, exc0, _ = hsa_2(t, c['coverage'], ppl, age, {p: m[p]['hsa_employer'] for p in ppl})
    fw, fw0, box, box0 = {}, {}, {}, {}
    for p in ppl:
        h = m[p]
        fw[p] = h['pay'] - fsa_out[p] - (h['hsa_payroll'] - exc[p])
        fw0[p] = h['pay'] - fsa_out[p] + exc0[p]
        box[p] = fw[p] - h['k401'] + k[p]['in_income']
        box0[p] = fw0[p] - h['k401'] + k[p]['in_income']
        v[lo[p] + 'wages'] = box[p]

    # IRA limit, compensation, page deduction
    full = {}
    for p in ppl:
        h = m[p]
        cu = (R.IRA_CATCH_UP[2025] * U if MUT == 'ira_catch_up_1000' else t['ira_cu']) if age[p] >= R.IRA_CATCH_UP_AGE else 0
        full[p] = t['ira'] + cu
        used = h['trad_ira'] + h['roth_ira']
        v.update({lo[p] + 'ira_limit': t['ira'], lo[p] + 'ira_catch_up': cu, lo[p] + 'ira_used': used,
                  lo[p] + 'ira_room': max(0, full[p] - used), lo[p] + 'ira_over': max(0, used - full[p]),
                  lo[p] + 'trad_ira_page_deduction': min(h['trad_ira'], full[p])})
        q = 'B' if p == 'A' else 'A'
        comp = box[p]
        if fs == 'married_joint' and box[p] < box[q]:
            comp += max(0, box[q] - m[q]['trad_ira'] - m[q]['roth_ira'])
        v[lo[p] + 'ira_compensation'] = comp
        v[lo[p] + 'ira_comp_ok'] = 1 if comp >= full[p] else 0

    # returns: MAGI, AGI, income tax, additional Medicare
    oth = un(c['other_income'])
    tax_w = tax_wo = addl_w = addl_wo = 0
    magi = {}
    if fs == 'married_joint':
        groups = [(fs, ppl)]
    elif fs == 'married_separate':
        groups = [(fs, (p,)) for p in ppl]
    else:
        groups = [(fs, ppl)]
    for status, members in groups:
        share = oth // 2 if status == 'married_separate' else oth
        mg = share + sum(box[q] for q in members)
        mg0 = share + sum(box0[q] for q in members)
        ded = sum(v[lo[q] + 'trad_ira_page_deduction'] for q in members)
        std = t['std'][status]
        tax_w += tax_2(t, status, mg - ded - std)
        tax_wo += tax_2(t, status, mg0 - ded - std)
        thr = R.ADDL_MEDICARE_THRESHOLD[status] * U
        if MUT == 'addl_medicare_per_person' and status == 'married_joint':
            thr2 = R.ADDL_MEDICARE_THRESHOLD['single'] * U
            addl_w += sum(ADDL_BP * max(0, fw[q] - thr2) for q in members)
            addl_wo += sum(ADDL_BP * max(0, fw0[q] - thr2) for q in members)
        else:
            addl_w += ADDL_BP * max(0, sum(fw[q] for q in members) - thr)
            addl_wo += ADDL_BP * max(0, sum(fw0[q] for q in members) - thr)
        for q in members:
            magi[q] = mg
            v[lo[q] + 'magi'] = mg
            v[lo[q] + 'agi'] = mg - ded
        if status == 'married_joint':
            v['magi'], v['agi'] = mg, mg - ded

    # Roth IRA and the traditional IRA deduction (contrast)
    kind = 'joint' if fs == 'married_joint' else ('together' if fs == 'married_separate' and not apart else 'alone')
    roth_key = {'joint': 'joint', 'together': 'single' if MUT == 'mfs_single_range' else 'separate',
                'alone': 'single'}[kind]
    start, end = t['roth'][roth_key]
    for p in ppl:
        h = m[p]
        x = magi[p]
        # Pub. 590-A Table 2-1's bands: below the start ok, at a start above 0 already 'reduced' (partial), at exactly 0 on
        # the separate-and-together range ok ("zero (-0-)")
        at_start_ok = (MUT != 'roth_zero_partial') if start == 0 else (MUT == 'roth_start_ok')
        if x < start or (x == start and at_start_ok):
            status = 'ok'
        elif x >= end:
            status = 'over'
        else:
            status = 'partial'
        reduced = phase_2(full[p], x, start, end)
        allowed = max(0, min(reduced, full[p] - h['trad_ira']))
        ws = worksheet_2(full[p], x, start, end) if start < x < end else reduced
        v.update({lo[p] + 'roth_status': status, lo[p] + 'roth_reduced_limit': reduced, lo[p] + 'roth_allowed': allowed,
                  lo[p] + 'roth_over': max(0, h['roth_ira'] - allowed),
                  lo[p] + 'roth_allowed_worksheet': max(0, min(ws, full[p] - h['trad_ira']))})
        q = 'B' if p == 'A' else 'A'
        spouse_active = k[q]['active'] if q in k else 0
        if MUT == 'trad_spouse_rule_off' and kind == 'joint' and not k[p]['active'] and spouse_active:
            key = 'joint'
        else:
            key = TRAD_KEY[(kind, k[p]['active'], spouse_active)]
        dlim = full[p] if key is None else phase_2(full[p], x, *t['trad'][key])
        v[lo[p] + 'trad_ira_deductible'] = min(h['trad_ira'], dlim)
    for status, members in groups:
        real = magi[members[0]] - sum(v[lo[q] + 'trad_ira_deductible'] for q in members)
        for q in members:
            v[lo[q] + 'agi_real_deduction'] = real
        if status == 'married_joint':
            v['agi_real_deduction'] = real

    # what the HSA payroll money saves (kept empty when anyone is 65 or older; the rows never are)
    if any(a >= R.MEDICARE_AGE for a in age.values()):
        return to_dollars(v, bp_keys=())
    ss = med = 0
    for p in ppl:
        if MUT == 'ss_no_wage_base':
            ss += SS_BP * (fw0[p] - fw[p])
        else:
            ss += SS_BP * (min(fw0[p], t['ss_base']) - min(fw[p], t['ss_base']))
        med += MED_BP * (fw0[p] - fw[p])
    v.update(income_tax_with=tax_w, income_tax_without=tax_wo, income_tax_saved=tax_wo - tax_w, fica_saved_ss=ss,
             fica_saved_medicare=med, fica_saved=ss + med, addl_medicare_saved=addl_wo - addl_w,
             fica_saved_flat=FLAT_BP * sum(m[p]['hsa_payroll'] for p in ppl))
    return to_dollars(v, bp_keys=('income_tax_with', 'income_tax_without', 'income_tax_saved', 'fica_saved_ss',
                                  'fica_saved_medicare', 'fica_saved', 'addl_medicare_saved', 'fica_saved_flat'))


def to_dollars(v, bp_keys):
    out = {}
    for key, val in v.items():
        if val is None or not is_money(key):
            out[key] = val
        elif key in bp_keys:
            out[key] = F(val, U * BP)
        else:
            out[key] = F(val, U)
    return out


# ======================================== the guard ========================================

class Guard:
    """Compares derivation 1 with derivation 2. An amount more than a cent apart, or any other value that differs at
    all, stops the run before the CSV is written."""

    def __init__(self):
        self.n = Counter()
        self.max_gap = ZERO

    def _stop(self, where, what, a, b):
        raise SystemExit(f'{CSV_NAME} {where} {what}: derivation 1 gives {a}, derivation 2 gives {b}; no CSV written')

    def compare(self, where, d1, d2):
        for k in EXACT_COLS:
            self.n['other values compared exactly'] += 1
            if d1[k] != d2[k]:
                self._stop(where, k, d1[k], d2[k])
        for k in MONEY_COLS:
            a, b = d1[k], d2[k]
            self.n['amounts compared'] += 1
            if (a is None) != (b is None):
                self._stop(where, k, a, b)
            if a is None:
                continue
            gap = abs(fr(a) - fr(b))
            if gap > CENT or abs(to_cents(a) - to_cents(b)) > 1:
                self._stop(where, k, money(a), money(b))
            self.max_gap = max(self.max_gap, gap)
            self.n['amounts that differ at all before rounding'] += gap != 0
            self.n['amounts whose written cents differ'] += to_cents(a) != to_cents(b)


# ============================== RULES.md section 10, by derivation 2 ==============================

def example_cases(rng):
    """RULES.md section 10, as households. The first rows of the CSV."""
    T = lambda: rand_date(rng, 2026)  # noqa: E731
    ana, ben = '1970-06-15', '1974-02-11'
    ex = [
        case(2026, 'single', person('1965-03-14', 150000, k401=26000, roth401k=10000, match=6000), today=T(),
             note='RULES.md 10.1 Rosa, 61: 26,000 pre-tax + 10,000 Roth is 250 over 24,500 + 11,250; Roth money covers it'),
        case(2026, 'single', person('1965-03-14', 150000, k401=36000, match=6000), today=T(),
             note='RULES.md 10.1 Rosa all pre-tax: the 250 over is income this year'),
        case(2026, 'married_joint', person('1981-05-02', 150000, k401=10000, roth=4260),
             person('1974-09-20', 105000, trad=6000, roth=3000), other=1321, today=T(),
             note='RULES.md 10.2 Dev and Mara: joint MAGI 246,321 inside 242,000-252,000; Mara 400 over'),
        case(2026, 'married_separate', person('1986-01-10', 90000, roth=7500), person('1988-03-03', 9000, roth=7500),
             apart=0, today=T(), note='RULES.md 10.3 Sam and Lee, separate, lived together: range 0-10,000'),
        case(2026, 'married_separate', person('1986-01-10', 90000, roth=7500), person('1988-03-03', 9000, roth=7500),
             apart=1, today=T(), note='RULES.md 10.3 Sam and Lee, separate, apart all year: the single range'),
        case(2026, 'married_separate', person('1986-01-10', 90000, roth=7500), person('1988-03-03', 9990, roth=7500),
             apart=0, today=T(), note='RULES.md 10.3 Lee at MAGI 9,990: 10 left, raised to the 200 floor'),
        case(2026, 'married_joint', person(ana, 90000, hsa_p=3000, hsa_e=1000), person(ben, 80000, hsa_p=5000, hsa_e=500),
             coverage='family', today=T(), note='RULES.md 10.4 Ana (56) and Ben (52): one family limit, 250 room each'),
        case(2026, 'married_joint', person(ana, 90000, hsa_p=3000, hsa_e=1000), person(ben, 80000, hsa_p=6000, hsa_e=500),
             coverage='family', today=T(), note='RULES.md 10.4 Ben adds 1,000: both show 750 over, 750 must come out (Ben)'),
        case(2026, 'married_joint', person('1974-06-15', 90000, hsa_p=8750, hsa_e=1000), person('1970-02-11', 80000),
             coverage='family', today=T(),
             note="RULES.md 10.4 ages swapped: Ana (52) at 9,750 is 1,000 over; Ben's catch-up cannot go to her"),
        case(2026, 'married_joint', person('1986-04-04', 90000, hsa_p=5000, hsa_e=1000),
             person('1986-08-08', 80000, hsa_p=5000, hsa_e=1000), coverage='family', today=T(),
             note='RULES.md 10.4 both 40 at 6,000: each shows 3,250 over, 1,625 each must come out'),
        case(2026, 'married_joint', person(ana, 90000, hsa_p=3000, hsa_e=1000), person(ben, 80000, hsa_p=5000, hsa_e=500),
             coverage='family', fsa_e=1000, fsa_s=1000, today=T(),
             note='RULES.md 10.4 with an FSA through Ana: the FSA + HSA warning'),
        case(2026, 'single', person('1981-07-07', 210000, k401=24500, hsa_p=4400), coverage='self', today=T(),
             note='RULES.md 10.5 Kai at 210,000: no Social Security saved, Medicare 63.80, additional Medicare 39.60'),
        case(2026, 'single', person('1981-07-07', 186000, k401=24500, hsa_p=4400), coverage='self', today=T(),
             note='RULES.md 10.5 Kai at 186,000: Social Security saved 179.80 (wage base 184,500)'),
        case(2026, 'single', person('1988-11-21', 70000), fsa_e=3600, fsa_s=2900, today=T(),
             note='RULES.md 10.6 Jo: FSA 3,600 elected, 200 over, 700 unspent, 20 lost above the 680 carryover'),
        case(2026, 'single', person('1988-11-21', 70000, hsa_p=1000), coverage='self', fsa_e=3600, fsa_s=2900,
             today=T(), note='RULES.md 10.6 Jo with HSA money too: the FSA + HSA warning'),
    ]
    return ex


def check_examples():
    """Derivation 2 against the worked numbers of RULES.md section 10. Returns the number of assertions."""
    n = 0
    ex = [work2(c) for c in example_cases(random.Random(SEED))]

    def eq(row, key, want):
        nonlocal n
        got = ex[row][key]
        want = fr(want) if is_money(key) else want
        assert got == want, (row, key, got, want)
        n += 1
    for key, want in (('a_k401_limit', 24500), ('a_k401_catch_up', 11250), ('a_k401_used', 36000), ('a_k401_room', 0),
                      ('a_k401_over', 250), ('a_k401_in_income', 0), ('a_annual_additions', 30750),
                      ('a_limit_415c', 72000)):
        eq(0, key, want)
    eq(0, 'a_exceeds_415c', 0)
    eq(1, 'a_k401_over', 250)
    eq(1, 'a_k401_in_income', 250)
    for key, want in (('magi', 246321), ('a_roth_status', 'partial'), ('b_roth_status', 'partial'),
                      ('a_roth_reduced_limit', 4260), ('a_roth_allowed', 4260), ('a_roth_over', 0),
                      ('b_roth_reduced_limit', 4890), ('b_roth_allowed', 2600), ('b_roth_over', 400), ('b_ira_over', 400),
                      ('b_trad_ira_page_deduction', 6000), ('b_trad_ira_deductible', 4890), ('agi', 240321),
                      ('agi_real_deduction', 241431), ('b_roth_allowed_worksheet', 2600)):
        eq(2, key, want)
    for key, want in (('a_roth_status', 'over'), ('a_roth_allowed', 0), ('a_roth_over', 7500), ('b_roth_status', 'partial'),
                      ('b_roth_allowed', 750), ('b_roth_over', 6750)):
        eq(3, key, want)
    for key, want in (('a_roth_status', 'ok'), ('a_roth_allowed', 7500), ('a_roth_over', 0), ('b_roth_status', 'ok'),
                      ('b_roth_allowed', 7500), ('b_roth_over', 0)):
        eq(4, key, want)
    eq(5, 'b_roth_reduced_limit', 200)
    for key, want in (('a_hsa_limit', 4250), ('a_hsa_room', 250), ('b_hsa_limit', 5750), ('b_hsa_room', 250),
                      ('hsa_limit_household', 9750), ('hsa_total', 9500), ('hsa_room_household', 250),
                      ('hsa_over_household', 0)):
        eq(6, key, want)
    for key, want in (('a_hsa_over', 750), ('b_hsa_over', 750), ('hsa_over_household', 750), ('a_hsa_excess', 0),
                      ('b_hsa_excess', 750), ('hsa_excess_to_remove', 750)):
        eq(7, key, want)
    for key, want in (('a_hsa_over', 1000), ('hsa_over_household', 0), ('hsa_excess_to_remove', 1000),
                      ('a_hsa_excess', 1000)):
        eq(8, key, want)
    for key, want in (('a_hsa_over', 3250), ('b_hsa_over', 3250), ('a_hsa_excess', 1625), ('b_hsa_excess', 1625),
                      ('hsa_over_household', 3250)):
        eq(9, key, want)
    eq(10, 'fsa_with_hsa', 1)
    for key, want in (('income_tax_with', 32198), ('income_tax_without', 33254), ('income_tax_saved', 1056),
                      ('fica_saved_ss', 0), ('fica_saved_medicare', '63.80'), ('addl_medicare_saved', '39.60'),
                      ('fica_saved_flat', '336.60')):
        eq(11, key, want)
    for key, want in (('fica_saved_ss', '179.80'), ('fica_saved_medicare', '63.80'), ('addl_medicare_saved', 0),
                      ('income_tax_saved', 1056)):
        eq(12, key, want)
    for key, want in (('fsa_limit', 3400), ('fsa_carryover', 680), ('fsa_over', 200), ('fsa_unspent', 700),
                      ('fsa_forfeit', 20), ('fsa_with_hsa', 0), ('gift_exclusion', 19000), ('qtp_five_year_max', 95000)):
        eq(13, key, want)
    eq(13, 'a_wages', 70000 - 3400)
    eq(14, 'fsa_with_hsa', 1)
    for ty, want in ((2025, '2026-04-15'), (2026, '2027-04-15'), (2027, '2028-04-18'), (2015, '2016-04-18'),
                     (2016, '2017-04-18'), (2021, '2022-04-18'), (2022, '2023-04-18')):
        assert deadline_2(ty).isoformat() == want, (ty, deadline_2(ty))
        n += 1
    return n


# ======================================== the generator ========================================

def ira_full(y, age):
    return R.IRA_LIMIT[y] + (R.IRA_CATCH_UP[y] if age >= 50 else 0)


def k401_full(y, age):
    cu = R.CATCH_UP_60_63[y] if 60 <= age <= 63 else R.CATCH_UP_50[y] if age >= 50 else 0
    return R.ELECTIVE_DEFERRAL[y] + cu


def hsa_cap(y, coverage, age):
    self_l, fam_l = R.HSA_LIMIT[y]
    return (fam_l if coverage == 'family' else self_l) + (1000 if age >= 55 else 0)


def for_magi(rng, y, fs, target, a, b=None, apart=0, coverage='none', note='', today=None):
    """A household whose MAGI is exactly `target`: the household's on a joint return, A's otherwise. a and b give the
    age, the money other than pay (all inside their limits, no FSA) and, for B on a separate return, B's pay."""
    target = fr(target)
    whole = target.numerator // target.denominator
    if fs == 'married_joint':
        other0 = min(rng.randint(0, 1500), whole)
        tot = whole - other0
        wa = tot * rng.randint(35, 65) // 100
        wb = tot - wa
        other = target - wa - wb
    elif fs == 'married_separate':
        other0 = min(rng.randint(0, 600), whole)
        wa = whole - other0
        other = 2 * (target - wa)
    else:
        other0 = min(rng.randint(0, 1500), whole)
        wa = whole - other0
        other = target - wa

    def mk(spec, wages):
        pay = spec.get('pay', wages + spec.get('k401', 0) + spec.get('hsa_p', 0))
        return person(birth_on(rng, y, spec['age'], spec.get('kind', 'random')), pay, k401=spec.get('k401', 0),
                      roth401k=spec.get('roth401k', 0), match=spec.get('match', 0), trad=spec.get('trad', 0),
                      roth=spec.get('roth', 0), hsa_p=spec.get('hsa_p', 0), hsa_e=spec.get('hsa_e', 0))
    pa = mk(a, wa)
    pb = None
    if b is not None:
        pb = mk(b, wb if fs == 'married_joint' else 0)
    c = case(y, fs, pa, pb, apart=apart, coverage=coverage, other=other, today=today or rand_date(rng, y), note=note)
    c['_target'] = target
    return c


def roth_targets(L, s, e):
    """MAGI points on and around a phase-out range for the full limit L (whole hundreds): (MAGI, label)."""
    L, s, e = F(L), F(s), F(e)
    W = e - s
    out = []
    if s > 0:
        out.append((s - CENT, 'start - 0.01: ok'))
    out += [(s, 'exactly the start: partial (Pub. 590-A Table 2-1 "at least"), nothing reduced' if s > 0
             else 'exactly the start (zero): ok (Pub. 590-A Table 2-1 "zero (-0-)"), nothing reduced'),
            (s + CENT, 'start + 0.01: partial, nothing reduced yet'),
            (s + 1, 'start + 1: partial, the reduction rounds down to 0')]
    xc = -((-1000 * W) // L)   # cents: first point where L x / W reaches 10
    out += [(s + F(xc - 1, 100), 'a cent before the first $10 step: full limit'),
            (s + F(xc, 100), 'the first $10 step: limit - 10')]
    x = -((-W) // 2)
    while (L * x) % (10 * W):
        x += 1
    out += [(s + x, 'reduction exactly a multiple of $10 (a float trap)'),
            (s + x - CENT, 'a cent below that: the reduction drops a $10 step')]
    x = (W * 3) // 5
    while not (5 <= (L * x / W) % 10 < 10) or (L * x / W).denominator == 1:
        x += 1
    out.append((s + x, 'reduction ends in 5 to 9.99: rounded down, not to the nearest $10'))
    x = (W * 3) // 10
    while R.phase_out(L, s + x, s, e) == max(F(200), R.phase_out(L, s + x, s, e, 'worksheet')):
        x += 1
    out.append((s + x, "Pub. 590-A's three-place ratio gives $10 less than the exact law"))
    for left, label in ((210, 'limit 210, just above the floor'), (200, 'limit exactly 200 without the floor'),
                        (190, 'limit 190 raised to the 200 floor'), (10, 'limit 10 raised to the 200 floor')):
        xc = -((-(L - left) * W * 100) // L)
        out.append((s + F(xc, 100), label))
    out += [(e - 1, 'end - 1: 200 by the floor'), (e - CENT, 'end - 0.01: 200 by the floor'),
            (e, 'exactly the end: over, 0'), (e + 1, 'end + 1: over')]
    return out


def example_and_age_edges(rng):
    out = example_cases(rng)
    statuses = ('single', 'married_joint', 'head_of_household', 'married_separate')
    partner = {49: 50, 50: 49, 54: 55, 55: 54, 59: 60, 60: 59, 63: 64, 64: 63}
    i = 0
    for y in YEARS:
        for age in EDGE_AGES:
            for kind in ('jan1', 'dec31', 'feb29', 'random'):
                if kind == 'feb29' and not leap(y - age):
                    continue
                fs = statuses[i % 4]
                i += 1
                birth = birth_on(rng, y, age, kind)
                today = today_before_birthday(rng, y, birth)
                tot = k401_full(y, age)
                roth401 = (0, tot // 2, tot)[i % 3]
                full = ira_full(y, age)
                if fs == 'married_separate':    # the 0-10,000 Roth range: traditional money only
                    trad, roth = full, 0
                else:
                    trad = 0 if i % 2 else full // 2
                    roth = full - trad
                hsa = hsa_cap(y, 'self', age)
                a = person(birth, 140000, k401=tot - roth401, roth401k=roth401, match=4000, trad=trad, roth=roth, hsa_p=hsa)
                b = None
                if fs in MARRIED:
                    bage = partner[age]
                    bb = birth_on(rng, y, bage, 'feb29' if leap(y - bage) else ('jan1', 'dec31', 'random')[i % 3])
                    btot = k401_full(y, bage)
                    bfull = ira_full(y, bage)
                    b = person(bb, 85000, k401=btot, trad=bfull if fs == 'married_separate' else 0,
                               roth=0 if fs == 'married_separate' else bfull)
                when = 'is the birthday' if kind == 'jan1' else 'is before the birthday'
                note = (f'age edge: reaches {age} in {y} (born {birth}), today {today} {when}; '
                        f'401(k), IRA and HSA exactly at the limits for that age')
                out.append(case(y, fs, a, b, coverage='self', today=today, note=note))
    return out


def roth_edges(rng):
    out = []
    for y in YEARS:
        for kind in ('joint', 'single', 'separate'):
            for catch in (False, True):
                ages = list(range(50, 65)) if catch else list(range(22, 50))
                for j, (T, label) in enumerate(roth_targets(ira_full(y, 50 if catch else 30),
                                                            *R.ROTH_PHASEOUT[y][kind])):
                    age = rng.choice(ages)
                    L = ira_full(y, age)
                    trad = (0, 1500, 0, 3000)[j % 4]
                    a = {'age': age, 'roth': L - trad, 'trad': trad, 'k401': rng.choice((0, 0, 5000, 12000))}
                    if kind == 'joint':
                        bage = rng.randint(22, 64)
                        b = {'age': bage, 'roth': ira_full(y, bage), 'k401': rng.choice((0, 8000, 20000))}
                        fs, apart = 'married_joint', 0
                    elif kind == 'single':   # the three statuses on the single range take turns, shifted per block
                        fs = ('single', 'head_of_household', 'married_separate')[(j + 2 * (y - YEARS[0]) + catch) % 3]
                        apart = 1 if fs == 'married_separate' else 0
                        b = {'age': rng.randint(22, 64), 'pay': rng.randint(40000, 160000)} if fs in MARRIED else None
                    else:
                        fs, apart = 'married_separate', 0
                        a['k401'] = 0
                        b = {'age': rng.randint(22, 64), 'pay': rng.randint(40000, 160000)}
                    span = '%s-%s' % R.ROTH_PHASEOUT[y][kind]
                    who = 'household' if kind == 'joint' else 'A'
                    note = (f'Roth {y} {kind} range {span}, limit {L:,}: {who} MAGI {money(T)}, {label}'
                            + (f'; traditional {trad:,} leaves {L - trad:,}' if trad else ''))
                    c = for_magi(rng, y, fs, T, a, b, apart=apart, note=note)
                    if c['A']['pay'] < L:
                        c['note'] += '; pay under the IRA limit (no spousal IRA on a separate return): compensation short, recorded'
                    out.append(c)
    return out


def trad_edges(rng):
    out = []
    for y in YEARS:
        for kind in ('single', 'joint', 'spouse', 'separate'):
            s, e = R.TRAD_PHASEOUT[y][kind]
            age = rng.choice((35, 52))
            L = ira_full(y, age)
            W = e - s
            x = (W * 3) // 5
            while not (5 <= (F(L * x, W)) % 10 < 10) or F(L * x, W).denominator == 1:
                x += 1
            pts = [(F(s), 'start'), (F(s + 1), 'start + 1'), (F(s + x), 'reduction ends in 5 to 9.99, rounded down'),
                   (F(s) + F(-((-(L - 190) * W * 100) // L), 100), 'limit 190 raised to 200'),
                   (F(e - 1), 'end - 1: 200 by the floor'), (F(e), 'end: nothing deductible')]
            for j, (T, label) in enumerate(pts):
                if kind == 'single':
                    fs = ('single', 'head_of_household', 'married_separate')[j % 3]
                    apart = 1 if fs == 'married_separate' else 0
                    a = {'age': age, 'trad': L, 'k401': 6000, 'match': 3000}
                    b = {'age': rng.randint(22, 64), 'pay': rng.randint(40000, 120000)} if fs in MARRIED else None
                    who = 'A, in a plan'
                elif kind == 'joint':
                    fs, apart = 'married_joint', 0
                    a = {'age': age, 'trad': L, 'k401': 6000}
                    b = {'age': rng.randint(22, 64), 'k401': rng.choice((0, 9000))}
                    who = 'A in a plan, joint'
                elif kind == 'spouse':
                    fs, apart = 'married_joint', 0
                    a = {'age': age, 'trad': L}
                    b = {'age': rng.randint(22, 64), 'roth401k': 5000, 'match': 2500}
                    who = 'A not in a plan, B in one (Roth 401(k) + match), joint'
                else:
                    fs, apart = 'married_separate', 0
                    a = {'age': age, 'trad': L}
                    b = {'age': rng.randint(22, 64), 'k401': 10000, 'pay': rng.randint(60000, 140000)}
                    who = 'A not in a plan, B in one, separate and together'
                note = f'traditional IRA deduction {y} ({who}) range {s:,}-{e:,}: MAGI {money(T)}, {label}'
                out.append(for_magi(rng, y, fs, T, a, b, apart=apart, note=note))
        # full deduction: separate and apart with only the spouse in a plan; nobody in a plan at a high income
        out.append(case(y, 'married_separate', person(birth_on(rng, y, 41), 95000, trad=ira_full(y, 41)),
                        person(birth_on(rng, y, 44), 120000, k401=15000), apart=1, today=rand_date(rng, y),
                        note='traditional IRA: separate and apart all year, only the spouse in a plan: full deduction'))
        out.append(case(y, 'married_joint', person(birth_on(rng, y, 51), 210000, trad=ira_full(y, 51)),
                        person(birth_on(rng, y, 48), 190000, trad=ira_full(y, 48)), other=5000, today=rand_date(rng, y),
                        note='traditional IRA: nobody in a plan, MAGI 405,000: full deduction; Roth over'))
    return out


def k401_edges(rng):
    out = []
    for y in YEARS:
        lim, a415 = R.ELECTIVE_DEFERRAL[y], R.ANNUAL_ADDITIONS[y]
        j = 0
        for group, ages in (('under 50', (30, 48)), ('50-59', (50, 59)), ('60-63', (60, 63)), ('64', (64, 64))):
            for delta in (-1, 0, 1, 2500):
                age = rng.randint(*ages)
                tot = k401_full(y, age) + delta
                split = j % 3
                roth = (0, tot, 5000)[split]
                pay = 160000
                fs = ('single', 'head_of_household', 'married_joint')[j % 3]
                b = person(birth_on(rng, y, rng.randint(22, 64)), 70000) if fs in MARRIED else None
                a = person(birth_on(rng, y, age), pay, k401=tot - roth, roth401k=roth, match=(0, 6400)[j % 2])
                note = (f'401(k) {y}, age {age} ({group}): used {tot:,} = limit with catch-up {delta:+,}; '
                        + ('pre-tax only', 'Roth 401(k) only', 'pre-tax + 5,000 Roth')[split]
                        + ('; with match' if j % 2 else '; no match'))
                out.append(case(y, fs, a, b, today=rand_date(rng, y), note=note))
                j += 1
        cu55 = R.CATCH_UP_50[y]
        rows = [
            (40, 200000, lim, 0, a415 - lim, 'annual additions exactly the 415(c) limit'),
            (40, 200000, lim, 0, a415 - lim + 1, 'annual additions 1 over the 415(c) limit'),
            (55, 200000, lim + cu55, 0, a415 - lim, 'deferrals with catch-up + match: the catch-up is outside 415(c)'),
            (35, 30000, 20000, 0, 12000, '415(c) is 100% of pay: 32,000 added on 30,000 pay'),
            (40, 200000, lim + 3000, 0, a415 - lim - 2000, 'an excess deferral kept in the plan counts in 415(c)'),
            (45, 120000, 0, lim, 9000, 'Roth 401(k) at the limit with a match'),
            (45, 120000, 0, lim, 0, 'Roth 401(k) at the limit without a match'),
            (52, 120000, 0, lim + cu55 + 700, 4000, 'Roth 401(k) only, 700 over: Roth, so not income again'),
            (55, lim + 1500, lim + 1000, 0, 0, 'catch-up capped by pay: pay - deferrals within the limit'),
            (61, lim + 100, lim + 100, 0, 0, 'every dollar of pay deferred: catch-up capped at 100'),
        ]
        for age, pay, pre, roth, match, label in rows:
            fs = rng.choice(('single', 'head_of_household'))
            out.append(case(y, fs, person(birth_on(rng, y, age), pay, k401=pre, roth401k=roth, match=match),
                            today=rand_date(rng, y), note=f'401(k) {y}, age {age}, pay {pay:,}: {label}'))
    return out


def ira_edges(rng):
    out = []
    for y in YEARS:
        j = 0
        for age in (rng.randint(25, 48), rng.randint(50, 64)):
            L = ira_full(y, age)
            for delta in (-1, 0, 1):
                kind = j % 3
                tot = L + delta
                trad = (tot, 0, tot // 3)[kind]
                fs = ('single', 'married_joint', 'head_of_household')[j % 3]
                b = person(birth_on(rng, y, rng.randint(22, 64)), 60000) if fs in MARRIED else None
                a = person(birth_on(rng, y, age), 65000, trad=trad, roth=tot - trad)
                out.append(case(y, fs, a, b, today=rand_date(rng, y),
                                note=f'IRA {y}, age {age}: traditional {trad:,} + Roth {tot - trad:,} = limit {L:,} {delta:+}'))
                j += 1
        # spousal IRA on a joint return; no pay on a separate return
        out.append(case(y, 'married_joint', person(birth_on(rng, y, 40), 90000, roth=R.IRA_LIMIT[y]),
                        person(birth_on(rng, y, 52), 0, roth=ira_full(y, 52)), today=rand_date(rng, y),
                        note='IRA: B has no pay; the joint return lends B compensation (spousal IRA, 219(c))'))
        out.append(case(y, 'married_separate', person(birth_on(rng, y, 40), 90000),
                        person(birth_on(rng, y, 33), 0, roth=R.IRA_LIMIT[y]), today=rand_date(rng, y),
                        note='IRA: B has no pay on a separate return: compensation 0 recorded, limits shown as if earned'))
    return out


def hsa_split(rng, total, frac_employer=None):
    """(payroll, employer) adding up to total."""
    if frac_employer is None:
        frac_employer = rng.choice((0, 0, F(1, 4), F(1, 2)))
    emp = (total * frac_employer).__floor__()
    return total - emp, emp


def hsa_edges(rng, y):
    out = []
    self_l, fam_l = R.HSA_LIMIT[y]
    published = y in R.ELECTIVE_DEFERRAL
    j = 0
    for cov in ('self', 'family'):
        for age in (rng.randint(30, 54), rng.randint(55, 64)):
            cap = hsa_cap(y, cov, age)
            for delta in (-1, 0, 1):
                src = j % 3
                tot = cap + delta
                pp, ee = ((tot, 0), (0, tot), (tot - 1000, 1000))[src]
                fs = ('single', 'head_of_household')[j % 2] if cov == 'family' else ('single', 'head_of_household', 'married_joint')[j % 3]
                b = person(birth_on(rng, y, rng.randint(22, 64)), 60000) if fs in MARRIED else None
                a = person(birth_on(rng, y, age), 95000, hsa_p=pp, hsa_e=ee)
                out.append(case(y, fs, a, b, coverage=cov, today=rand_date(rng, y),
                                note=f'HSA {y} {cov} cover, age {age}: {pp:,} payroll + {ee:,} employer = limit {cap:,} {delta:+}'))
                j += 1
    # married, one family limit: who is 55 or over x household total around the household limit
    k = 0
    for ages in ((40, 45), (56, 45), (45, 56), (55, 58)):
        for delta in (-1, 0, 1):
            fs, apart = (('married_joint', 0), ('married_separate', 0), ('married_separate', 1))[k % 3]
            cu = {p: 1000 if a >= 55 else 0 for p, a in zip('AB', ages)}
            share_a = (fam_l * rng.randint(3, 7) // 10) // 10 * 10
            ua = cu['A'] + share_a + (delta if k % 2 == 0 else 0)
            ub = cu['B'] + fam_l - share_a + (delta if k % 2 else 0)
            pa, ea = hsa_split(rng, ua)
            pb, eb = hsa_split(rng, ub)
            a = person(birth_on(rng, y, ages[0]), 88000, hsa_p=pa, hsa_e=ea)
            b = person(birth_on(rng, y, ages[1]), 76000, hsa_p=pb, hsa_e=eb)
            hh = fam_l + cu['A'] + cu['B']
            out.append(case(y, fs, a, b, apart=apart, coverage='family', today=rand_date(rng, y),
                            note=(f'HSA {y} family, ages {ages[0]} and {ages[1]}: {ua:,} + {ub:,} = household limit '
                                  f'{hh:,} {delta:+}' + ('; separate returns, apart all year: still one family limit'
                                                         if apart else '; separate returns' if fs == 'married_separate' else ''))))
            k += 1
    a52, a56 = birth_on(rng, y, 52), birth_on(rng, y, 56)
    rows = [
        (person(a52, 90000, hsa_p=fam_l + 500, hsa_e=500), person(a56, 70000), 'family',
         "A (52) puts in the family limit + 1,000, B (56) nothing: household within its limit, A 1,000 over (the catch-up is B's)"),
        (person(a56, 90000), person(a52, 70000, hsa_p=fam_l + 1000), 'family',
         "B (52) puts in the family limit + 1,000, A (56) nothing: B 1,000 over"),
        (person(birth_on(rng, y, 38), 90000, hsa_p=fam_l), person(birth_on(rng, y, 36), 70000), 'family',
         'A alone uses the whole family limit; B has no room'),
        (person(birth_on(rng, y, 38), 90000, hsa_p=fam_l - 2000, hsa_e=1000), person(birth_on(rng, y, 36), 70000, hsa_p=2500),
         'family', 'household 1,500 over, shared: both show 1,500 over'),
        (person(birth_on(rng, y, 47), 90000, hsa_p=self_l - 500, hsa_e=500), person(birth_on(rng, y, 45), 70000, hsa_p=2000),
         'self', 'self-only cover is A only: B is not eligible, B\'s 2,000 is all over'),
        (person(birth_on(rng, y, 57), 90000, hsa_e=self_l + 1000 + 250), person(birth_on(rng, y, 45), 70000), 'self',
         'employer money alone 250 over the limit with catch-up: income and payroll-tax wages'),
    ]
    for a, b, cov, label in rows:
        out.append(case(y, 'married_joint', a, b, coverage=cov, today=rand_date(rng, y), note=f'HSA {y}: {label}'))
    out.append(case(y, 'single', person(birth_on(rng, y, 33), 64000, hsa_p=1200, hsa_e=300), coverage='none',
                    today=rand_date(rng, y), note=f'HSA {y}: no high-deductible cover: all 1,500 is over'))
    out.append(case(y, 'head_of_household', person(birth_on(rng, y, 50), 64000, hsa_p=self_l), coverage='self',
                    today=rand_date(rng, y), note=f'HSA {y}: self-only at the limit, 50 is under the catch-up age'))
    if not published:
        for c in out:
            c['note'] += f' ({y}: Rev. Proc. 2026-24; only the HSA outputs and the deadline are published)'
    return out


def fica_edges(rng):
    out = []
    for y in YEARS:
        base = R.SS_WAGE_BASE[y]
        h = R.HSA_LIMIT[y][0]
        b40 = lambda: birth_on(rng, y, rng.randint(25, 54))  # noqa: E731
        rows = [
            ('single', base + h // 2, 'payroll-tax wages straddle the Social Security wage base'),
            ('single', base, 'pay exactly at the wage base: all the HSA money saves Social Security tax'),
            ('single', base + h, 'wages with the HSA money exactly at the wage base: no Social Security saved'),
            ('single', base + h + 1, 'above the wage base either way'),
            ('single', base + h - 1, '1 dollar under the wage base with the HSA money: 6.2% of 1'),
            ('single', 200000 + h // 2, 'straddles the 200,000 additional Medicare threshold'),
            ('single', 200000 + h, 'with the HSA money exactly at 200,000: all of it saves the 0.9%'),
            ('single', 200000, 'pay exactly 200,000: no additional Medicare either way'),
            ('head_of_household', 200000 + h // 2, 'head of household: the 200,000 threshold'),
        ]
        for fs, pay, label in rows:
            out.append(case(y, fs, person(b40(), pay, k401=rng.choice((0, 10000, R.ELECTIVE_DEFERRAL[y])), hsa_p=h),
                            coverage='self', today=rand_date(rng, y), note=f'payroll tax {y}, pay {pay:,}: {label}'))
        fam = R.HSA_LIMIT[y][1]
        ha, hb = fam // 2, fam - fam // 2
        out.append(case(y, 'married_joint', person(b40(), 150000, hsa_p=ha), person(b40(), 100000 + fam // 2, hsa_p=hb),
                        coverage='family', today=rand_date(rng, y),
                        note=f'payroll tax {y}: joint Medicare wages {250000 + fam // 2:,} without, straddling 250,000 combined'))
        out.append(case(y, 'married_joint', person(b40(), 190000, hsa_p=ha), person(b40(), 120000, hsa_p=hb),
                        coverage='family', today=rand_date(rng, y),
                        note=f'payroll tax {y}: each under 200,000 but 310,000 together: additional Medicare on the joint return'))
        out.append(case(y, 'married_separate', person(b40(), 125000 + ha // 2, hsa_p=ha), person(b40(), 90000, hsa_p=hb),
                        coverage='family', today=rand_date(rng, y),
                        note=f'payroll tax {y}: separate return, A straddles the 125,000 threshold'))
        out.append(case(y, 'married_joint', person(b40(), base + 1000, hsa_p=ha, hsa_e=500), person(b40(), 30000, hsa_p=hb - 500),
                        coverage='family', today=rand_date(rng, y),
                        note=f'payroll tax {y}: A straddles the wage base, B far under it'))
    return out


def fsa_edges(rng):
    out = []
    for y in YEARS:
        lim, co = R.FSA_LIMIT[y], R.FSA_CARRYOVER[y]
        rows = [(lim - 1, lim - 1, 'one under the limit, all spent'),
                (lim, lim - co, 'at the limit, unspent exactly the carryover: nothing lost'),
                (lim, lim - co - 1, 'at the limit, unspent 1 over the carryover'),
                (lim + 1, 0, 'one over the limit, nothing spent'),
                (lim + 600, 2000, '600 over the limit: the part over stays in wages'),
                (500, 100, 'a small election, 400 unspent')]
        for e, s, label in rows:
            fs = rng.choice(('single', 'head_of_household', 'married_joint'))
            b = person(birth_on(rng, y, rng.randint(22, 64)), 55000) if fs in MARRIED else None
            out.append(case(y, fs, person(birth_on(rng, y, rng.randint(25, 60)), 72000), b, fsa_e=e, fsa_s=s,
                            today=rand_date(rng, y), note=f'FSA {y}: elected {e:,}, spent {s:,}: {label}'))
        out.append(case(y, 'single', person(birth_on(rng, y, 37), 72000, hsa_p=2000), coverage='self', fsa_e=1500,
                        fsa_s=1500, today=rand_date(rng, y), note=f'FSA {y} with an HSA: the warning (223(c)(1))'))
        out.append(case(y, 'married_joint', person(birth_on(rng, y, 42), 82000), person(birth_on(rng, y, 40), 61000, hsa_e=1500),
                        coverage='family', fsa_e=2500, fsa_s=900, today=rand_date(rng, y),
                        note=f'FSA {y} through A, employer HSA money for B: the warning'))
    return out


def misc_edges(rng):
    out = []
    for y in YEARS:
        s, e = R.ROTH_PHASEOUT[y]['joint']
        a = {'age': 44, 'roth': ira_full(y, 44), 'k401': 8000}
        b = {'age': 41, 'roth': ira_full(y, 41)}
        c = for_magi(rng, y, 'married_joint', s + 4321, a, b, note='joint, lived_apart 1: ignored on a joint return')
        c['lived_apart'] = 1
        out.append(c)
        std = R.STANDARD_DEDUCTION[y]['single']
        h = R.HSA_LIMIT[y][0]
        upper = R.BRACKETS[y]['single'][1][0]
        out += [
            case(y, 'single', person(birth_on(rng, y, 24), 12000, hsa_p=1000), coverage='self', today=f'{y}-01-01',
                 note='taxable income 0 either way: no income tax saved; today is January 1'),
            case(y, 'single', person(birth_on(rng, y, 36), upper + std + h // 2, hsa_p=h), coverage='self',
                 today=f'{y}-12-31', note=f'the HSA money moves taxable income across {upper:,} (12% / 22%); today is December 31'),
            case(y, 'single', person(birth_on(rng, y, 47), 800000, k401=R.ELECTIVE_DEFERRAL[y], hsa_p=h), coverage='self',
                 today=rand_date(rng, y), note='37% bracket, above the wage base and the additional Medicare threshold'),
            case(y, 'married_separate', person(birth_on(rng, y, 39), 5000, roth=R.IRA_LIMIT[y]),
                 person(birth_on(rng, y, 37), 70000), other=F(1, 100), today=rand_date(rng, y),
                 note='separate: other income 0.01 split in half: A MAGI 5,000.005 (half a cent)'),
            case(y, 'married_separate', person(birth_on(rng, y, 52), 48000, k401=6000), person(birth_on(rng, y, 50), 52000),
                 other=F(123457, 100), today=rand_date(rng, y), note='separate: odd-cent other income 1,234.57 split in half'),
            case(y, 'head_of_household', person(birth_on(rng, y, 22, 'jan1'), 30000, roth=2000), today=rand_date(rng, y),
                 note='youngest age, January 1 birthday'),
            case(y, 'single', person(birth_on(rng, y, 64, 'dec31'), 95000, k401=k401_full(y, 64), hsa_p=hsa_cap(y, 'self', 64)),
                 coverage='self', today=f'{y}-01-01', note='oldest age (64 on December 31); today January 1'),
            case(y, 'married_joint', person(birth_on(rng, y, 33), 0), person(birth_on(rng, y, 35), 0), other=20000,
                 today=rand_date(rng, y), note='no pay at all: interest only, nothing from payroll'),
        ]
    return out


def hsa_2027_rows(rng):
    out = hsa_edges(rng, 2027)
    while len(out) < N_2027:
        out.append(random_2027(rng))
    return out


# ---------------------------------------- random rows ----------------------------------------

FS_WEIGHTS = (('single', 28), ('married_joint', 37), ('married_separate', 15), ('head_of_household', 20))
COV_WEIGHTS = {'single': (('none', 45), ('self', 45), ('family', 10)),
               'married_joint': (('none', 35), ('self', 25), ('family', 40)),
               'married_separate': (('none', 40), ('self', 25), ('family', 35)),
               'head_of_household': (('none', 35), ('self', 35), ('family', 30))}
MODES = (('none', 30), ('under', 35), ('at', 15), ('over_small', 12), ('over_large', 8))


def rand_age(rng):
    return rng.randint(22, 64) if rng.random() < 0.7 else rng.randint(48, 64)


def rand_birth(rng, y, age):
    by = y - age
    r = rng.random()
    if r < 0.04:
        return f'{by}-01-01'
    if r < 0.08:
        return f'{by}-12-31'
    if r < 0.11 and leap(by):
        return f'{by}-02-29'
    return rand_date(rng, by)


def rand_pay(rng, who):
    if who == 'B':
        r = rng.random()
        if r < 0.02:
            return ZERO
        if r < 0.07:
            return amount(rng, 1000, 15000)
    r = rng.random()
    if r < 0.08:
        return amount(rng, 15000, 45000)
    if r < 0.45:
        return amount(rng, 45000, 120000)
    if r < 0.75:
        return amount(rng, 120000, 200000)
    if r < 0.95:
        return amount(rng, 200000, 400000)
    return amount(rng, 400000, 800000)


def by_mode(rng, cap, mode=None):
    mode = mode or pick(rng, MODES)
    if mode == 'none':
        return ZERO
    if mode == 'under':
        return amount(rng, 1, cap - 1, cents=0.1) if rng.random() < 0.5 else F(rng.randint(1, cap // 50 - 1) * 50)
    if mode == 'at':
        return F(cap)
    if mode == 'over_small':
        return F(cap + rng.randint(1, 300))
    return F(cap + rng.randint(301, 5000))


def random_hsa(rng, y, fs, cov, age, avail):
    """(payroll, employer) per person, payroll never above what pay has left."""
    ppl = ('A', 'B') if fs in MARRIED else ('A',)
    self_l, fam_l = R.HSA_LIMIT[y]
    tot = {p: ZERO for p in ppl}
    if cov == 'family' and fs in MARRIED:
        cu = {p: 1000 if age[p] >= 55 else 0 for p in ppl}
        hh = fam_l + sum(cu.values())
        T = by_mode(rng, hh, pick(rng, (('none', 10), ('under', 40), ('at', 25), ('over_small', 15), ('over_large', 10))))
        rest = T
        for p in ppl:            # a spouse 55 or over usually puts in their own catch-up first
            if cu[p] and rng.random() < 0.8:
                give = min(rest, F(cu[p]))
                tot[p] += give
                rest -= give
        frac = F(rng.randint(0, 10), 10)
        part = (rest * frac).__floor__()
        tot['A'] += part
        tot['B'] += rest - part
    else:
        for p in ppl:
            elig = cov == 'family' or (cov == 'self' and p == 'A')
            if elig:
                tot[p] = by_mode(rng, hsa_cap(y, cov, age[p]))
            elif rng.random() < 0.03:
                tot[p] = F(rng.randint(200, 3000))
    out = {}
    for p in ppl:
        pp, ee = hsa_split(rng, tot[p])
        pp = min(pp, avail[p])
        out[p] = (pp, ee)
    return out


def random_case(rng, y):
    fs = pick(rng, FS_WEIGHTS)
    married = fs in MARRIED
    apart = (1 if rng.random() < 0.5 else 0) if fs == 'married_separate' else 0
    cov = pick(rng, COV_WEIGHTS[fs])
    ppl = ('A', 'B') if married else ('A',)
    age = {p: rand_age(rng) for p in ppl}
    birth = {p: rand_birth(rng, y, age[p]) for p in ppl}
    pay = {p: rand_pay(rng, p) for p in ppl}
    avail = dict(pay)
    fsa_e = fsa_s = ZERO
    if (cov == 'none' and rng.random() < 0.25) or rng.random() < 0.02:
        fsa_e = min(by_mode(rng, R.FSA_LIMIT[y], pick(rng, (('under', 60), ('at', 25), ('over_small', 10),
                                                           ('over_large', 5)))), avail['A'])
        fsa_s = pick(rng, ((fsa_e, 40), ((fsa_e * rng.randint(0, 99) / 100).__floor__(), 60)))
        avail['A'] -= fsa_e
    hsa = random_hsa(rng, y, fs, cov, age, avail)
    h = {}
    for p in ppl:
        avail[p] -= hsa[p][0]
        tot = min(by_mode(rng, k401_full(y, age[p]), pick(rng, (('none', 28), ('under', 37), ('at', 20),
                                                              ('over_small', 9), ('over_large', 6)))), avail[p])
        if rng.random() < 0.05 and age[p] >= 50:      # at the 402(g) limit without using the catch-up
            tot = min(F(R.ELECTIVE_DEFERRAL[y]), avail[p])
        split = pick(rng, (('pre', 55), ('roth', 15), ('mixed', 30)))
        roth401 = tot if split == 'roth' else ZERO if split == 'pre' else (tot * rng.randint(1, 9) // 10 // 100) * 100
        match = ZERO
        if tot > 0:
            r = rng.random()
            if r < 0.55:
                match = (pay[p] * rng.randint(2, 6) / 100).__floor__()
            elif r < 0.65:
                match = F(rng.randint(1000, 6000))
            elif r < 0.70:
                match = max(ZERO, R.ANNUAL_ADDITIONS[y] - min(tot, R.ELECTIVE_DEFERRAL[y]) + rng.randint(-1000, 1500))
        L = ira_full(y, age[p])
        itot = by_mode(rng, L, pick(rng, (('none', 35), ('under', 30), ('at', 20), ('over_small', 10), ('over_large', 5))))
        ikind = pick(rng, (('trad', 30), ('roth', 45), ('both', 25)))
        trad = itot if ikind == 'trad' else ZERO if ikind == 'roth' else F(rng.randint(0, int(itot)))
        h[p] = person(birth[p], pay[p], k401=tot - roth401, roth401k=roth401, match=match, trad=trad, roth=itot - trad,
                      hsa_p=hsa[p][0], hsa_e=hsa[p][1])
    r = rng.random()
    other = ZERO if r < 0.4 else amount(rng, 0, 2000, cents=0.8) if r < 0.8 else \
        amount(rng, 2000, 30000, cents=0.5) if r < 0.95 else amount(rng, 30000, 150000)
    return case(y, fs, h['A'], h.get('B'), apart=apart, coverage=cov, other=other, fsa_e=fsa_e, fsa_s=fsa_s,
                today=rand_date(rng, y))


def random_2027(rng):
    y = 2027
    fs = pick(rng, FS_WEIGHTS)
    married = fs in MARRIED
    apart = (1 if rng.random() < 0.5 else 0) if fs == 'married_separate' else 0
    cov = pick(rng, (('self', 45), ('family', 45), ('none', 10)))
    ppl = ('A', 'B') if married else ('A',)
    age = {p: rand_age(rng) for p in ppl}
    pay = {p: rand_pay(rng, p) for p in ppl}
    hsa = random_hsa(rng, y, fs, cov, age, dict(pay))
    h = {p: person(rand_birth(rng, y, age[p]), pay[p], hsa_p=hsa[p][0], hsa_e=hsa[p][1]) for p in ppl}
    other = ZERO if rng.random() < 0.5 else amount(rng, 0, 5000, cents=0.8)
    return case(y, fs, h['A'], h.get('B'), apart=apart, coverage=cov, other=other, today=rand_date(rng, y))


def on_a_line(c, d):
    """A random row that sits exactly on a range line, within $0.000001 of a $10 step of an exact phase-out reduction,
    or on a half of Pub. 590-A's three-place ratio, is redrawn (those belong to the labelled edge rows)."""
    y, fs = c['year'], c['filing_status']
    if y not in R.ELECTIVE_DEFERRAL:
        return False
    apart = fs == 'married_separate' and c['lived_apart'] == 1
    for p in people(c):
        lo = p.lower() + '_'
        x = d[lo + 'magi']
        L = d[lo + 'ira_limit'] + d[lo + 'ira_catch_up']
        q = 'b_' if p == 'A' else 'a_'
        spouse_active = d.get(q + 'active_participant') or 0
        ranges = [R.roth_range(y, fs, apart)]
        tr = R.trad_range(y, fs, apart, d[lo + 'active_participant'], spouse_active)
        if tr is not None:
            ranges.append(tr)
        for s, e in ranges:
            if x in (s, e):
                return True
            if s < x < e:
                red = L * (x - s) / (e - s)
                rem = red % 10
                if min(rem, 10 - rem) < STEP_MARGIN:
                    return True
                if ((x - s) / (e - s) * 1000 % 1) == F(1, 2):
                    return True
    return False


# ======================================== coverage ========================================

def edge_kind(birth):
    md = birth[5:]
    return {'01-01': 'January 1', '12-31': 'December 31', '02-29': 'February 29'}.get(md)


def stats(s, c, d):
    y, fs = c['year'], c['filing_status']
    s[f'year {y}'] += 1
    s[f'filing status {fs}' + (f" ({'apart' if c['lived_apart'] else 'together'})" if fs == 'married_separate' else '')] += 1
    s[f'adults {len(people(c))}'] += 1
    s[f'coverage {c["coverage"]}'] += 1
    for p in people(c):
        lo = p.lower() + '_'
        h = c[p]
        age = d[lo + 'age']
        s['adults'] += 1
        if age in EDGE_AGES:
            s[f'adults reaching {age} in the year'] += 1
        kind = edge_kind(h['birth'])
        if kind:
            s[f'birthdays on {kind}'] += 1
            if age in EDGE_AGES:
                s[f'edge-age adults born on {kind}'] += 1
        if age in EDGE_AGES and c['today'][5:] < h['birth'][5:]:
            s['edge-age adults whose "today" is before the birthday'] += 1
        if y in YEARS:
            s['adults with pay above the wage base' if h['pay'] > R.SS_WAGE_BASE[y]
              else 'adults with pay at or under the wage base'] += 1
        if d[lo + 'hsa_used'] > 0:
            s['adults with HSA money'] += 1
            s['adults with HSA money: room 0 and nothing over (exactly at their limit)'] += (d[lo + 'hsa_room'] == 0 and d[lo + 'hsa_over'] == 0)
            s['adults with HSA money: over their limit'] += d[lo + 'hsa_over'] > 0
            s['adults with HSA money but not eligible'] += d[lo + 'hsa_eligible'] == 0
        s['adults with employer HSA money'] += h['hsa_employer'] > 0
        if y not in R.ELECTIVE_DEFERRAL:
            continue
        used, room, over = d[lo + 'k401_used'], d[lo + 'k401_room'], d[lo + 'k401_over']
        if used > 0:
            s['401(k): ' + ('exactly at the limit' if room == 0 and over == 0 else 'over' if over > 0 else 'under')] += 1
        s['401(k): over and covered by Roth money (in income < over)'] += over > 0 and d[lo + 'k401_in_income'] < over
        s['401(k): excess deferral in income'] += d[lo + 'k401_in_income'] > 0
        s['401(k): catch-up 60-63'] += d[lo + 'k401_catch_up'] == R.CATCH_UP_60_63[y] and used > 0
        s['401(k): catch-up capped by pay'] += 0 < d[lo + 'k401_catch_up'] < (R.CATCH_UP_60_63[y] if 60 <= age <= 63 else R.CATCH_UP_50[y])
        s['401(k): Roth 401(k) with a match'] += h['roth401k'] > 0 and h['k401_match'] > 0
        s['401(k): Roth 401(k) without a match'] += h['roth401k'] > 0 and h['k401_match'] == 0
        s['415(c) exceeded (contrast)'] += d[lo + 'exceeds_415c']
        iu, ir, io = d[lo + 'ira_used'], d[lo + 'ira_room'], d[lo + 'ira_over']
        if iu > 0:
            s['IRA: ' + ('exactly at the limit' if ir == 0 and io == 0 else 'over' if io > 0 else 'under')] += 1
        s['IRA: compensation short (recorded)'] += d[lo + 'ira_comp_ok'] == 0 and iu > 0
        kind = 'joint' if fs == 'married_joint' else ('separate' if fs == 'married_separate' and not c['lived_apart'] else 'single')
        s[f'Roth range {kind}: {d[lo + "roth_status"]}'] += 1
        st, en = R.ROTH_PHASEOUT[y][kind]
        x = d[lo + 'magi']
        s[f'Roth range {kind}: MAGI exactly at the start'] += x == st
        s[f'Roth range {kind}: MAGI exactly at the end'] += x == en
        L = d[lo + 'ira_limit'] + d[lo + 'ira_catch_up']
        if st < x < en:
            raw = L - L * (x - st) / (en - st)
            red = L * (x - st) / (en - st)
            s['Roth partial: limit raised to the $200 floor'] += raw < 200 and d[lo + 'roth_reduced_limit'] == 200
            s['Roth partial: reduction rounded down (not a multiple of $10)'] += red % 10 != 0
            s['Roth partial: reduction exactly a multiple of $10'] += red % 10 == 0
            s['Roth partial: three-place worksheet gives another amount'] += d[lo + 'roth_allowed_worksheet'] != d[lo + 'roth_allowed']
        s['Roth: allowed held down by traditional money'] += 0 < L - h['trad_ira'] < d[lo + 'roth_reduced_limit']
        s['Roth: money over the allowed amount'] += d[lo + 'roth_over'] > 0
        s['traditional IRA: real deduction below the page\'s (contrast)'] += d[lo + 'trad_ira_deductible'] < d[lo + 'trad_ira_page_deduction']
        s['adults whose MAGI has half a cent'] += (x * 100).denominator == 2
    if c['coverage'] == 'family' and fs in MARRIED:
        n55 = sum(d[p + '_age'] >= 55 for p in 'ab')
        s[f'family HSA, married, spouses 55+: {n55}'] += 1
    s['household HSA over its limit'] += d['hsa_over_household'] > 0
    s['HSA money that must come out above the household over (a stranded catch-up)'] += d['hsa_excess_to_remove'] > d['hsa_over_household']
    if y not in R.ELECTIVE_DEFERRAL:
        return
    if sum(c[p]['hsa_payroll'] for p in people(c)) > 0:
        s['rows with HSA payroll money'] += 1
        s['HSA payroll money: no Social Security saved (above the wage base)'] += d['fica_saved_ss'] == 0
        s['HSA payroll money: additional Medicare saved'] += d['addl_medicare_saved'] > 0
        s['HSA payroll money: the flat 7.65% differs from fica_saved'] += d['fica_saved_flat'] != d['fica_saved']
        s['HSA payroll money: some of it over the limit'] += sum(d[p + '_hsa_excess'] or 0 for p in 'ab') > 0
        s['HSA payroll money: no income tax saved'] += d['income_tax_saved'] == 0
    if c['fsa_election'] > 0:
        s['FSA rows'] += 1
        s['FSA over the limit'] += d['fsa_over'] > 0
        s['FSA unspent above the carryover'] += d['fsa_forfeit'] > 0
        s['FSA with an HSA (the warning)'] += d['fsa_with_hsa']
    s['written amounts exactly on a half cent before rounding'] += sum(half_cent(d[k]) for k in MONEY_COLS)


REQUIRED = [   # coverage the brief asks for; the run stops if any is missing
    'adults reaching 49 in the year', 'adults reaching 50 in the year', 'adults reaching 54 in the year',
    'adults reaching 55 in the year', 'adults reaching 59 in the year', 'adults reaching 60 in the year',
    'adults reaching 63 in the year', 'adults reaching 64 in the year', 'birthdays on January 1',
    'birthdays on December 31', 'birthdays on February 29', 'edge-age adults born on February 29',
    'edge-age adults whose "today" is before the birthday',
    'filing status married_separate (apart)', 'filing status married_separate (together)',
    'filing status single', 'filing status head_of_household', 'filing status married_joint',
    'Roth range joint: ok', 'Roth range joint: partial', 'Roth range joint: over',
    'Roth range single: ok', 'Roth range single: partial', 'Roth range single: over',
    'Roth range separate: ok', 'Roth range separate: partial', 'Roth range separate: over',
    'Roth range joint: MAGI exactly at the start', 'Roth range single: MAGI exactly at the end',
    'Roth partial: limit raised to the $200 floor', 'Roth partial: three-place worksheet gives another amount',
    '401(k): exactly at the limit', '401(k): over', '401(k): under', '401(k): excess deferral in income',
    '401(k): over and covered by Roth money (in income < over)', '401(k): catch-up capped by pay',
    '401(k): Roth 401(k) with a match', '401(k): Roth 401(k) without a match', '415(c) exceeded (contrast)',
    'IRA: exactly at the limit', 'IRA: over', 'IRA: under',
    'adults with HSA money: room 0 and nothing over (exactly at their limit)', 'adults with HSA money: over their limit',
    'adults with employer HSA money', 'family HSA, married, spouses 55+: 1', 'family HSA, married, spouses 55+: 2',
    'HSA money that must come out above the household over (a stranded catch-up)',
    'adults with pay above the wage base', 'HSA payroll money: no Social Security saved (above the wage base)',
    'HSA payroll money: additional Medicare saved', 'FSA rows', 'FSA over the limit', 'FSA with an HSA (the warning)',
    'year 2027',
]


# ======================================== run ========================================

def row_out(c, d):
    r = {'case_id': c['id'], 'year': c['year'], 'today': c['today'], 'filing_status': c['filing_status'],
         'lived_apart': c['lived_apart'], 'coverage': c['coverage'], 'other_income': money(c['other_income']),
         'fsa_election': money(c['fsa_election']), 'fsa_spent': money(c['fsa_spent']), 'note': c['note']}
    for p in 'AB':
        lo = p.lower() + '_'
        h = c[p]
        r[lo + 'birth'] = h['birth'] if h else ''
        for k in FIELDS:
            r[lo + k] = money(h[k]) if h else ''
    for k in OUTPUT_COLS:
        val = d[k]
        r[k] = '' if val is None else (money(val) if is_money(k) else str(val))
    return r


def build(rng, guard):
    edges = []
    edges += example_and_age_edges(rng)
    edges += roth_edges(rng)
    edges += trad_edges(rng)
    edges += k401_edges(rng)
    edges += ira_edges(rng)
    for y in YEARS:
        edges += hsa_edges(rng, y)
    edges += fica_edges(rng)
    edges += fsa_edges(rng)
    edges += misc_edges(rng)
    rows_2027 = hsa_2027_rows(rng)
    n_edge = len(edges) + len(rows_2027) - sum(1 for c in rows_2027 if not c['note'])
    per_year = (N_ROWS - len(rows_2027)) // 2
    want = {y: per_year - sum(1 for c in edges if c['year'] == y) for y in YEARS}
    assert sum(want.values()) + len(edges) + len(rows_2027) == N_ROWS and min(want.values()) > 0
    years = [y for y in YEARS for _ in range(want[y])]
    rng.shuffle(years)
    s = Counter()
    worked = []
    fixed = edges + rows_2027
    for i, c in enumerate(fixed, 1):
        c['id'] = case_id(c, i)
    for c in fixed:
        validate(c)
        d1, d2 = work1(c), work2(c)
        guard.compare(c['id'], d1, d2)
        if '_target' in c:
            key = 'magi' if c['filing_status'] == 'married_joint' else 'a_magi'
            assert d1[key] == c['_target'], ('MAGI target missed', c['note'], d1[key], c['_target'])
        worked.append((c, d1))
    draws = redrawn = 0
    for k, y in enumerate(years, len(fixed) + 1):
        tries = 0
        while True:
            c = random_case(rng, y)
            c['id'] = case_id(c, k)
            draws += 1
            tries += 1
            validate(c)
            d1, d2 = work1(c), work2(c)
            guard.compare(c['id'] + (f' (draw {tries})' if tries > 1 else ''), d1, d2)
            if on_a_line(c, d1):
                redrawn += 1
                continue
            break
        worked.append((c, d1))
    # order: the 2025-2026 edge rows, the 2027 rows (edge, then random), the 2025-2026 random rows
    rows = []
    for c, d in worked:
        rows.append(row_out(c, d))
        stats(s, c, d)
    s['edge rows (labelled in note)'] = n_edge
    s['random rows'] = N_ROWS - n_edge
    s['random draws'] = draws
    s['random draws redrawn (on a line or a $10 step)'] = redrawn
    return rows, s


def case_id(c, i):
    return f'limits-{c["year"]}-{ABBR[c["filing_status"]]}-{i:04d}'


def write_csv(path, rows):
    with path.open('w', newline='', encoding='utf-8') as fh:
        w = csv.DictWriter(fh, fieldnames=COLUMNS, lineterminator='\n')
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
    if not skip_examples:
        try:
            n_ex = check_examples()
        except AssertionError as e:
            raise SystemExit(f'RULES.md examples check failed in derivation 2: {e.args}; no CSV written')
        print(f'RULES.md worked examples reproduced by derivation 2: {n_ex} assertions')
    guard = Guard()
    rows, s = build(random.Random(SEED), guard)
    assert len(rows) == N_ROWS and len({r['case_id'] for r in rows}) == N_ROWS
    missing = [k for k in REQUIRED if s[k] == 0]
    if missing:
        raise SystemExit(f'coverage missing: {missing}; no CSV written')
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    write_csv(out_dir / CSV_NAME, rows)
    print(f'wrote {out_dir / CSV_NAME}: {len(rows)} rows, {len(COLUMNS)} columns; both derivations agree; '
          f'largest gap before rounding {float(guard.max_gap):.3g}')
    for key in sorted(guard.n):
        print(f'  check: {key}: {guard.n[key]}')
    for key in sorted(s):
        print(f'  {key}: {s[key]}')
    print(f'total {time.time() - t0:.1f} s')


if __name__ == '__main__':
    main(sys.argv[1:])
