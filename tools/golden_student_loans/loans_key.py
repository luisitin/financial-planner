"""Student loan answer key: 2,000 invented borrowers, each repaid three ways (standard, IBR, RAP).

Run:  python3 tools/golden_student_loans/loans_key.py
Writes tests/golden/student-loans/loans.csv. Standard library only, exact arithmetic, deterministic
(random.Random(20261031)). Figures and the payment rules come from rules.py next to this file; the
sources and the reasons are in tests/golden/student-loans/RULES.md and in README.md here.

Each row is one borrower whose Direct Loans were all made before July 1, 2026 and who first borrowed on or
after July 1, 2014 (an IBR "new borrower"), with one balance at one rate, unsubsidized, living in the 48
contiguous states or DC, never married to someone with student loans (share = 1), paying every bill on time
and in full, with the same AGI, family size and dependents for the whole life of each plan.

Rules (derivation 1, the statute month by month):
  * Payments. standard = B r / (1 - (1+r)^-120), at least $50 (rules.standard_payment).
    ibr = min(10% x max(0, AGI - 150% x poverty guideline) / 12, standard), then <$5 -> $0 and
    $5-<$10 -> $10 (rules.ibr_payment; the cap is the standard payment on this balance, the balance the
    borrower entered IBR with). rap = max($10, base / 12 - $50 x dependents), base = $120 up to
    $10,000 of AGI, else the band's percent of the whole AGI (rules.rap_payment). Nothing is rounded inside
    the schedules, the payment included (rules.*_payment(..., to_cent=False)): no statute or regulation
    says how a payment is rounded (USC1087E (q), USC1098E, CFR208, CFR209 re-read 2026-10-31), so the key
    does not impose one. The *_monthly columns show the exact payment half up to the cent, like every output.
  * Every month: interest = principal x annual_rate / 12, exact (never rounded, never on unpaid interest).
    The payment goes to interest first, then principal.
  * Standard: 120 payments; the last one is whatever is left (CFR 685.208(b)(1)(ii) lets it differ). With
    the $50 floor the loan is gone sooner. Nothing is forgiven.
  * IBR: interest the payment does not cover is carried as unpaid interest (not capitalized: income is
    flat, so the payment never changes and never reaches the cap later), and is paid before principal.
    A $0 bill still counts as a month (34 CFR 685.209(k)(4)(i)(A) "having a monthly payment obligation of
    $0"). After the 240th month whatever principal and unpaid interest is left is forgiven.
  * RAP: interest an on-time payment does not cover is not charged (20 U.S.C. 1087e(q)(2)(A)). When the
    payment cuts principal by less than $50 the Secretary cuts it by min($50, amount paid) minus the part
    of the payment that went to principal ((q)(2)(B)), never below 0. When principal plus the month's
    interest is less than the payment, the payment is that amount ((q)(4)(B)(iii)). After the 360th
    payment the principal left is forgiven (no unpaid interest can be left).
  * Outputs only are rounded, half up to the cent.

Second way (derivation 2), run on every row before the CSV is written: the payments again from the closed
forms written separately (annuity in exact Fractions, the RAP band found by arithmetic, the poverty line as
1-person figure + per-person step), and every schedule in closed form: geometric series for amortizing
months, straight lines for the months RAP's match fixes principal's fall at min($50, payment), with a
bisection for the payoff month. Both derivations are exact (Fraction), so they must agree exactly; the
script refuses to write the CSV if any column differs by more than a cent or any month count differs.
"""
import sys
sys.dont_write_bytecode = True  # before importing rules.py, so no __pycache__ lands in the repo

import csv
import math
import random
import time
from collections import Counter
from decimal import Decimal as D, ROUND_HALF_UP
from fractions import Fraction as F
from functools import lru_cache
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import rules as R  # noqa: E402  (importing it runs rules.check_tables())

ROOT = HERE.parents[1]
OUT = ROOT / 'tests' / 'golden' / 'student-loans' / 'loans.csv'
SEED = 20261031
ROWS = 2000
BAL_LO, BAL_HI = D(1000), D(200000)
AGI_HI = D(250000)
RATE_MILLES = range(30, 91)          # annual rate 0.030 .. 0.090 in steps of 0.001
YEARS = (2025, 2026)
CENT = D('0.01')
ZERO = F(0)
COLUMNS = ['case_id', 'balance', 'annual_rate', 'agi', 'family_size', 'dependents', 'guideline_year',
           'standard_monthly', 'ibr_monthly', 'rap_monthly',
           'standard_months', 'standard_total_paid', 'standard_forgiven',
           'ibr_months', 'ibr_total_paid', 'ibr_forgiven',
           'rap_months', 'rap_total_paid', 'rap_forgiven']
MONEY_OUT = [c for c in COLUMNS[7:] if not c.endswith('_months')]
MONTHS_OUT = [c for c in COLUMNS[7:] if c.endswith('_months')]


def fr(x):
    """Decimal (or int / str) -> exact Fraction."""
    return F(D(x)) if not isinstance(x, F) else x


def half_up(x):
    """A Fraction rounded half up (toward +infinity on a tie) to the cent, as a Fraction."""
    return F(math.floor(x * 100 + F(1, 2)), 100)


def money(x):
    c = math.floor(x * 100 + F(1, 2))
    assert c >= 0, x
    return f'{c // 100}.{c % 100:02d}'


# ===================== derivation 1: rules.py payments, the statute month by month ================

def payments_1(c):
    std = R.standard_payment(c['balance'], c['rate'], to_cent=False)
    ibr = R.ibr_payment(c['agi'], c['family_size'], c['year'], standard_cap=std, to_cent=False)
    rap = R.rap_payment(c['agi'], c['dependents'], to_cent=False)
    return F(std), F(ibr), F(rap)


def standard_loop(balance, r, pay):
    principal, n, paid = balance, 0, ZERO
    while principal > 0:
        n += 1
        interest = principal * r
        owed = principal + interest
        if owed <= pay or n == R.STANDARD_MONTHS:   # the final payment is whatever is left
            paid += owed
            principal = ZERO
            break
        paid += pay
        to_interest = min(pay, interest)
        principal -= pay - to_interest
    return n, paid, ZERO


def ibr_loop(balance, r, pay):
    principal, unpaid, n, paid = balance, ZERO, 0, ZERO
    while n < R.IBR_FORGIVE_PAYMENTS_NEW:
        n += 1
        interest = principal * r                     # on principal only, never on unpaid interest
        owed = principal + unpaid + interest
        if owed <= pay:                              # the last payment clears everything
            paid += owed
            principal = unpaid = ZERO
            break
        paid += pay
        interest_due = unpaid + interest
        to_interest = min(pay, interest_due)         # interest first (USC1098E (b)(2))
        unpaid = interest_due - to_interest          # carried, not capitalized
        principal -= pay - to_interest               # owed > pay, so this stays above 0
    return n, paid, principal + unpaid               # left after the 240th month is forgiven


def rap_loop(balance, r, pay):
    principal, n, paid = balance, 0, ZERO
    target = F(R.RAP_MATCH_TARGET)
    while n < R.RAP_FORGIVE_PAYMENTS and principal > 0:
        n += 1
        interest = principal * r
        if principal + interest < pay:               # (q)(4)(B)(iii): pay the whole balance
            paid += principal + interest
            principal = ZERO
            break
        paid += pay
        to_interest = min(pay, interest)             # the rest of the interest is not charged
        to_principal = min(pay - to_interest, principal)
        principal -= to_principal
        if to_principal < target:                    # (q)(2)(B) matching principal payment
            match = min(target, pay) - to_principal
            principal -= min(match, principal)
    return n, paid, principal


def derive_1(c):
    b, r = fr(c['balance']), fr(c['rate']) / R.MONTHS_PER_YEAR
    std, ibr, rap = payments_1(c)
    return {'std_pay': std, 'ibr_pay': ibr, 'rap_pay': rap,
            'std': standard_loop(b, r, std), 'ibr': ibr_loop(b, r, ibr), 'rap': rap_loop(b, r, rap)}


# ========================= derivation 2: closed forms, written separately =========================

FIFTY, TEN, FIVE = F(50), F(10), F(5)
STD_N, IBR_N, RAP_N = 120, 240, 360


@lru_cache(maxsize=None)
def g_pow(milles, k):
    """(1 + rate/12)^k exactly, rate = milles / 1000 (so rate/12 = milles / 12000)."""
    return F(12000 + milles, 12000) ** k


def poverty_2(year, size):
    return F(R.POVERTY_BASE_1[year]) + F(R.POVERTY_PER_PERSON[year]) * (size - 1)


def standard_pay_2(balance, milles):
    r = F(milles, 12000)
    gn = g_pow(milles, STD_N)
    level = balance * r * gn / (gn - 1)              # B r (1+r)^n / ((1+r)^n - 1)
    return max(level, FIFTY)                          # exact: no source rounds a payment


def ibr_pay_2(agi, size, year, cap):
    over = agi - F(3, 2) * poverty_2(year, size)
    raw = max(ZERO, over) / 120                       # 10% / 12 = 1/120
    p = min(raw, cap)                                 # exact; CFR209 (g)(1)(iii) tests the calculated amount
    if p < FIVE:
        return ZERO
    return TEN if p < TEN else p


def rap_pay_2(agi, deps):
    if agi <= 10000:
        base = F(120)
    else:
        pct = min(10, math.ceil(agi / 10000) - 1)    # (10k,20k] -> 1, ..., (90k,100k] -> 9, above -> 10
        base = agi * pct / 100
    return max(TEN, base / 12 - 50 * deps)


def amort(r0, milles, pay, i):
    """Principal after i months of amortizing at `pay`: R0 g^i - pay (g^i - 1) / r."""
    gi = g_pow(milles, i)
    return r0 * gi - pay * (gi - 1) * 12000 / milles


def first_close(r0, milles, pay, imax):
    """Smallest i in 0..imax with amort(i) x g <= pay (that month's payment clears the loan), else None.
    amort(i) falls with i whenever pay is more than the month's interest, so the test is monotone."""
    g = g_pow(milles, 1)
    if amort(r0, milles, pay, imax) * g > pay:
        return None
    lo, hi = 0, imax
    while lo < hi:
        mid = (lo + hi) // 2
        if amort(r0, milles, pay, mid) * g <= pay:
            hi = mid
        else:
            lo = mid + 1
    return lo


def standard_closed(balance, milles, pay):
    i = first_close(balance, milles, pay, STD_N - 1)
    if i is None:
        i = STD_N - 1                                 # month 120 pays what is left
    return i + 1, i * pay + amort(balance, milles, pay, i) * g_pow(milles, 1), ZERO


def ibr_closed(balance, milles, pay):
    interest = balance * F(milles, 12000)
    if pay <= interest:                               # principal never moves; unpaid interest grows
        return IBR_N, IBR_N * pay, balance + IBR_N * (interest - pay)
    i = first_close(balance, milles, pay, IBR_N - 1)
    if i is not None:
        return i + 1, i * pay + amort(balance, milles, pay, i) * g_pow(milles, 1), ZERO
    return IBR_N, IBR_N * pay, amort(balance, milles, pay, IBR_N)


def rap_closed(balance, milles, pay):
    """Principal falls by max(pay - interest, min(50, pay)) a month. While principal is at least
    T = (pay - 50) / r that is the constant c = min(50, pay) (a straight line); below T it is
    pay - interest (ordinary amortization). The last month comes when principal <= c on the line,
    or when principal + interest <= pay on the curve."""
    r, g = F(milles, 12000), g_pow(milles, 1)
    c = min(FIFTY, pay)
    t = (pay - FIFTY) / r if pay > FIFTY else None
    j_last = math.ceil(balance / c)                   # first month whose opening principal is <= c
    if t is None or balance < t:
        j_curve = 1 if t is not None else None        # month the curve starts (None: never)
    else:
        j_curve = math.floor((balance - t) / c) + 2   # first j with balance - (j-1)c < t
    if j_curve is None or j_last < j_curve:           # ends on the line
        if j_last <= RAP_N:
            left = balance - (j_last - 1) * c
            return j_last, (j_last - 1) * pay + min(pay, left * g), ZERO
        return RAP_N, RAP_N * pay, balance - RAP_N * c
    if j_curve - 1 >= RAP_N:
        return RAP_N, RAP_N * pay, balance - RAP_N * c
    r0 = balance - (j_curve - 1) * c                  # principal when the curve starts
    i = first_close(r0, milles, pay, RAP_N - j_curve)
    if i is not None:
        return j_curve + i, (j_curve - 1 + i) * pay + amort(r0, milles, pay, i) * g, ZERO
    return RAP_N, RAP_N * pay, amort(r0, milles, pay, RAP_N - j_curve + 1)


def derive_2(c):
    b, m = fr(c['balance']), c['milles']
    agi = fr(c['agi'])
    std = standard_pay_2(b, m)
    ibr = ibr_pay_2(agi, c['family_size'], c['year'], std)
    rap = rap_pay_2(agi, c['dependents'])
    return {'std_pay': std, 'ibr_pay': ibr, 'rap_pay': rap,
            'std': standard_closed(b, m, std), 'ibr': ibr_closed(b, m, ibr), 'rap': rap_closed(b, m, rap)}


def columns(d):
    out = {'standard_monthly': d['std_pay'], 'ibr_monthly': d['ibr_pay'], 'rap_monthly': d['rap_pay']}
    for plan, key in (('standard', 'std'), ('ibr', 'ibr'), ('rap', 'rap')):
        n, paid, forgiven = d[key]
        out[f'{plan}_months'], out[f'{plan}_total_paid'], out[f'{plan}_forgiven'] = n, paid, forgiven
    return out


# ============================== checks against RULES.md's examples ================================

def check_examples():
    """RULES.md 'Worked by hand' payments and RAP first months, and the SADEF table, with derivation 2."""
    # payments are exact; the worked examples and studentaid.gov show them to the cent, half up
    assert half_up(standard_pay_2(F(30000), 60)) == F('333.06')
    assert half_up(standard_pay_2(F(45000), 60)) == F('499.59')   # SAQA "$500"
    assert half_up(standard_pay_2(F(50000), 65)) == F('567.74')
    assert ibr_pay_2(F(45000), 3, 2026, standard_pay_2(F(50000), 65)) == F('33.50')
    assert half_up(ibr_pay_2(F(45000), 3, 2025, standard_pay_2(F(50000), 65))) == F('41.88')   # 41.875 exactly
    assert ibr_pay_2(F(15960) * F(3, 2) + F('599.40'), 1, 2026, F(300)) == 0                   # 4.995 < $5 -> $0
    assert rap_pay_2(F(32000), 1) == F(30)
    assert rap_pay_2(F(60000), 0) == F(250)
    assert rap_pay_2(F(40000), 1) == F(50) and half_up(rap_pay_2(F(40001), 1)) == F('83.34')
    assert half_up(rap_pay_2(F(85000), 2)) == F('466.67')
    for agi, want in R.SADEF_RAP_TABLE:
        assert half_up(rap_pay_2(F(agi), 0)) == F(want), agi
    # RAP month 1 (exact interest gives the same principal as RULES.md, which rounds interest)
    assert _rap_months(F(40000), 65, F(30), 1) == F(39970)
    assert _rap_months(F(40000), 65, F(30), 2) == F(39940)
    assert _rap_months(F(40000), 65, F(250), 1) == F(39950)
    # RAP 3(d): $60,000 at 6.5%, $466.67 (466.6667 exact): interest 325.00, principal 59,858.33
    assert _rap_months(F(60000), 65, F('466.67'), 1) == F('59858.33')
    assert half_up(_rap_months(F(60000), 65, rap_pay_2(F(85000), 2), 1)) == F('59858.33')


def _rap_months(balance, milles, pay, months):
    """Principal after `months` RAP months (the derivation-1 loop, stopped early)."""
    principal, r, target = balance, F(milles, 12000), F(50)
    for _ in range(months):
        interest = principal * r
        to_interest = min(pay, interest)
        to_principal = min(pay - to_interest, principal)
        principal -= to_principal
        if to_principal < target:
            principal -= min(min(target, pay) - to_principal, principal)
    return principal


# ============================================ generator ===========================================

FAMILY_WEIGHTS = (30, 20, 18, 14, 8, 5, 3, 2)   # family sizes 1..8


def dec2(x):
    return D(x).quantize(CENT, rounding=ROUND_HALF_UP)


def case(balance, milles, agi, size, deps, year, kind):
    assert BAL_LO <= D(balance) <= BAL_HI and 30 <= milles <= 90
    assert 0 <= D(agi) <= AGI_HI and 1 <= size <= 8 and 0 <= deps <= size - 1 and year in YEARS
    return {'balance': dec2(balance), 'milles': milles, 'rate': D(milles) / 1000, 'agi': dec2(agi),
            'family_size': size, 'dependents': deps, 'year': year, 'kind': kind}


def rand_balance(rng):
    u = rng.random()
    if u < 0.7:
        x = math.exp(rng.uniform(math.log(1000), math.log(200000)))
        return dec2(D(repr(x)))
    if u < 0.9:
        return D(rng.randint(10, 2000) * 100)
    return D(rng.randint(1, 200) * 1000)


def rand_household(rng):
    size = rng.choices(range(1, 9), weights=FAMILY_WEIGHTS)[0]
    return size, rng.randint(0, size - 1), rng.choice(YEARS)


def rand_agi(rng, size, year):
    u = rng.random()
    if u < 0.10:                                     # under 150% of the poverty guideline
        return D(rng.randint(0, int(R.IBR_POVERTY_MULTIPLE * R.poverty_guideline(year, size)) - 1))
    if u < 0.30:
        return D(rng.randint(0, 60000))
    if u < 0.45:
        return D(rng.randint(60000, 120000))
    if u < 0.85:
        return D(int(math.exp(rng.uniform(math.log(10000), math.log(250000)))))
    if u < 0.95:
        return dec2(D(rng.randint(0, 25000000)) / 100)   # with cents
    k = rng.randint(1, 10)
    return D(10000 * k + rng.randint(-5, 5))          # within $5 of a RAP band edge


def edge_cases(rng):
    out = []
    m = lambda: rng.choice(RATE_MILLES)               # noqa: E731

    # A. RAP band edges (every edge, one cent under and over, and SADEF's +$1), each twice
    agis = [D(0), D('0.01'), D(1), D('9999.99'), D(10000), D('10000.01'), D(10001), D(12005), D(12006)]
    for k in range(2, 11):
        e = D(10000 * k)
        agis += [e - CENT, e, e + CENT, e + 1]
    agis.append(AGI_HI)
    for agi in agis:
        size, _, year = rand_household(rng)
        out.append(case(rand_balance(rng), m(), agi, size, 0, year, 'rap edge, no dependents'))
        size, deps, year = rand_household(rng)
        out.append(case(rand_balance(rng), m(), agi, size, deps, year, 'rap edge'))

    # B. RAP payments exactly on a half cent (pct x AGI = 6 mod 12 in cents; none exist at 4% or 8%)
    for pct in (1, 2, 3, 5, 6, 7, 9, 10):
        lo = 10000 * pct
        hits = [a for a in range(lo + 1, lo + 10001) if (pct * a) % 12 == 6]
        for a in rng.sample(hits, 2):
            raw = F(pct * a, 1200)
            deps = 0 if pct <= 2 else rng.randint(0, min(7, int((raw - 10) // 50)))
            size = rng.randint(deps + 1, 8)
            out.append(case(rand_balance(rng), m(), a, size, deps, rng.choice(YEARS), 'rap half cent'))

    # C. IBR edges at 150% of the poverty line: every family size, both years
    for year in YEARS:
        for size in range(1, 9):
            line = R.IBR_POVERTY_MULTIPLE * R.poverty_guideline(year, size)
            for dx in ('-0.01', '0', '0.01', '599', '599.39', '599.40', '600', '1199', '1199.40', '1200'):
                deps = rng.randint(0, size - 1)
                out.append(case(rand_balance(rng), m(), line + D(dx), size, deps, year, 'ibr poverty edge'))

    # D. IBR payments exactly on a half cent (discretionary income = 3 mod 6)
    for _ in range(10):
        size, deps, year = rand_household(rng)
        over = 6 * rng.randint(100, 6000) + 3
        agi = R.IBR_POVERTY_MULTIPLE * R.poverty_guideline(year, size) + over
        out.append(case(D(rng.randint(600, 2000) * 100), m(), agi, size, deps, year, 'ibr half cent'))

    # E. IBR at the cap: raw payment = cap -0.00508, -0.005, -0.00008, 0, +0.00008, +0.005
    made = 0
    while made < 6:
        size, deps, year = rand_household(rng)
        bal = dec2(D(repr(math.exp(rng.uniform(math.log(8000), math.log(150000))))))
        mil = m()
        cap = R.standard_payment(bal, D(mil) / 1000)
        base = R.IBR_POVERTY_MULTIPLE * R.poverty_guideline(year, size) + 120 * cap
        if base + 1 > AGI_HI:
            continue
        for dx in ('-0.61', '-0.60', '-0.01', '0', '0.01', '0.60'):
            out.append(case(bal, mil, base + D(dx), size, deps, year, 'ibr cap edge'))
        made += 1

    # F. The standard plan's $50 floor (level payment 49.99 / 50.00 / 50.01) and the balance limits
    for mil in (30, 55, 68, 90):
        r = F(mil, 12000)
        per_dollar = r / (1 - 1 / g_pow(mil, STD_N))
        for want in ('49.99', '50.00', '50.01'):
            bal = F(want) / per_dollar
            size, deps, year = rand_household(rng)
            out.append(case(dec2(D(bal.numerator) / D(bal.denominator)), mil, rand_agi(rng, size, year),
                            size, deps, year, 'standard $50 floor edge'))
    for bal in (BAL_LO, BAL_LO, BAL_HI, BAL_HI):
        size, deps, year = rand_household(rng)
        out.append(case(bal, m(), rand_agi(rng, size, year), size, deps, year, 'balance limit'))

    # G. Hand-picked RAP and IBR shapes, and RULES.md's worked examples
    fixed = [
        # (balance, milles, agi, size, deps, year, kind)
        (1040, 90, 45060, 3, 2, 2026, 'rap $50.20 ends on the line'),
        (2030, 60, 45030, 4, 2, 2025, 'rap $50.10 ends on the line'),
        (2010, 30, 45030, 3, 2, 2026, 'rap $50.10 ends on the curve'),
        (45000, 65, 45000, 3, 2, 2026, 'rap exactly $50'),
        (50000, 60, 60000, 1, 0, 2026, 'rap payment = interest'),
        (40000, 60, 60000, 2, 0, 2025, 'rap principal part exactly $50'),
        (1500, 50, 240000, 1, 0, 2026, 'rap one payment'),
        (1000, 90, 250000, 2, 1, 2025, 'rap one payment'),
        (50000, 60, D(23940) + 30000, 1, 0, 2026, 'ibr payment = interest'),
        (50000, 60, D(23475) + 30000, 1, 0, 2025, 'ibr payment = interest'),
        (30000, 60, 45000, 3, 2, 2026, 'RULES.md example 1'),
        (50000, 65, 45000, 3, 2, 2026, 'RULES.md example 2'),
        (50000, 65, 45000, 3, 2, 2025, 'RULES.md example 2 (2025 line)'),
        (40000, 65, 32000, 2, 1, 2026, 'RULES.md example 3a'),
        (40000, 65, 60000, 1, 0, 2026, 'RULES.md example 3b'),
        (40000, 65, 40000, 2, 1, 2026, 'RULES.md example 3c'),
        (40000, 65, 40001, 2, 1, 2026, 'RULES.md example 3c'),
        (60000, 65, 85000, 4, 2, 2026, 'RULES.md example 3d'),
    ]
    for bal, mil, agi, size, deps, year, kind in fixed:
        out.append(case(D(bal), mil, D(agi), size, deps, year, kind))
    return out


def random_case(rng):
    size, deps, year = rand_household(rng)
    return case(rand_balance(rng), rng.choice(RATE_MILLES), rand_agi(rng, size, year), size, deps, year,
                'random')


# ============================================== run ===============================================

def rap_band(agi):
    agi = fr(agi)
    return 0 if agi <= 10000 else min(10, math.ceil(agi / 10000) - 1)


def main():
    t0 = time.time()
    check_examples()
    rng = random.Random(SEED)
    cases = edge_cases(rng)
    n_edge = len(cases)
    while len(cases) < ROWS:
        cases.append(random_case(rng))
    assert len(cases) == ROWS, len(cases)

    stats, bands = Counter(), Counter()
    worst = {'cent-rounded interest moves standard_total_paid': F(0)}
    out = []
    for idx, c in enumerate(cases):
        case_id = f'sl-edge-{idx + 1:03}' if idx < n_edge else f'sl-{idx + 1 - n_edge:04}'
        one, two = columns(derive_1(c)), columns(derive_2(c))
        for col in MONTHS_OUT:
            if one[col] != two[col]:
                raise SystemExit(f'{case_id} {col}: month by month {one[col]} vs closed form {two[col]}; CSV not written')
        for col in MONEY_OUT:
            if abs(half_up(one[col]) - half_up(two[col])) > F(1, 100):
                raise SystemExit(f'{case_id} {col}: {float(one[col])} vs {float(two[col])}; CSV not written')
            stats['columns that differ at all before rounding (should be 0)'] += one[col] != two[col]
        v = two
        b, r = fr(c['balance']), fr(c['rate']) / 12
        agi, cap = fr(c['agi']), v['standard_monthly']
        line = F(3, 2) * poverty_2(c['year'], c['family_size'])

        stats['rows'] += 1
        stats[f'kind: {c["kind"]}'] += 1
        stats[f'guideline year {c["year"]}'] += 1
        stats[f'family size {c["family_size"]}'] += 1
        stats[f'dependents {c["dependents"]}'] += 1
        bands[rap_band(agi)] += 1
        # standard
        level = b * r / (1 - 1 / g_pow(c['milles'], STD_N))
        stats['standard: $50 floor applies'] += level < 50
        stats['standard: paid off before month 120 ($50 floor)'] += v['standard_months'] < 120
        stats['standard: 120th payment larger than the others'] += (
            v['standard_months'] == 120 and v['standard_total_paid'] > 120 * v['standard_monthly'])
        # IBR
        raw_ibr = max(ZERO, agi - line) / 120
        ibr = v['ibr_monthly']
        stats['AGI under 150% of the poverty line'] += agi < line
        stats['ibr: $0 payment'] += ibr == 0
        stats['ibr: $10 minimum ($5 to under $10 raised to $10)'] += ibr == 10 and raw_ibr < 10
        stats['ibr: payment = the standard cap'] += ibr == cap
        stats['ibr: cap binds (raw payment above the cap)'] += raw_ibr > cap
        stats['ibr: raw payment exactly on a half cent, below the cap'] += (
            (raw_ibr * 100).denominator == 2 and raw_ibr < cap and ibr >= 10)
        stats['ibr: 0 < payment < first month\'s interest (unpaid interest builds)'] += 0 < ibr < b * r
        stats['ibr: paid off'] += v['ibr_forgiven'] == 0
        stats['ibr: forgiven after 240 months'] += v['ibr_forgiven'] > 0
        stats['ibr: at the cap and needing a 121st payment'] += ibr == cap and v['ibr_months'] == 121
        stats['ibr: below the cap and paid off after month 120'] += ibr < cap and 120 < v['ibr_months'] < 240
        # RAP
        rap = v['rap_monthly']
        base = F(120) if rap_band(agi) == 0 else agi * rap_band(agi) / 100
        raw_rap = base / 12 - 50 * c['dependents']
        stats['rap: $10 minimum applies'] += raw_rap < 10
        stats['rap: dependents lower the payment'] += c['dependents'] > 0 and raw_rap + 50 * c['dependents'] > 10
        stats['rap: raw payment exactly on a half cent, above $10'] += (raw_rap * 100).denominator == 2 and rap > 10
        stats['rap: month 1 interest waived (payment < interest)'] += rap < b * r
        stats['rap: month 1 principal match'] += (rap - b * r) < 50 and b * (1 + r) > rap
        stats['rap: payment is more than principal + first month\'s interest'] += rap > b * (1 + r)
        stats['rap: paid off'] += v['rap_forgiven'] == 0
        stats['rap: forgiven after 360 payments'] += v['rap_forgiven'] > 0
        for col in MONEY_OUT:
            stats['output values exactly on a half cent'] += (v[col] * 100).denominator == 2

        # information only: rules.standard_schedule rounds each month's interest to the cent
        _, n_c, paid_c, _ = R.standard_schedule(c['balance'], c['rate'])
        gap = abs(F(paid_c) - half_up(v['standard_total_paid']))
        stats['cent-rounded monthly interest would change standard_total_paid'] += gap != 0
        worst['cent-rounded interest moves standard_total_paid'] = max(
            worst['cent-rounded interest moves standard_total_paid'], gap)
        stats['cent-rounded monthly interest would change standard_months'] += n_c != v['standard_months']

        row = {'case_id': case_id, 'balance': f'{c["balance"]:.2f}', 'annual_rate': f'{c["rate"]:.3f}',
               'agi': f'{c["agi"]:.2f}', 'family_size': c['family_size'], 'dependents': c['dependents'],
               'guideline_year': c['year']}
        for col in COLUMNS[7:]:
            row[col] = v[col] if col in MONTHS_OUT else money(v[col])
        out.append(row)

    OUT.parent.mkdir(parents=True, exist_ok=True)
    with OUT.open('w', newline='', encoding='utf-8') as fh:
        w = csv.DictWriter(fh, fieldnames=COLUMNS, lineterminator='\n')
        w.writeheader()
        w.writerows(out)
    print(f'wrote {OUT.relative_to(ROOT)}: {len(out)} rows ({n_edge} edge rows, {len(out) - n_edge} random); '
          f'month by month and closed form agree on every column of every row ({time.time() - t0:.0f} s)')
    print('  rap band (0 = flat $120 base, AGI <= 10,000; k = k% of AGI): ' +
          ', '.join(f'{k}: {bands[k]}' for k in range(11)))
    for k in sorted(stats):
        print(f'  {k}: {stats[k]}')
    for k, x in worst.items():
        print(f'  largest {k}: {float(x):.2f}')


if __name__ == '__main__':
    main()
