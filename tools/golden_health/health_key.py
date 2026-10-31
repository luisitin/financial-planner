"""Health answer key: Marketplace premium tax credit, Medicare IRMAA, high-deductible plans. Three CSVs of invented rows.

Run:  python3 tools/golden_health/health_key.py [out_dir] [--mutate NAME] [--skip-examples]
Writes tests/golden/health/ptc.csv (2,000 rows), irmaa.csv (1,500) and hdhp.csv (1,000). Standard library only,
exact arithmetic (fractions.Fraction), deterministic (random.Random(20261031)). The figures and the model come from
rules.py next to this file; the sources and the reasons are in tests/golden/health/RULES.md and in README.md here.
Nothing under modules/, core/ or tests/*.test.mjs was opened, and the app is never imported.

Model (the page READMEs, made exact by rules.py; where the law differs the main columns follow the law and a
contrast column gives the page's literal reading):
  * Marketplace: income as a multiple of the HHS poverty guideline (48 states and DC) published before open enrollment
    (coverage 2026 -> 2025 guideline, 2027 -> 2026); the applicable percentage straight-line inside its band
    ("at least" the lower line, "less than" the upper line; 300-400 takes 400 itself), rounded to 0.01 of a point,
    half up (26 CFR 1.36B-3(g)(1)); contribution = percentage x income; benchmark = 12 x B40 / 1.278 x the sum of the
    covered people's federal default age factors, counting only the three oldest children under 21 (45 CFR
    147.102(c)(1)); credit = max(0, benchmark - contribution); no credit under 100% or over 400% (the law for 2026 and
    2027). Enhanced (2021-2025 table, no cliff, 8.5% cap) as a what-if. Contrasts: the percentage unrounded, every
    child counted, no 100% floor, and the Form 8962 method (whole percent, whole dollars).
  * Medicare IRMAA 2026: the tier from MAGI two years back by filing status; the next-to-top line is "less than"
    (so exactly $500,000 / $750,000 / $391,000 is the top tier); surcharge a year = (Part B over the standard + Part
    D add-on) x 12 x people. Contrast: "first line at or under" read literally (the page itself stores
    $499,999.99 / $749,999.99 / $390,999.99, so it agrees with the law). 2027 is not published, so no 2027 rows.
  * High-deductible plans: out of pocket = min(oopMax, min(m, deductible) + coinsurance x max(0, m - deductible)),
    no cap when oopMax is blank; HSA eligibility for 2026 and 2027 (deductible not less than the minimum, out-of-pocket
    maximum not more than the limit; blank oopMax = no limit unless coinsurance is 0).

Two derivations of every value, run on every row (kept or redrawn) before anything is written:
  derivation 1  rules.py: premium_tax_credit, applicable_percentage, benchmark_annual, counted_factors, irmaa_row,
                irmaa_monthly, irmaa_surcharge_annual, hdhp_out_of_pocket, hsa_eligible.
  derivation 2  this file, written separately in integer cents and hundredths of a percentage point: the guideline
                as first person + step x (size - 1) for the year before coverage; the band by bisection; the
                percentage as an integer fraction rounded with floor((2n + d) / 2d); the benchmark from integer
                thousandths with the three largest under-21 factors; the IRMAA amounts rebuilt from the statute
                (200% of the aged actuarial rate x 35/50/65/80/85% + the repayment amount, rounded to 10 cents; Part
                D = (pct - 25.5) / 25.5 x the base premium, rounded to 10 cents), the joint and separate lines built
                from the single ones, the tier by counting lines passed; the out of pocket piecewise in cents.
The script refuses to write any CSV if an amount differs by more than a cent, or any other value (poverty line,
band, percentage, tier, eligibility) differs at all, between the two. All three CSVs are worked first and written
only if all three pass. --mutate NAME puts one deliberate mistake into derivation 2 (see MUTATIONS) to show the
guard refuses; --skip-examples turns off the RULES.md examples check so the row guard has to find it alone.
"""
import sys
sys.dont_write_bytecode = True  # before importing rules.py, so no __pycache__ lands in the repo

import csv
import math
import random
import time
from bisect import bisect_right
from collections import Counter
from decimal import Decimal as D
from fractions import Fraction as F
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import rules as R  # noqa: E402  (importing it runs rules.check_tables())

ROOT = HERE.parents[1]
OUT_DIR = ROOT / 'tests' / 'golden' / 'health'
SEED = 20261031
N_PTC, N_IRMAA, N_HDHP = 2000, 1500, 1000
ZERO, HALF, CENT = F(0), F(1, 2), F(1, 100)
TIE_MARGIN = F(1, 10 ** 7)   # random rows: unrounded percentage within 1e-7 hundredths (1e-9 points) of a half -> redrawn

# Years. 2027 Marketplace rows only because Rev. Proc. 2026-26 published the 2027 table (rules.AP_LAW[2027]);
# no 2027 IRMAA rows because CMS had not published them (rules.IRMAA_2027_PUBLISHED is False).
PTC_YEARS = tuple(y for y in sorted(R.AP_LAW) if y >= 2026 and y in R.POVERTY_YEAR_FOR_COVERAGE)
IRMAA_YEARS = tuple(sorted(R.IRMAA))
HSA_YEARS = tuple(sorted(R.HDHP))
assert PTC_YEARS == (2026, 2027) and IRMAA_YEARS == (2026,) and HSA_YEARS == (2026, 2027)
assert R.IRMAA_2027_PUBLISHED is False and R.ENHANCED_EXTENDED_PAST_2025 is False
EDGES = (100, 133, 150, 200, 250, 300, 400)   # % of the poverty line: the 100% floor, every band line, the 400% cliff
STATUS_RULES = {'single': 'single', 'joint': 'joint', 'separate': 'mfs'}   # separate = married filing separately, lived with the spouse
NO_LIMIT = 'no out-of-pocket limit'

MUTATIONS = {
    'pct_truncated': 'applicable percentage truncated to 0.01 instead of rounded half up',
    'pct_half_even': 'applicable percentage ties rounded to even',
    'edge_133_lower': 'exactly 133% put in the lower band (2.10%)',
    'cliff_at_400': 'exactly 400% gets no credit',
    'guideline_same_year': "the poverty guideline of the coverage year itself",
    'all_children': 'every child counted (no three-oldest-under-21 cap)',
    'irmaa_top_at_or_under': "IRMAA next-to-top line read 'at or under'",
    'part_d_to_cent': 'Part D add-on rounded to the cent instead of 10 cents',
    'coinsurance_on_all_bills': 'coinsurance charged on all the bills once past the deductible',
    'hsa_lines_exclusive': 'HSA minimum deductible exclusive (must be over it)',
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


def rhu(x):
    """Round an exact value to an integer, halves away from zero (half up for the non-negative values here)."""
    x = fr(x)
    n = math.floor(abs(x) + HALF)
    return -n if x < 0 else n


def to_cents(x):
    return rhu(fr(x) * 100)


def money(x):
    """Dollars with two decimals, half up; '' for None."""
    if x is None:
        return ''
    c = to_cents(x)
    sign = '-' if c < 0 else ''
    c = abs(c)
    return f'{sign}{c // 100}.{c % 100:02d}'


def fixed(x, places):
    """An exact value written with `places` decimals, half up (display only)."""
    if x is None:
        return ''
    q = rhu(fr(x) * 10 ** places)
    sign = '-' if q < 0 else ''
    q = abs(q)
    if places == 0:
        return f'{sign}{q}'
    return f'{sign}{q // 10 ** places}.{q % 10 ** places:0{places}d}'


def int_cents(x):
    c = fr(x) * 100
    assert c.denominator == 1, x
    return int(c)


def hundredths(s):
    """'8.44' (a percent) -> 844 (hundredths of a percentage point), exactly."""
    v = fr(s) * 100
    assert v.denominator == 1, s
    return int(v)


def thousandths(s):
    v = fr(s) * 1000
    assert v.denominator == 1, s
    return int(v)


def half_cent(x):
    return x is not None and (fr(x) * 100).denominator == 2


class Guard:
    """Compares derivation 1 with derivation 2. An amount more than a cent apart, or any other value that differs at
    all, stops the run before a CSV is written."""

    def __init__(self, name):
        self.name = name
        self.n = Counter()
        self.max_gap = ZERO

    def _stop(self, where, what, a, b):
        raise SystemExit(f'{self.name} {where} {what}: derivation 1 gives {a}, derivation 2 gives {b}; no CSV written')

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
        if gap > CENT or abs(to_cents(fa) - to_cents(fb)) > 1:
            self._stop(where, what, money(fa), money(fb))
        self.max_gap = max(self.max_gap, gap)
        self.n['amounts that differ at all before rounding'] += gap != 0
        self.n['amounts whose written cents differ'] += to_cents(fa) != to_cents(fb)


# ============================ derivation 1: rules.py ============================

def band_label(p, has_cliff=True):
    """Band of p (% of the poverty line) in the page's words: under 100, 100-133, ..., 300-400, over 400."""
    if p < R.APPLICANT_FLOOR_PCT:
        return 'under 100'
    if has_cliff and p > R.LAW_CLIFF_PCT:
        return 'over 400'
    lows = (100, 133, 150, 200, 250, 300)
    highs = (133, 150, 200, 250, 300, 400)
    for lo, hi in zip(lows, highs):
        if lo <= p < hi or (hi == 400 and p == 400):
            return f'{lo}-{hi}'
    return 'over 400'


def ptc_1(c):
    y, n, magi, ad, kd, b40 = c['year'], c['n'], c['magi'], c['adults'], c['kids'], c['b40']
    bench = R.benchmark_annual(b40, ad, kd)
    bench_all = R.benchmark_annual(b40, ad, kd, child_cap=False)
    law = R.premium_tax_credit(magi, n, bench, y)
    p = law['pct_of_fpl']
    out = {'fpl_year': law['fpl_year'], 'fpl': law['fpl'], 'multiple': law['multiple'],
           'band': band_label(p),
           'eligible': law['eligible'], 'pct': law['applicable_pct'], 'contribution': law['contribution'],
           'bench': bench, 'credit': law['credit'], 'bench_all': bench_all}
    if law['eligible']:
        pu = R.applicable_percentage(p, R.AP_LAW[y], True, rounded=False)
        cu = magi * pu / 100
        out.update(pct_u=pu, contribution_u=cu, credit_u=max(ZERO, bench - cu))
    else:
        out.update(pct_u=None, contribution_u=None, credit_u=ZERO)
    enh = R.premium_tax_credit(magi, n, bench, y, rules='enhanced')
    out.update(enh_pct=enh['applicable_pct'], enh_contribution=enh['contribution'], enh_credit=enh['credit'])
    out['credit_nofloor'] = R.premium_tax_credit(magi, n, bench, y, floor_100=False)['credit']
    out['credit_all'] = R.premium_tax_credit(magi, n, bench_all, y)['credit']
    form = R.premium_tax_credit(magi, n, bench, y, method='form')
    out.update(form_p=form['pct_of_fpl'], form_pct=form['applicable_pct'], form_contribution=form['contribution'],
               form_credit=form['credit'])
    out['factors'] = [R.age_factor(a) for a in list(ad) + list(kd)]
    out['not_counted'] = len(out['factors']) - len(R.counted_factors(ad, kd))
    return out


def irmaa_1(c):
    y, st, magi, people = c['year'], STATUS_RULES[c['status']], c['magi'], c['people']
    level, row = R.irmaa_row(magi, st, y)
    b_irmaa, d_irmaa = R.irmaa_monthly(magi, st, y)
    aou_level, _ = R.irmaa_row(magi, st, y, at_or_under=True)
    return {'magi_year': y - R.IRMAA_MAGI_LOOKBACK_YEARS, 'tier': level, 'b_total': fr(row[2]), 'b_irmaa': b_irmaa,
            'd_irmaa': d_irmaa, 'month': b_irmaa + d_irmaa,
            'year_person': R.irmaa_surcharge_annual(magi, st, 1, y),
            'year_household': R.irmaa_surcharge_annual(magi, st, people, y),
            'year_b_only': R.irmaa_surcharge_annual(magi, st, 1, y, part_d=False),
            'aou_tier': aou_level, 'aou_year_person': R.irmaa_surcharge_annual(magi, st, 1, y, at_or_under=True)}


def hsa_1(d, cap, co, cov, year):
    if cap is None:
        if co > 0:   # coinsurance with no cap: the member's share has no ceiling, so there is no out-of-pocket maximum
            ok, why = R.hsa_eligible(d, R.HDHP[year][cov][1], cov, year)   # the deductible test alone
            return (False, why) if not ok else (False, NO_LIMIT)
        cap = d      # no coinsurance: the member never pays more than the deductible
    return R.hsa_eligible(d, cap, cov, year)


def hdhp_1(c):
    m, d, co, cap, cov = c['bills'], c['deductible'], c['coinsurance'], c['oop_max'], c['coverage']
    # With no cap, min(m, d) + co x max(0, m - d) <= m (co <= 1), so a cap of m itself changes nothing.
    oop = R.hdhp_out_of_pocket(m, d, co, cap if cap is not None else m)
    out = {'oop': oop}
    for y in HSA_YEARS:
        out[f'hsa_{y}'] = hsa_1(d, cap, co, cov, y)
        out[f'limit_{y}'] = R.hsa_limit(cov, y)
    uncapped = min(m, d) + co * max(ZERO, m - d)
    out['phase'] = 'capped' if cap is not None and uncapped >= cap else ('deductible' if m <= d else 'coinsurance')
    return out


# ============================ derivation 2: written separately ============================

# Age factors in thousandths, indexed by age 0..64 (64 = "64 and older"); 0..14 share one band.
FACT = [thousandths(R.AGE_CURVE[0 if a <= 14 else a]) for a in range(65)]
FACT40 = FACT[40]
assert FACT40 == 1278


def factor_2(age):
    return FACT[min(age, 64)]


def counted_thousandths(adults, kids):
    """Sum of factors in thousandths: every adult and every child 21 or over, plus the three largest factors among
    the children under 21 (the curve never falls with age, so these are the three oldest)."""
    young = sorted((factor_2(a) for a in kids if a < 21), reverse=True)
    if MUT != 'all_children':
        young = young[:3]
    return sum(factor_2(a) for a in adults) + sum(factor_2(a) for a in kids if a >= 21) + sum(young)


def fpl_2(cov_year, n):
    """(guideline in dollars, guideline year): the year before coverage, first person + step x (size - 1)."""
    gy = cov_year if MUT == 'guideline_same_year' else cov_year - 1
    table, step = R.POVERTY[gy]['contiguous']
    return table[0] + step * (n - 1), gy


def _rows_2(table):
    return [(lo, hi, hundredths(a), hundredths(b)) for lo, hi, a, b in table]


LAW_2 = {y: _rows_2(R.AP_LAW[y]) for y in PTC_YEARS}
ENH_2 = _rows_2(R.AP_ENHANCED[:-1])
ENH_TOP = hundredths(R.AP_ENHANCED[-1][2])
assert ENH_TOP == hundredths(R.AP_ENHANCED[-1][3]) == 850 and R.AP_ENHANCED[-1][0] == 400


def round_h(x):
    """Unrounded hundredths (Fraction) -> integer hundredths, half up: floor((2n + d) / 2d)."""
    n, d = x.numerator, x.denominator
    if MUT == 'pct_truncated':
        return n // d
    if MUT == 'pct_half_even' and 2 * (n % d) == d:
        k = n // d
        return k if k % 2 == 0 else k + 1
    return (2 * n + d) // (2 * d)


def pct_2(p, year=None, enhanced=False):
    """(unrounded hundredths, rounded hundredths) at p % of the poverty line, or None over the law's 400% line."""
    if enhanced:
        if p >= 400:
            return F(ENH_TOP), ENH_TOP
        rows = ENH_2
    else:
        if p > 400 or (MUT == 'cliff_at_400' and p == 400):
            return None
        rows = LAW_2[year]
    i = bisect_right([r[0] for r in rows], p) - 1
    if MUT == 'edge_133_lower' and p == 133 and not enhanced:
        i -= 1
    lo, hi, a, b = rows[i]
    x = F(a) if a == b else a + F(b - a) * (p - lo) / (hi - lo)
    return x, round_h(x)


def band_2(p):
    if p < 100:
        return 'under 100'
    if p > 400:
        return 'over 400'
    k = bisect_right(EDGES, p) - 1     # EDGES = 100, 133, 150, 200, 250, 300, 400
    k = min(k, len(EDGES) - 2)         # exactly 400 belongs to 300-400
    return f'{EDGES[k]}-{EDGES[k + 1]}'


def ptc_2(c):
    """Everything in cents (contribution, benchmark, credit) and hundredths of a point (percentages)."""
    L, gy = fpl_2(c['year'], c['n'])
    M = int_cents(c['magi'])
    p = F(M, L)                                    # % of the poverty line: 100 x (M / 100) / L
    B40 = int_cents(c['b40'])
    t = counted_thousandths(c['adults'], c['kids'])
    t_all = sum(factor_2(a) for a in list(c['adults']) + list(c['kids']))
    bench = F(12 * B40 * t, FACT40)                # cents
    bench_all = F(12 * B40 * t_all, FACT40)
    out = {'fpl_year': gy, 'fpl': F(L), 'multiple': F(M, 100 * L), 'band': band_2(p), 'bench': bench / 100,
           'bench_all': bench_all / 100}

    def credit_at(r, bench_c):
        contribution = F(M * r, 10000)             # cents: (M / 100) x (r / 10000) x 100
        return contribution, (bench_c - contribution if bench_c > contribution else ZERO)

    law = pct_2(p, c['year']) if p >= 100 else None
    if law is None:
        out.update(eligible=False, pct=None, contribution=None, credit=ZERO, pct_u=None, contribution_u=None,
                   credit_u=ZERO, credit_all=ZERO)
    else:
        x, r = law
        con, cre = credit_at(r, bench)
        con_u, cre_u = credit_at(x, bench)
        out.update(eligible=True, pct=F(r, 100), contribution=con / 100, credit=cre / 100, pct_u=x / 100,
                   contribution_u=con_u / 100, credit_u=cre_u / 100, credit_all=credit_at(r, bench_all)[1] / 100)
    if p >= 100:
        x, r = pct_2(p, enhanced=True)
        con, cre = credit_at(r, bench)
        out.update(enh_pct=F(r, 100), enh_contribution=con / 100, enh_credit=cre / 100)
    else:
        out.update(enh_pct=None, enh_contribution=None, enh_credit=ZERO)
    nof = pct_2(p, c['year'])                      # the page's formula with no 100% floor (the cliff still applies)
    out['credit_nofloor'] = credit_at(nof[1], bench)[1] / 100 if nof is not None else ZERO
    # Form 8962 (2025 method): line 5 = whole percent, decimals dropped; over 4 x the guideline enter 401;
    # line 8a = income x figure to the whole dollar; benchmark to the whole dollar.
    fp = 401 if M > 400 * L else M // L
    out['form_p'] = F(fp)
    fpct = pct_2(F(fp), c['year']) if fp >= 100 else None
    if fpct is None:
        out.update(form_pct=None, form_contribution=None, form_credit=ZERO)
    else:
        r = fpct[1]
        con = rhu(F(M * r, 1000000))               # whole dollars
        b = rhu(bench / 100)
        out.update(form_pct=F(r, 100), form_contribution=F(con), form_credit=F(max(0, b - con)))
    out['factors'] = [F(factor_2(a), 1000) for a in list(c['adults']) + list(c['kids'])]
    out['not_counted'] = max(0, sum(1 for a in c['kids'] if a < 21) - 3)
    return out


def dime(x):
    """Nearest multiple of 10 cents, half up."""
    if MUT == 'part_d_to_cent':
        return F(rhu(x * 100), 100)
    return F(rhu(x * 10), 10)


def irmaa_tables_2(year):
    """Part B totals and Part D add-ons by level 0..5, rebuilt from the statute; the lines for each filing status."""
    assert year == 2026   # the repayment amounts are those of the 2026 notice
    ar = fr(R.PART_B_AGED_ACTUARIAL_RATE[year])
    base = fr(R.PART_D_BASE_BENEFICIARY_PREMIUM[year])
    b_tot = [dime(2 * ar * F(pct, 100) + fr(rep)) for pct, rep in zip(R.IRMAA_APPLICABLE_PCT, R.FRB26_REPAYMENT)]
    d_add = [ZERO] + [dime(base * (pct - R.PART_D_IRMAA_BASE_PCT) / R.PART_D_IRMAA_BASE_PCT)
                      for pct in R.IRMAA_APPLICABLE_PCT[1:]]
    single = [row[0] for row in R.IRMAA[year]['single'] if row[0] is not None]
    lines = {'single': single,
             'joint': [2 * x for x in single[:4]] + [single[4] * 3 // 2],   # twice, except 150% of the $500,000 line
             'separate': [single[0], single[4] - single[0]]}                # less the single threshold: $109,000, $391,000
    return b_tot, d_add, lines




def level_2(magi, status, lines, at_or_under=False):
    """Count the lines passed: 'more than' each lower line, 'at least' the top line (at_or_under: 'more than' it)."""
    top_inclusive = at_or_under or MUT == 'irmaa_top_at_or_under'
    passed_top = magi > lines[-1] if top_inclusive else magi >= lines[-1]
    if status == 'separate':
        return 5 if passed_top else (4 if magi > lines[0] else 0)
    return sum(1 for x in lines[:-1] if magi > x) + (1 if passed_top else 0)


def irmaa_2(c):
    b_tot, d_add, lines = irmaa_tables_2(c['year'])   # rebuilt on every call (cheap), so a --mutate run reaches it
    magi = c['magi']
    lv = level_2(magi, c['status'], lines[c['status']])
    plv = level_2(magi, c['status'], lines[c['status']], at_or_under=True)
    b, d = b_tot[lv] - b_tot[0], d_add[lv]
    pb, pd = b_tot[plv] - b_tot[0], d_add[plv]
    return {'magi_year': c['year'] - 2, 'tier': lv, 'b_total': b_tot[lv], 'b_irmaa': b, 'd_irmaa': d, 'month': b + d,
            'year_person': 12 * (b + d), 'year_household': 12 * (b + d) * c['people'], 'year_b_only': 12 * b,
            'aou_tier': plv, 'aou_year_person': 12 * (pb + pd)}


def oop_2(mc, dc, ch, capc):
    """Out of pocket in cents, piecewise: the bills up to the deductible, then the coinsurance share, then the cap."""
    if mc <= dc:
        x = F(mc)
    elif MUT == 'coinsurance_on_all_bills':
        x = dc + F(ch * mc, 100)
    else:
        x = dc + F(ch * (mc - dc), 100)
    if capc is not None and x > capc:
        x = F(capc)
    return x


def hsa_2(dc, capc, ch, cov, year):
    lo, hi = (100 * v for v in R.HDHP[year][cov])
    limit = capc if capc is not None else (dc if ch == 0 else None)
    if dc < lo or (MUT == 'hsa_lines_exclusive' and dc == lo):
        return False, 'deductible under the minimum'
    if limit is None:
        return False, NO_LIMIT
    if limit > hi:
        return False, 'out-of-pocket maximum over the limit'
    return True, ''


def hdhp_2(c):
    mc, dc = int_cents(c['bills']), int_cents(c['deductible'])
    capc = None if c['oop_max'] is None else int_cents(c['oop_max'])
    ch = int_cents(c['coinsurance'])     # coinsurance in hundredths
    out = {'oop': oop_2(mc, dc, ch, capc) / 100}
    for y in HSA_YEARS:
        out[f'hsa_{y}'] = hsa_2(dc, capc, ch, c['coverage'], y)
        out[f'limit_{y}'] = F(R.HSA_LIMIT[y][c['coverage']])
    return out


# ============================ RULES.md worked examples, through derivation 2 ============================

def check_examples():
    def ptc(year, n, magi, ad, kd, b40):
        return ptc_2(ptc_case(year, n, magi, ad, kd, b40, ''))
    r = ptc(2026, 2, '50000', (45, 43), (), '500')
    assert money(r['bench']) == '13150.23' and r['fpl'] == 21150 and r['fpl_year'] == 2025
    assert fixed(r['multiple'] * 100, 4) == '236.4066' and r['pct'] == F(794, 100) and r['contribution'] == 3970
    assert money(r['credit']) == '9180.23' and money(r['enh_credit']) == '11420.23' and r['enh_pct'] == F(346, 100)
    assert r['form_p'] == 236 and r['form_pct'] == F(792, 100) and r['form_contribution'] == 3960 and r['form_credit'] == 9190
    c = ptc(2026, 2, '90000', (45, 43), (), '500')
    assert c['credit'] == 0 and not c['eligible'] and c['enh_contribution'] == 7650 and money(c['enh_credit']) == '5500.23'
    assert ptc(2026, 2, '84600', (45, 43), (), '500')['pct'] == F(996, 100)
    assert ptc(2026, 2, '84601', (45, 43), (), '500')['credit'] == 0
    assert ptc(2026, 2, '84601', (45, 43), (), '500')['form_p'] == 401
    r27 = ptc(2027, 2, '50000', (45, 43), (), '500')
    assert r27['fpl'] == 21640 and r27['pct'] == F(795, 100) and money(r27['credit']) == '9175.23'
    k = ptc(2026, 6, '50000', (45, 43), (16, 12, 7, 3), '500')
    assert money(k['bench']) == '24366.20' and money(k['bench_all']) == '27957.75' and k['not_counted'] == 1
    # Medicare 2026: joint $300,000, both on Medicare -> $5,769.60; single exactly $500,000 -> $6,936.00
    # (read "at or under": $6,355.20).
    j = irmaa_2(irmaa_case(2026, 'joint', '300000', 2, ''))
    assert j['tier'] == 2 and j['b_total'] == F('405.80') and j['d_irmaa'] == F('37.50') and money(j['year_household']) == '5769.60'
    s = irmaa_2(irmaa_case(2026, 'single', '500000', 1, ''))
    assert s['tier'] == 5 and s['year_person'] == 6936 and money(s['aou_year_person']) == '6355.20'
    # High-deductible plan: deductible 3,000, 20%, cap 6,000.
    got = [hdhp_2(hdhp_case('self', '3000', '0.20', '6000', m, ''))['oop'] for m in ('2000', '3000', '10000', '18000', '30000')]
    assert got == [2000, 3000, 4400, 6000, 6000], got
    assert hdhp_2(hdhp_case('self', '3000', '0.20', '6000', '0', ''))['hsa_2026'] == (True, '')
    assert hdhp_2(hdhp_case('family', '3000', '0.20', '6000', '0', ''))['hsa_2026'] == (False, 'deductible under the minimum')
    return 15   # assert statements above (36 figures)


# ============================ cases ============================

def ptc_case(year, n, magi, adults, kids, b40, label, note=''):
    adults = tuple(sorted(adults, reverse=True))
    kids = tuple(sorted(kids, reverse=True))
    assert 1 <= n <= 8 and 1 <= len(adults) + len(kids) <= n
    assert all(21 <= a <= 64 for a in adults) and all(0 <= a <= 25 for a in kids)
    return {'year': year, 'n': n, 'magi': fr(magi), 'adults': adults, 'kids': kids, 'b40': fr(b40), 'label': label,
            'note': note}


def irmaa_case(year, status, magi, people, label, note=''):
    return {'year': year, 'status': status, 'magi': fr(magi), 'people': people, 'label': label, 'note': note}


def hdhp_case(cov, deductible, coinsurance, oop_max, bills, label, note=''):
    return {'coverage': cov, 'deductible': fr(deductible), 'coinsurance': fr(coinsurance),
            'oop_max': None if oop_max is None else fr(oop_max), 'bills': fr(bills), 'label': label, 'note': note}


# ============================ ptc.csv ============================

PTC_COLUMNS = ['case_id', 'label', 'coverage_year', 'household_size', 'magi', 'adults', 'children', 'benchmark_40',
               'fpl_year', 'fpl', 'income_multiple', 'band', 'eligible', 'applicable_pct', 'contribution', 'age_factors',
               'children_not_counted', 'benchmark', 'credit', 'applicable_pct_unrounded', 'contribution_unrounded_pct',
               'credit_unrounded_pct', 'enhanced_applicable_pct', 'enhanced_contribution', 'enhanced_credit',
               'benchmark_all_children', 'credit_all_children', 'credit_no_floor', 'form_pct_of_fpl',
               'form_applicable_pct', 'form_contribution', 'form_credit', 'note']
PTC_MONEY = ('contribution', 'bench', 'credit', 'contribution_u', 'credit_u', 'enh_contribution', 'enh_credit',
             'bench_all', 'credit_all', 'credit_nofloor', 'form_contribution', 'form_credit')
PTC_EXACT = ('fpl_year', 'fpl', 'multiple', 'band', 'eligible', 'pct', 'pct_u', 'enh_pct', 'form_p', 'form_pct',
             'factors', 'not_counted')


def compare(guard, where, d1, d2, money_keys, exact_keys):
    for k in exact_keys:
        guard.same(where, k, d1[k], d2[k])
    for k in money_keys:
        guard.money(where, k, d1[k], d2[k])


def random_people(rng, n):
    """Covered adults (21-64) and children (0-25) of a household of n; in 15% of households of 2 or more, some
    members are not covered (the household size still counts them)."""
    n_ad = 1 if n == 1 else (2 if rng.random() < 0.75 else 1)
    adults = [rng.randint(21, 64) if rng.random() < 0.6 else rng.randint(50, 64) for _ in range(n_ad)]
    top = min(25, min(adults) - 16)
    kids = [rng.randint(0, min(20, top)) if rng.random() < 0.8 else rng.randint(0, top) for _ in range(n - n_ad)]
    if n > 1 and rng.random() < 0.15:
        k = 1 if rng.random() < 0.7 else rng.randint(1, n - 1)
        drop = set(rng.sample(range(n), k))
        people = [('a', a) for a in adults] + [('c', a) for a in kids]
        adults = [a for i, (t, a) in enumerate(people) if t == 'a' and i not in drop]
        kids = [a for i, (t, a) in enumerate(people) if t == 'c' and i not in drop]
    return adults, kids


def random_b40(rng):
    return F(rng.randint(30000, 90000), 100) if rng.random() < 0.7 else F(rng.randint(300, 900))


def ptc_edge_cases(rng):
    cases = []
    ex = ((45, 43), ())
    cases += [
        ptc_case(2026, 2, '50000', *ex, '500', 'RULES.md 4.1: couple 45 and 43, $50,000',
                 'credit 9180.23; enhanced 11420.23; Form 8962 9190'),
        ptc_case(2026, 2, '90000', *ex, '500', 'RULES.md 4.1: the cliff at $90,000 (425.53%)',
                 'law 0; enhanced 5500.23'),
        ptc_case(2026, 2, '84600', *ex, '500', 'RULES.md 4.1: exactly 400% ($84,600)', 'eligible at 9.96%'),
        ptc_case(2026, 2, '84601', *ex, '500', 'RULES.md 4.1: one dollar over 400%', 'law 0'),
        ptc_case(2027, 2, '50000', *ex, '500', 'RULES.md 4.1: coverage year 2027', 'credit 9175.23'),
        ptc_case(2026, 6, '50000', (45, 43), (3, 7, 12, 16), '500', 'RULES.md 4.1: four children under 21',
                 'the 3-year-old is not counted: benchmark 24366.20, every child 27957.75'),
    ]
    # Rounding ties: the unrounded applicable percentage is exactly half a hundredth (written half up).
    for year, pct in ((2026, F(283, 2)), (2026, 175), (2027, F(283, 2))):
        L = R.poverty_guideline(R.poverty_year_for_coverage(year), 1)
        cases.append(ptc_case(year, 1, pct * L / 100, (34,), (), '450', f'tie: {fixed(pct, 1)}% of the poverty line',
                              'unrounded applicable % ends in exactly 5 at the third decimal; written half up'))
    L = R.poverty_guideline(2025, 1)
    cases.append(ptc_case(2026, 1, F(301) * L / 100, (34,), (), '450', 'tie on the enhanced table: 301%',
                          'enhanced 6.025% written 6.03 (the IRS 2025 Table 2 prints 0.0603)'))
    cases += [
        ptc_case(2026, 1, '0', (30,), (), '400', 'no income', 'under 100%: no credit; with no floor the whole benchmark'),
        ptc_case(2027, 4, 6 * R.poverty_guideline(2026, 4), (52, 50), (19, 17), '700', 'exactly 6 x the poverty line',
                 'law 0; enhanced 8.5%'),
        ptc_case(2026, 7, '70000', (50, 48), (21, 17, 14, 10, 6), '520', 'a 21-year-old child and four under 21',
                 'the 21-year-old always counts; the 6-year-old is not counted'),
        ptc_case(2026, 4, '64000', (64, 63), (15, 14), '610', 'ages at the curve edges: 64, 63, 15, 14',
                 'factors 3.000, 2.952, 0.833, 0.765'),
        ptc_case(2026, 4, '72000', (55, 52), (25, 20), '480', 'children 25 and 20', 'factors 1.004 and 0.970'),
        ptc_case(2026, 1, '61035', (21,), (), '300', 'contribution above the benchmark',
                 'eligible, credit 0 (benchmark 2816.90, contribution 6079.09)'),
        ptc_case(2026, 1, '54775', (64,), (), '900', 'a 64-year-old, $900 benchmark', 'factor 3.000'),
        ptc_case(2027, 8, '120000', (38, 36), (16, 14, 12, 9, 6, 2), '650', 'eight people, six children under 21',
                 'three children not counted'),
        ptc_case(2026, 4, '64000', (44,), (), '480', 'one of four covered', 'household size 4, one person covered'),
        ptc_case(2026, 3, '20000', (30, 29), (2,), '420', 'under 100%: a family',
                 'no credit; with no floor 2.10% of income'),
        ptc_case(2026, 2, '35000', (), (17, 15), '555.55', 'only the children covered', 'two children, no adult'),
    ]
    # Every band line, -0.01 / exact / +0.01, every household size, both years.
    for year in PTC_YEARS:
        for n in range(1, 9):
            L = R.poverty_guideline(R.poverty_year_for_coverage(year), n)
            for e in EDGES:
                exact = F(e) * L / 100
                for off, tag in ((-CENT, '-0.01'), (ZERO, 'exact'), (CENT, '+0.01')):
                    ad, kd = random_people(rng, n)
                    cases.append(ptc_case(year, n, exact + off, ad, kd, random_b40(rng),
                                          f'edge: {e}% of the poverty line {tag}'))
    return cases


PTC_DRAW = ((0, 100, 6), (100, 133, 8), (133, 150, 8), (150, 200, 17), (200, 250, 15), (250, 300, 13),
            (300, 400, 18), (400, 600, 15))


def random_ptc(rng):
    year = 2026 if rng.random() < 0.6 else 2027
    n = rng.choices(range(1, 9), weights=(20, 20, 15, 15, 10, 8, 6, 6))[0]
    ad, kd = random_people(rng, n)
    lo, hi, _w = rng.choices(PTC_DRAW, weights=[w for _a, _b, w in PTC_DRAW])[0]
    L = int(R.poverty_guideline(R.poverty_year_for_coverage(year), n))
    M = rng.randint(lo * L + 1, hi * L - 1)        # cents; p = M / L percent, strictly inside the band
    u = rng.random()
    if u < 0.20:
        M = (M + 50) // 100 * 100                  # whole dollars
    elif u < 0.30:
        M = (M + 5000) // 10000 * 10000            # whole hundreds
    M = max(0, min(M, 600 * L))
    return ptc_case(year, n, F(M, 100), ad, kd, random_b40(rng), 'random')


def ptc_margin(c, d2):
    """Why a random draw is redrawn, or ''. Exact band lines are left to the edge rows, and a percentage within 1e-9
    points of a rounding tie (on the law, enhanced or form track) is redrawn so float error cannot flip it."""
    L, _gy = fpl_2(c['year'], c['n'])
    M = int_cents(c['magi'])
    p = F(M, L)
    if p in EDGES:
        return 'exactly on a band line'
    for x in (pct_2(p, c['year']) if p >= 100 else None, pct_2(p, enhanced=True),
              pct_2(F(M // L), c['year']) if 100 <= M // L and M <= 400 * L else None):
        if x is not None and abs((x[0] - math.floor(x[0])) - HALF) < TIE_MARGIN:
            return 'applicable percentage on a rounding tie'
    return ''


def ptc_row(c, d):
    return {
        'case_id': c['id'], 'label': c['label'], 'coverage_year': c['year'], 'household_size': c['n'],
        'magi': money(c['magi']), 'adults': '|'.join(map(str, c['adults'])), 'children': '|'.join(map(str, c['kids'])),
        'benchmark_40': money(c['b40']), 'fpl_year': d['fpl_year'], 'fpl': fixed(d['fpl'], 0),
        'income_multiple': fixed(d['multiple'], 8), 'band': d['band'], 'eligible': 'yes' if d['eligible'] else 'no',
        'applicable_pct': fixed(d['pct'], 2), 'contribution': money(d['contribution']),
        'age_factors': '|'.join(fixed(f, 3) for f in d['factors']), 'children_not_counted': d['not_counted'],
        'benchmark': money(d['bench']), 'credit': money(d['credit']),
        'applicable_pct_unrounded': fixed(d['pct_u'], 6), 'contribution_unrounded_pct': money(d['contribution_u']),
        'credit_unrounded_pct': money(d['credit_u']), 'enhanced_applicable_pct': fixed(d['enh_pct'], 2),
        'enhanced_contribution': money(d['enh_contribution']), 'enhanced_credit': money(d['enh_credit']),
        'benchmark_all_children': money(d['bench_all']), 'credit_all_children': money(d['credit_all']),
        'credit_no_floor': money(d['credit_nofloor']), 'form_pct_of_fpl': fixed(d['form_p'], 0),
        'form_applicable_pct': fixed(d['form_pct'], 2), 'form_contribution': money(d['form_contribution']),
        'form_credit': money(d['form_credit']), 'note': c['note']}


def ptc_stats(s, c, d, edge):
    s['coverage year ' + str(c['year'])] += 1
    s[f'household size {c["n"]}'] += 1
    s[f'band (law) {d["band"]}'] += 1
    covered = len(c['adults']) + len(c['kids'])
    s['fewer people covered than in the household'] += covered < c['n']
    s['only children covered'] += not c['adults']
    s['a child 21 to 25 covered'] += any(a >= 21 for a in c['kids'])
    s['an adult of 64 covered (factor 3.000)'] += 64 in c['adults']
    s['a child 14 or under covered (factor 0.765)'] += any(a <= 14 for a in c['kids'])
    s['three-oldest-children cap applies'] += d['not_counted'] > 0
    s['eligible (law)'] += d['eligible']
    s['eligible but credit 0 (contribution at or above the benchmark)'] += d['eligible'] and d['credit'] == 0
    s['credit (law) > 0'] += d['credit'] > 0
    s['enhanced credit > 0 over 400%'] += d['band'] == 'over 400' and d['enh_credit'] > 0
    s['enhanced credit higher than law'] += d['enh_credit'] > d['credit']
    s['unrounded-percentage credit differs from credit by more than a cent'] += abs(
        to_cents(d['credit_u']) - to_cents(d['credit'])) > 1
    s['Form 8962 credit differs from credit by more than a cent'] += abs(
        to_cents(d['form_credit']) - to_cents(d['credit'])) > 1
    gap = abs(fr(d['form_credit']) - fr(d['credit']))
    s['largest Form 8962 gap (dollars)'] = max(s['largest Form 8962 gap (dollars)'], gap)
    s['largest credit'] = max(s['largest credit'], d['credit'])
    s['written amounts exactly on a half cent before rounding'] += sum(half_cent(d[k]) for k in PTC_MONEY)
    if d['pct_u'] is not None and (d['pct_u'] * 100).denominator == 2:
        s['law percentage exactly on a rounding tie (edge rows)'] += 1
    if c['magi'] == 0:
        s['income 0'] += 1


def build_ptc(rng):
    guard, s = Guard('ptc.csv'), Counter()
    s['largest Form 8962 gap (dollars)'] = ZERO
    s['largest credit'] = ZERO
    cases = ptc_edge_cases(rng)
    n_edge = len(cases)
    for i, c in enumerate(cases, 1):
        c['id'] = f'ptc-edge-{i:03d}'
    rows = []
    for c in cases:
        d1, d2 = ptc_1(c), ptc_2(c)
        compare(guard, c['id'], d1, d2, PTC_MONEY, PTC_EXACT)
        rows.append(ptc_row(c, d1))
        ptc_stats(s, c, d1, True)
    k = draws = 0
    while len(rows) < N_PTC:
        c = random_ptc(rng)
        draws += 1
        d2 = ptc_2(c)
        d1 = ptc_1(c)
        compare(guard, f'draw {draws}', d1, d2, PTC_MONEY, PTC_EXACT)
        why = ptc_margin(c, d2)
        if why:
            s['draws redrawn: ' + why] += 1
            continue
        k += 1
        c['id'] = f'ptc-{k:04d}'
        rows.append(ptc_row(c, d1))
        ptc_stats(s, c, d1, False)
    s['random draws'] = draws
    return rows, s, guard, n_edge


# ============================ irmaa.csv ============================

IRMAA_COLUMNS = ['case_id', 'label', 'premium_year', 'magi_year', 'filing_status', 'magi', 'people', 'tier',
                 'part_b_premium', 'part_b_irmaa', 'part_d_irmaa', 'surcharge_month_per_person',
                 'surcharge_year_per_person', 'surcharge_year_household', 'surcharge_year_part_b_only',
                 'at_or_under_tier', 'at_or_under_surcharge_year_per_person', 'note']
IRMAA_MONEY = ('b_total', 'b_irmaa', 'd_irmaa', 'month', 'year_person', 'year_household', 'year_b_only',
               'aou_year_person')
IRMAA_EXACT = ('magi_year', 'tier', 'aou_tier')


def rules_lines(year, status):
    return [row[0] for row in R.IRMAA[year][STATUS_RULES[status]] if row[0] is not None]


def irmaa_edge_cases():
    cases = [irmaa_case(2026, 'joint', '300000', 2, 'RULES.md 4.2: joint $300,000, both on Medicare', '5769.60 a year'),
             irmaa_case(2026, 'single', '500000', 1, 'RULES.md 4.2: single exactly $500,000',
                        'law top tier 6936.00; read "at or under" 6355.20 (the page agrees with the law)')]
    k = 0
    for year in IRMAA_YEARS:
        for status in ('single', 'joint', 'separate'):
            lines = rules_lines(year, status)
            for i, line in enumerate(lines):
                top = i == len(lines) - 1
                for off, tag in ((-1, '-1'), (-CENT, '-0.01'), (0, 'exact'), (CENT, '+0.01'), (1, '+1')):
                    people = 1 if status != 'joint' else 1 + (k % 2)
                    k += 1
                    note = ('"less than" this line: exactly on it is the top tier; an "at or under" reading puts it one lower'
                            if top and off == 0 else '')
                    cases.append(irmaa_case(year, status, line + off, people, f'edge: ${line:,} {tag}', note))
            for magi in (0, 1000000):
                cases.append(irmaa_case(year, status, magi, 1 if status != 'joint' else 2, f'edge: MAGI ${magi:,}'))
    return cases


def random_irmaa(rng):
    status = rng.choices(('single', 'joint', 'separate'), weights=(40, 40, 20))[0]
    lines = rules_lines(2026, status)
    k = rng.randrange(len(lines) + 1)
    lo = 0 if k == 0 else lines[k - 1]
    hi = lines[k] if k < len(lines) else 1000000
    magi = F(rng.randint(lo, hi)) if rng.random() < 0.8 else F(rng.randint(100 * lo, 100 * hi), 100)
    people = (2 if rng.random() < 0.6 else 1) if status == 'joint' else 1
    return irmaa_case(2026, status, magi, people, 'random')


def irmaa_row_out(c, d):
    return {'case_id': c['id'], 'label': c['label'], 'premium_year': c['year'], 'magi_year': d['magi_year'],
            'filing_status': c['status'], 'magi': money(c['magi']), 'people': c['people'], 'tier': d['tier'],
            'part_b_premium': money(d['b_total']), 'part_b_irmaa': money(d['b_irmaa']), 'part_d_irmaa': money(d['d_irmaa']),
            'surcharge_month_per_person': money(d['month']), 'surcharge_year_per_person': money(d['year_person']),
            'surcharge_year_household': money(d['year_household']), 'surcharge_year_part_b_only': money(d['year_b_only']),
            'at_or_under_tier': d['aou_tier'], 'at_or_under_surcharge_year_per_person': money(d['aou_year_person']), 'note': c['note']}


def irmaa_stats(s, c, d):
    s['status ' + c['status']] += 1
    s[f'{c["status"]} tier {d["tier"]}'] += 1
    s['joint with 2 people on Medicare'] += c['status'] == 'joint' and c['people'] == 2
    s['MAGI with cents'] += c['magi'].denominator != 1
    s['an "at or under" reading gives another tier'] += d['tier'] != d['aou_tier']


def build_irmaa(rng):
    guard, s = Guard('irmaa.csv'), Counter()
    cases = irmaa_edge_cases()
    n_edge = len(cases)
    for i, c in enumerate(cases, 1):
        c['id'] = f'ir-edge-{i:03d}'
    rows = []
    for c in cases:
        d1, d2 = irmaa_1(c), irmaa_2(c)
        compare(guard, c['id'], d1, d2, IRMAA_MONEY, IRMAA_EXACT)
        rows.append(irmaa_row_out(c, d1))
        irmaa_stats(s, c, d1)
    k = draws = 0
    while len(rows) < N_IRMAA:
        c = random_irmaa(rng)
        draws += 1
        d1, d2 = irmaa_1(c), irmaa_2(c)
        compare(guard, f'draw {draws}', d1, d2, IRMAA_MONEY, IRMAA_EXACT)
        if c['magi'] in rules_lines(c['year'], c['status']):
            s['draws redrawn: exactly on a line'] += 1
            continue
        k += 1
        c['id'] = f'ir-{k:04d}'
        rows.append(irmaa_row_out(c, d1))
        irmaa_stats(s, c, d1)
    s['random draws'] = draws
    return rows, s, guard, n_edge


# ============================ hdhp.csv ============================

HDHP_COLUMNS = ['case_id', 'label', 'coverage', 'deductible', 'coinsurance', 'oop_max', 'bills', 'out_of_pocket', 'phase',
                'hsa_2026', 'hsa_2026_reason', 'hsa_2027', 'hsa_2027_reason', 'hsa_limit_2026', 'hsa_limit_2027', 'note']
HDHP_MONEY = ('oop', 'limit_2026', 'limit_2027')
HDHP_EXACT = ('hsa_2026', 'hsa_2027')


def hdhp_edge_cases(rng):
    cases = []
    for m in ('2000', '3000', '10000', '18000', '30000'):
        cases.append(hdhp_case('self', '3000', '0.20', '6000', m, f'RULES.md 4.3: bills ${int(m):,}'))
    cases.append(hdhp_case('family', '3000', '0.20', '6000', '10000', 'RULES.md 4.3: the same plan as family coverage',
                           'not an HSA plan: $3,000 is under the family minimum'))
    for year in HSA_YEARS:
        for cov in ('self', 'family'):
            lo, hi = R.HDHP[year][cov]
            for off, tag in ((-1, '-1'), (0, 'exact'), (1, '+1')):
                cases.append(hdhp_case(cov, lo + off, '0.20', hi, F(rng.randint(0, 3000000), 100),
                                       f'edge: {year} {cov} minimum deductible {tag}'))
            for off, tag in ((-1, '-1'), (0, 'exact'), (1, '+1')):
                cases.append(hdhp_case(cov, lo, '0.20', hi + off, F(rng.randint(0, 3000000), 100),
                                       f'edge: {year} {cov} out-of-pocket limit {tag}'))
    for m, tag in (('2499.99', '-0.01'), ('2500', 'exact'), ('2500.01', '+0.01')):
        cases.append(hdhp_case('self', '2500', '0.30', '7000', m, f'edge: bills at the deductible {tag}'))
    for m, tag in (('17999', '-1'), ('17999.99', '-0.01'), ('18000', 'exact'), ('18000.01', '+0.01')):
        cases.append(hdhp_case('self', '2000', '0.25', '6000', m, f'edge: bills where the cap is reached {tag}',
                               '5999.9975 written 6000.00' if tag == '-0.01' else ''))
    cases += [
        hdhp_case('self', '2000', '0.20', '7000', '0', 'no bills'),
        hdhp_case('family', '4000', '0.20', '12000', '150000', 'the largest bills'),
        hdhp_case('self', '2500', '0', '5000', '40000', 'no coinsurance', 'pays the deductible only'),
        hdhp_case('family', '5000', '0.50', '17000', '20000', 'coinsurance 50%'),
        hdhp_case('self', '3000', '0', None, '50000', 'no out-of-pocket limit, no coinsurance',
                  'never more than the deductible, so the deductible is the limit: an HSA plan'),
        hdhp_case('self', '3000', '0.20', None, '50000', 'no out-of-pocket limit, 20% coinsurance',
                  'no limit on the member\'s share: not an HSA plan'),
        hdhp_case('family', '18000', '0', None, '25000', 'family, no limit, no coinsurance, deductible over the limit'),
        hdhp_case('self', '1000', '0.20', None, '150000', 'deductible under the minimum and no limit',
                  'reason: the deductible (checked first)'),
        hdhp_case('self', '0', '0.20', '4000', '9000', 'no deductible'),
        hdhp_case('self', '5000', '0.20', '4000', '4500', 'out-of-pocket limit below the deductible',
                  'the formula caps at the limit; not a real plan'),
        hdhp_case('self', '4000', '0.30', '4000', '9000', 'out-of-pocket limit equal to the deductible',
                  'coinsurance never applies'),
        hdhp_case('self', '1000', '0.25', '6000', '1000.02', 'a half cent', '1000.005 written 1000.01'),
        hdhp_case('family', '3400', '0.10', '17000', '60000', 'family at both 2026 lines', '2026 yes, 2027 no'),
        hdhp_case('self', '1750', '0.20', '8700', '12000', 'self at both 2027 lines',
                  '2027 yes; 2026 no (8,700 is over the 2026 limit)'),
    ]
    return cases


def random_hdhp(rng):
    cov = 'self' if rng.random() < 0.55 else 'family'
    k = 1 if cov == 'self' else 2
    u = rng.random()
    if u < 0.35:
        d = rng.randint(10, 40) * 100 * k             # around the HSA minimum
    elif u < 0.80:
        d = rng.randint(0, 150) * 50 * k
    else:
        d = rng.randint(0, 9000 * k)
    u = rng.random()
    if u < 0.08:
        cap = None
    elif u < 0.33:
        cap = max(d, rng.choice([R.HDHP[2026][cov][1], R.HDHP[2027][cov][1]] + [v * k for v in (5000, 6000, 7000, 8000, 9000, 10000)]))
    else:
        top = 12000 * k
        cap = d + rng.randint(0, (top - d) // 50) * 50 if d < top else d + rng.randint(0, 40) * 50
    u = rng.random()
    if u < 0.15:
        co = F(0)
    elif u < 0.70:
        co = F(rng.choice((10, 15, 20, 25, 30, 35, 40, 45, 50)), 100)
    else:
        co = F(rng.randint(1, 50), 100)
    u = rng.random()
    if u < 0.05:
        m = F(0)
    elif u < 0.15:
        m = F(rng.randint(1, 1500) * 100)
    else:
        lo, hi = rng.choice(((2000, 100000), (100000, 1000000), (1000000, 5000000), (5000000, 15000000)))
        mc = rng.randint(lo, hi)
        if rng.random() < 0.3:
            mc = (mc + 50) // 100 * 100
        m = F(mc, 100)
    return hdhp_case(cov, d, co, cap, m, 'random')


def hdhp_row_out(c, d):
    yes = lambda t: 'yes' if t[0] else 'no'  # noqa: E731
    return {'case_id': c['id'], 'label': c['label'], 'coverage': c['coverage'], 'deductible': money(c['deductible']),
            'coinsurance': fixed(c['coinsurance'], 2), 'oop_max': money(c['oop_max']), 'bills': money(c['bills']),
            'out_of_pocket': money(d['oop']), 'phase': d['phase'],
            'hsa_2026': yes(d['hsa_2026']), 'hsa_2026_reason': d['hsa_2026'][1],
            'hsa_2027': yes(d['hsa_2027']), 'hsa_2027_reason': d['hsa_2027'][1],
            'hsa_limit_2026': money(d['limit_2026']), 'hsa_limit_2027': money(d['limit_2027']), 'note': c['note']}


def hdhp_stats(s, c, d):
    s['coverage ' + c['coverage']] += 1
    s['phase ' + d['phase']] += 1
    s['out-of-pocket limit blank'] += c['oop_max'] is None
    s['coinsurance 0'] += c['coinsurance'] == 0
    s['bills 0'] += c['bills'] == 0
    s['HSA 2026 yes'] += d['hsa_2026'][0]
    s['HSA 2027 yes'] += d['hsa_2027'][0]
    s['HSA 2026 and 2027 differ'] += d['hsa_2026'][0] != d['hsa_2027'][0]
    for y in HSA_YEARS:
        if not d[f'hsa_{y}'][0]:
            s[f'HSA {y} no: {d[f"hsa_{y}"][1]}'] += 1
    s['deductible exactly at the 2026 minimum'] += c['deductible'] == R.HDHP[2026][c['coverage']][0]
    s['out-of-pocket limit exactly at the 2026 maximum'] += c['oop_max'] == R.HDHP[2026][c['coverage']][1]
    s['written amounts exactly on a half cent before rounding'] += half_cent(d['oop'])


def build_hdhp(rng):
    guard, s = Guard('hdhp.csv'), Counter()
    cases = hdhp_edge_cases(rng)
    n_edge = len(cases)
    for i, c in enumerate(cases, 1):
        c['id'] = f'hd-edge-{i:03d}'
    rows = []
    k = 0
    draws = 0
    while len(cases) < N_HDHP:
        c = random_hdhp(rng)
        draws += 1
        k += 1
        c['id'] = f'hd-{k:04d}'
        cases.append(c)
    for c in cases:
        d1, d2 = hdhp_1(c), hdhp_2(c)
        compare(guard, c['id'], d1, d2, HDHP_MONEY, HDHP_EXACT)
        rows.append(hdhp_row_out(c, d1))
        hdhp_stats(s, c, d1)
    s['random draws'] = draws
    return rows, s, guard, n_edge


# ===================================================== run =====================================================

def write_csv(path, columns, rows):
    with path.open('w', newline='', encoding='utf-8') as fh:
        w = csv.DictWriter(fh, fieldnames=columns, lineterminator='\n')
        w.writeheader()
        w.writerows(rows)


def show_stat(v):
    if isinstance(v, F):
        return money(v)
    return v


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
            tb = e.__traceback__
            while tb.tb_next:
                tb = tb.tb_next
            raise SystemExit(f'RULES.md examples check failed in derivation 2 at line {tb.tb_lineno} {e.args or ""}; '
                             'no CSV written')
        print(f'RULES.md worked examples reproduced by derivation 2: {n_ex} assertions')
    rng = random.Random(SEED)
    built = {}
    for name, build, cols, want in (('ptc.csv', build_ptc, PTC_COLUMNS, N_PTC),
                                    ('irmaa.csv', build_irmaa, IRMAA_COLUMNS, N_IRMAA),
                                    ('hdhp.csv', build_hdhp, HDHP_COLUMNS, N_HDHP)):
        rows, stats, guard, n_edge = build(rng)
        assert len(rows) == want, (name, len(rows))
        assert len({r['case_id'] for r in rows}) == want
        built[name] = (cols, rows, stats, guard, n_edge)
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    for name, (cols, rows, stats, guard, n_edge) in built.items():   # written only once all three passed
        write_csv(out_dir / name, cols, rows)
    for name, (cols, rows, stats, guard, n_edge) in built.items():
        print(f'wrote {name}: {len(rows)} rows ({n_edge} edge, {len(rows) - n_edge} random); both derivations agree; '
              f'largest gap before rounding {float(guard.max_gap):.3g}')
        for key in sorted(guard.n):
            print(f'  check: {key}: {guard.n[key]}')
        for key in sorted(stats):
            print(f'  {key}: {show_stat(stats[key])}')
    print(f'total {time.time() - t0:.1f} s')


if __name__ == '__main__':
    main(sys.argv[1:])
