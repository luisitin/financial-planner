"""Vehicles, Big purchase planner and Renovation answer key. Three CSVs of invented households.

Run:  python3 -B -I tools/golden_property_goals/pg_key.py [out_dir] [--mutate NAME] [--skip-examples]

Writes tests/golden/property-goals/vehicles.csv (1,500 households with one or two cars: each car's year, and the keep /
buy / lease what-if for the first car), purchases.csv (1,500 big purchases: save up, finance, pay cash, and the goals that
give way) and renovations.csv (1,500 home projects: cash, home-equity line, cash-out refinance, personal loan, ranked by
today's money). Standard library only, exact arithmetic (fractions.Fraction), deterministic (random.Random(20261031); the
generator draws only integers, never a float). The figures and the model come from rules.py next to this file; the
sources and the reasons are in tests/golden/property-goals/RULES.md and in README.md here. Nothing under modules/, core/
or tests/*.test.mjs was opened, and the app is never imported.

Model (the pages' documented conventions, "page convention", made exact by rules.py; where a fact a page states could be
wrong, the main columns keep the page's arithmetic and a law / contrast column gives the other figure with its source):
  * vehicles: a car's year (value lost, fuel or electricity, insurance, upkeep, registration, the loan's interest over the
    next 12 payments; total, per mile, monthly). What-if over whole years: keep (only the upkeep rising, V1), buy
    (trade-in, sales tax, cash down, a level-payment loan, the new car's value; running costs flat, V2), lease (due at
    signing per lease started, payments, excess miles, running costs flat with upkeep halved, V2, less a positive
    trade-in); keep's back less what the old loan still owes; cost = paid - back; cash back when the equity and the cash
    down cover the new car with its tax (A7); the cheapest by a walk keep, buy, lease with a $1 margin (A9); blank
    what-if inputs take the page's defaults (D1: 32 mpg, $500 upkeep, ...), and on an electric first car a blank new mpg
    leaves the new car charged like the car (E1). Contrasts: every running cost rising (the
    key's first reading, A1), Keep's upkeep-only rule on Buy and Lease, the lease with the old car's running costs or
    without the trade-in credited (the brief's), the tax on the price less the trade-in, keep with the debt left in (the
    brief's), the cheapest as the lowest (A9's earlier reading), a blank new mpg or upkeep keeping the old car's (A3), an
    electric first car's new car at 32 mpg and its fuel price (E1's contrast, the fourth revision's reading).
  * purchases: total with tax, whole months to the date (W2, P1; W1 and W3 beside it), save up (an ordinary annuity on
    the set-aside money at cash return / 12), finance (level, all 0%, or 0% for the promo months then the APR, one level
    payment), pay cash (fits when the usable cash covers the amount, P3), goals giving way least important first
    (latest due first within a priority; a goal already done skipped, P2; a spare below 0 counted as 0, B5) and their new
    arrival. Contrasts: save up by W1, done goals giving too, cash fitting only above the emergency target, the level
    payment from the start, all 0%, a deferred-interest charge-back, a spare below 0 taken literally.
  * renovations: value added, equity change, cash and the cushion in months; the home-equity line (85% combined limit,
    borrowable at least 0); the cash-out refinance (closing costs 3% of mortgage + cost; fits when the new loan is at most
    80% of the value, FHA's cash-out limit; none without a mortgage, R3; a blank rate or years 6.5% and 30 years, D1)
    against keeping the old mortgage; the personal loan; tax saved when itemizing on the acquisition debt up to $750,000
    ($375,000), closing costs left out (R1), for the line by IRS Publication 936 Table 1: the line's share also cuts the
    mortgage's deduction over the line's term (L1); today's money at the plan's return after the tax saved, discounted
    like the payments (R2, L1); the best by a walk that changes only for more than $1 less, the ranking that walk
    repeated (R5). Contrasts: 3% of the new loan, tax with no limit, R1's line figure, today's money before tax, a
    refinance with no mortgage, no refinance with a blank rate or years, the ranking sorted plainly, before tax or with
    R1's line.

Two derivations of every value, run on every row before anything is written:
  derivation 1  rules.py: vehicles_case (car_year, run_loan month by month, keep_way, buy_way, lease_way, running_costs as
                a sum over the years, used_value and new_value as powers), big_purchase_case (whole_months by add_months
                stepping, save_up_monthly in closed form, promo_payment in closed form, give_way with months_to_goal from
                a logarithm guess corrected exactly) and renovation_case (level_payment closed form, annuity_pv closed
                form, the old mortgage run month by month and its payments summed one by one).
  derivation 2  this file, written separately from the CSV's own input strings (its own number and date parser), with
                the page conventions restated here from the brief: every fixed-payment loan in closed form (balance after
                k payments = B g^k - P (g^k - 1) / r, the payoff month found by bisection on that, interest = paid -
                principal repaid); level payments as A r g^n / (g^n - 1); running costs as one geometric series; values
                by stepping year by year; whole months from the calendar difference and one day test; save up from an
                annuity factor summed by Horner's rule; the promo payment from two runs of the schedule (the final
                balance is linear in the payment); goals' months by doubling and bisection on the closed-form balance;
                the giving order by repeated selection over the goals not done; today's money of a level payment by
                Horner's rule, of the old mortgage in closed form (level part plus the smaller last payment); the
                interest's PV in closed form, (rA - p) v sum (g v)^k + p a_n (rules.py steps the loan month by month);
                W2 by comparing (year, month, day) with the day not clamped; the best by jumping to the first later way
                more than $1 lower, the ranking by repeating that; the mortgage over the line's term (L1) by the same
                closed-form loan with the line's months as its limit (rules.py takes the first months of the old
                mortgage stepped month by month); the D1 defaults restated here.
The script refuses to write any CSV if an amount differs by more than a cent, a rate or ratio by more than 1e-6, or any
other value (count, month, date, flag, label, order) differs at all, between the two. All three CSVs are worked first and
written only if all pass. --mutate NAME puts one deliberate mistake into derivation 2 (see MUTATIONS) to show the guard
refuses; --skip-examples turns off the RULES.md examples check so the row guard has to find it alone.
"""
import sys
sys.dont_write_bytecode = True  # before importing rules.py, so no __pycache__ lands in the repo

import csv
import hashlib
import io
import random
import time
import traceback
from collections import Counter
from datetime import date
from decimal import Decimal as D
from fractions import Fraction as F
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import rules as R  # noqa: E402  (importing it runs rules.check_rules(), 194 self-checks)

ROOT = HERE.parents[1]
OUT_DIR = ROOT / 'tests' / 'golden' / 'property-goals'
SEED = 20261031
SEED_FUEL = SEED + 1   # fourth revision: a second stream, only for the fuel price an electric first car now carries (E1's contrast)
N_VEH, N_PUR, N_REN = 1500, 1500, 1500
# Fourth revision (2026-10-31): the random rows are the same draws as in the third revision. Each file draws
# as many random cases as it did then and keeps the first ones that fit after its edge rows (now more of them), so every
# random row of the third revision but the last few can be found again by its inputs; its id moves by the number of
# edge rows added. The electric first cars' new fuel price comes from SEED_FUEL, so the main stream is unchanged.
RANDOM_DRAWS = {'veh': 1476, 'pur': 1468, 'ren': 1485}
ZERO, ONE, CENT, MICRO = F(0), F(1), F(1, 100), F(1, 10 ** 6)
TODAY = date(2026, 10, 31)  # the brief: "Today is 2026-10-31"
assert R.TODAY == TODAY

MUTATIONS = {
    'loan_no_cut': "a loan's last payment is never cut to the balance plus interest",
    'keep_rise_all': "Keep's running costs all rise each year (the key's first reading), not only the upkeep",
    'buy_lease_rise': "Buy's and Lease's upkeep rises each year (Keep's rule), not flat",
    'lease_old_running': "the lease uses the old car's running costs (upkeep halved), not the new car's",
    'lease_floor': 'leases started in the period = floor(period / lease months), not ceil',
    'new_car_085_from_year_one': 'a new car loses 15% a year from year one (no 20% first year)',
    'trade_in_taxed': 'the new car is taxed on its price less the trade-in',
    'months_w1': 'whole months by W1 (add_months, a month end moving to a month end), not W2',
    'save_at_start': 'save-up deposits at the start of each month (an annuity due)',
    'promo_ignored': 'the promo months are charged interest too (a level payment from the start)',
    'give_earliest_first': 'within a priority the earliest due date gives way first',
    'done_goal_gives': 'a goal already done gives way too (and is paused when it gives all)',
    'goal_months_floor': "a goal's months rounded down, not up",
    'refi_share_of_new_loan': 'refinance closing costs 3% of the new loan, not of mortgage + cost',
    'refi_always_fits': 'the refinance always fits (no 80% cash-out limit)',
    'lease_equity_dropped': 'the lease credits nothing for a positive trade-in',
    'keep_owed_ignored': "keep's back leaves in what the old loan still owes at the end",
    'earned_uncapped': 'earned counts all the set-aside money, so it is below 0 when more than the total is set aside',
    'borrowable_negative': 'what could be borrowed is written below 0',
    'cltv_80': 'the line can borrow up to 80% of the value, not 85%',
    'tax_without_itemizing': 'tax saved is counted without itemizing too',
    'pv_from_month_0': 'payments discounted from month 0 (the first payment not discounted)',
    'tax_no_limit': 'tax saved on the whole interest (line) and the extra interest (refinance): no limit, closing costs counted',
    'todays_money_before_tax': "today's money before the tax saved",
    'refi_without_mortgage': 'a home without a mortgage gets a refinance with an old side of 0',
    'best_lowest': "the best is the lowest today's money, with no $1 margin",
    'cash_fits_emergency': 'pay cash fits only when what is left is at least the emergency target',
    'line_law_mortgage_kept': "the line's tax saved keeps the mortgage's whole deduction (R1, the earlier main), not L1",
    # fourth revision (2026-10-31): one deliberate mistake for each new stated convention
    'line_whole_mortgage_life': "L1: the mortgage's interest taken over its whole remaining life, not the line's term",
    'cash_back_dropped': 'A7: an equity and cash down above the new price with tax do not come back as cash',
    'cheapest_no_margin': 'A9: the cheapest is the lowest cost, with no $1 margin',
    'negative_spare_literal': 'B5: need = amount - spare even when spare is below 0',
    'blank_mpg_keeps_old_fuel': "D1: a blank new mpg keeps the old car's fuel cost, not 32 mpg (a petrol car)",
    # corrected after the fourth revision's comparison with the page (2026-10-31)
    'electric_new_at_32_mpg': "E1: on an electric first car a blank new mpg is 32 at its fuel price, not charged like the car",
}
MUT = None


# ======================================== small helpers ========================================

def fr(x):
    """str / int / Decimal / Fraction -> exact Fraction (never float)."""
    if isinstance(x, float):
        raise TypeError('no floats')
    if isinstance(x, F):
        return x
    if isinstance(x, (int, D)):
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
    """A rate or ratio with six decimals, half up (away from zero); '' for None."""
    if x is None:
        return ''
    c = rhu(fr(x) * 10 ** 6)
    sign = '-' if c < 0 else ''
    c = abs(c)
    return f'{sign}{c // 10 ** 6}.{c % 10 ** 6:06d}'


def whole(x):
    """An exact whole number (a count of miles); '' for None."""
    if x is None:
        return ''
    x = fr(x)
    assert x.denominator == 1, x
    return str(x.numerator)


def usd(x):
    """Money for a note: two decimals, thousands separated."""
    m = money(x)
    sign = '-' if m.startswith('-') else ''
    w, frac = m.lstrip('-').split('.')
    return f'{sign}{int(w):,}.{frac}'


def half_cent(x):
    return x is not None and not isinstance(x, (bool, int, str)) and (fr(x) * 100).denominator == 2


def yn(b):
    return '' if b is None else ('yes' if b else 'no')


def iso(d):
    return '' if d is None else d.isoformat()


def fmt(kind, v):
    if kind == 'm':
        return money(v)
    if kind == 'r':
        return rate6(v)
    if kind == 'n':
        return whole(v)
    if v is None:
        return ''
    if isinstance(v, bool):
        return yn(v)
    if isinstance(v, date):
        return v.isoformat()
    return str(v)


def join_note(bits):
    """A note's parts joined by '; ', each said once."""
    out = []
    for b in bits:
        if b and b not in out:
            out.append(b)
    return '; '.join(out)


def ceil_f(q):
    q = fr(q)
    return -((-q.numerator) // q.denominator)


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
        self.n['rates and ratios compared'] += 1
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

    def lists(self, where, what, spec, a, b):
        self.same(where, what + ' (count)', len(a), len(b))
        for i, (x, y) in enumerate(zip(a, b)):
            self.fields(f'{where} {what}[{i}]', spec, x, y)


# ======================================== derivation 2: its own reading of the inputs ========================================
# The page conventions restated from the brief (not imported from rules.py, so a slip in either shows in the guard).
LOSS_2 = F(12, 100)                  # used car: loss a year, blank = 12%
NEW_Y1_2, NEW_LATER_2 = F(8, 10), F(85, 100)   # new car: x 0.8 after year one, then x 0.85 a year
SHARE_2 = F(125, 100)                # new insurance share, blank = 1.25
RISE_2 = F(10, 100)                  # upkeep rise, blank = 10% a year
LEASE_UPKEEP_2 = F(1, 2)             # lease: running costs with upkeep halved
STOP_2 = F(5, 1000)                  # a loan stops at a balance of 0.005 or less
HELOC_RATE_2, HELOC_YEARS_2 = F(8, 100), 10
REFI_SHARE_2 = F(3, 100)
LOAN_RATE_2, LOAN_YEARS_2 = F(12, 100), 5
CLTV_2 = F(85, 100)                  # borrowable = value x 85% - mortgage
FHA_2 = F(80, 100)                   # HUD Mortgagee Letter 2019-11: a cash-out refinance at most 80% of value (the refinance's fit)
MARGIN_2 = F(1)                      # R5: a later way is the best only when its today's money is lower by more than $1
CHEAP_MARGIN_2 = F(1)                # A9: a later way is the cheapest only when its cost is lower by more than $1 (as R5)
# D1, the pages' defaults for blank inputs (stated 2026-10-31): a blank new mpg 32, a blank new upkeep $500, new price
# 35,000, tax 6%, rate 7%, term 60, lease 450 a month, 3,000 due at signing, 36 months, 12,000 miles a year, 0.25 a mile
# over; a blank refinance rate or years 6.5% and 30 years
NEW_MPG_2, NEW_UPKEEP_2, NEW_PRICE_2 = F(32), F(500), F(35000)
NEW_TAX_2, NEW_RATE_2, NEW_TERM_2 = F(6, 100), F(7, 100), 60
LEASE_PAY_2, LEASE_DUE_2, LEASE_MONTHS_2, LEASE_MILES_2, LEASE_OVER_2 = F(450), F(3000), 36, F(12000), F(1, 4)
REFI_RATE_2, REFI_YEARS_2 = F(13, 200), 30
LIMIT_2 = {'married_separate': 375000, 'other': 750000}   # 26 U.S.C. 163(h)(3)(F)(i)(II)
CAP_2 = 1200                         # a goal still short after 1,200 months is "never" (the key's guard)
MDAYS_2 = (31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31)


def num_2(s):
    """Derivation 2's own reading of a CSV number ('', '-0.0125', '1234.56') -> Fraction or None."""
    s = s.strip()
    if s == '':
        return None
    neg = s[0] == '-'
    if s[0] in '+-':
        s = s[1:]
    w, _, frac = s.partition('.')
    assert (w + frac).isdigit(), s
    v = F(int(w or '0') * 10 ** len(frac) + int(frac or '0'), 10 ** len(frac))
    return -v if neg else v


def day_2(s):
    s = s.strip()
    if s == '':
        return None
    y, m, d = (int(p) for p in s.split('-'))
    return date(y, m, d)


def dflt(v, default):
    return default if v is None else v


def z_(v):
    return ZERO if v is None else v


def yes_2(s):
    return s.strip().lower() in ('yes', 'y', 'true', '1')


def mlen_2(y, m):
    leap = y % 4 == 0 and (y % 100 != 0 or y % 400 == 0)
    return 29 if (m == 2 and leap) else MDAYS_2[m - 1]


def plus_months_2(d, k):
    """d moved k calendar months on: the same day, or the month's last day when that day does not exist; from a
    month's last day, the target month's last day (W1)."""
    t = d.month - 1 + k
    y, m = d.year + t // 12, t % 12 + 1
    last = mlen_2(y, m)
    if d.day == mlen_2(d.year, d.month):
        return date(y, m, last)
    return date(y, m, min(d.day, last))


def months_2(start, end, rule='W2'):
    """Whole months from start to end, at least 1. W2 (P1, the page's): the largest k for which start's day of the month
    k calendar months on is on or before end, compared as (year, month, day) with the day not clamped to the month's
    length (from the 31st, a 30-day month's last day is not reached). W1 (contrast): the calendar difference, less one
    when start moved that many months on (plus_months_2) lands after end. W3: the calendar difference."""
    if MUT == 'months_w1' and rule == 'W2':
        rule = 'W1'
    diff = (end.year - start.year) * 12 + end.month - start.month
    if rule == 'W3':
        k = diff
    elif rule == 'W2':
        k = diff + 1
        while True:                                # step down from one above the calendar difference
            t = start.month - 1 + k
            if (start.year + t // 12, t % 12 + 1, start.day) <= (end.year, end.month, end.day):
                break
            k -= 1
    elif end < start:
        k = 0
    else:
        k = diff if plus_months_2(start, diff) <= end else diff - 1
    return max(1, k)


def pay_level_2(a, annual, n):
    """Level payment, written as A r g^n / (g^n - 1), g = 1 + r (r = 0: A / n)."""
    r = annual / 12
    if a == 0:
        return ZERO
    if r == 0:
        return a / n
    g = (1 + r) ** n
    return a * r * g / (g - 1)


def loan_2(b, annual, p, limit=None):
    """A fixed payment p on balance b at annual / 12, in closed form. The balance after k uncut payments is
    B_k = b g^k - p (g^k - 1) / r (r = 0: b - p k). The payment is cut in the first month k* + 1 whose interest-added
    balance B_k* g is at most p (found by doubling and bisection on B_k g <= p, which is monotone when p > b r); the run
    stops after `limit` months, or once the balance is 0.005 or less. Interest = paid - (b - end balance)."""
    r = annual / 12
    g = 1 + r
    if b <= STOP_2:
        return {'months': 0, 'paid': ZERO, 'end': b, 'interest': ZERO, 'level': 0, 'last': None}

    def bal(k):
        if r == 0:
            return b - p * k
        x = g ** k
        return b * x - p * (x - 1) / r

    def cut(k):
        return bal(k) * g <= p

    if p <= 0 or (r > 0 and p <= b * r):
        kstar = None                                            # never paid off
    elif cut(0):
        kstar = 0
    elif r == 0:
        kstar = ceil_f(b / p - 1)
    else:
        lo, hi = 0, 1
        while not cut(hi):
            lo, hi = hi, hi * 2
        while hi - lo > 1:
            mid = (lo + hi) // 2
            if cut(mid):
                hi = mid
            else:
                lo = mid
        kstar = hi
    if kstar is not None:
        assert p * 200 > g, 'a payment this small could stop early on the 0.005 rule'
    if kstar is None or (limit is not None and limit <= kstar):
        if limit is None:
            raise ValueError('the payment never pays this loan off')
        e, paid, months, level, last = bal(limit), p * limit, limit, limit, None
    else:
        e0 = bal(kstar)
        if e0 <= STOP_2:
            e, paid, months, level, last = e0, p * kstar, kstar, kstar, None
        else:
            last = p if MUT == 'loan_no_cut' else e0 * g
            e, paid, months, level = ZERO, p * kstar + last, kstar + 1, kstar
    return {'months': months, 'paid': paid, 'end': e, 'interest': paid - b + e, 'level': level, 'last': last}


_PV_CACHE = {}


def pv_factor_2(annual, n):
    """sum over m = 1..n of 1 / (1 + annual / 12)^m by Horner's rule: acc = (acc + 1) v, n times."""
    key = (annual, n, MUT)
    if key not in _PV_CACHE:
        v = 1 / (1 + annual / 12)
        acc = ZERO
        for _ in range(n):
            acc = (acc + 1) * v
        if MUT == 'pv_from_month_0':
            acc = acc / v
        _PV_CACHE[key] = acc
    return _PV_CACHE[key]


def pv_loan_2(L, p, annual):
    """Today's money of loan_2's payments in closed form: the level part p (1 - v^k) / j plus the last (cut) payment
    discounted k + 1 months."""
    j = annual / 12
    k = L['level']
    s = F(k) if j == 0 else (1 - (1 / (1 + j)) ** k) / j
    pv = p * s
    if L['last'] is not None:
        pv += L['last'] / (1 + j) ** (k + 1)
    if MUT == 'pv_from_month_0':
        pv = pv * (1 + j)
    return pv


# ======================================== page A: vehicles ========================================

CAR_FIELDS = ('name', 'value', 'miles', 'mpg', 'fuel_price', 'electric', 'kwh_per_mile', 'kwh_price', 'insurance',
              'maintenance', 'registration', 'loss', 'loan_balance', 'loan_rate', 'loan_payment')
WHATIF_FIELDS = ('years', 'new_price', 'new_sales_tax', 'new_mpg', 'new_rate', 'new_term', 'cash_down',
                 'new_insurance_share', 'new_maintenance', 'lease_monthly', 'lease_due', 'lease_months', 'lease_miles',
                 'lease_excess', 'upkeep_rise')
CAR_SPEC = (('value_lost', 'm'), ('fuel', 'm'), ('insurance', 'm'), ('maintenance', 'm'), ('registration', 'm'),
            ('loan_interest', 'm'), ('total', 'm'), ('per_mile', 'r'), ('monthly', 'm'), ('loan_paid_year', 'm'),
            ('loan_balance_after_year', 'm'), ('loan_months_year', 's'))
VEH_SPEC = (('period_months', 's'), ('trade_in', 'm'), ('loan_left', 'm'), ('negative_trade_in_cash', 'm'),
            ('financed', 'm'), ('cash_back', 'm'), ('new_payment', 'm'),
            ('keep_loan_paid', 'm'), ('keep_loan_months', 's'), ('keep_running', 'm'), ('keep_paid', 'm'),
            ('keep_end_value', 'm'), ('keep_owed_end', 'm'), ('keep_back', 'm'), ('keep_cost', 'm'),
            ('keep_cost_monthly', 'm'),
            ('buy_loan_paid', 'm'), ('buy_loan_months', 's'), ('buy_running', 'm'), ('buy_paid', 'm'),
            ('buy_end_value', 'm'), ('buy_owed_end', 'm'), ('buy_back', 'm'), ('buy_cost', 'm'), ('buy_cost_monthly', 'm'),
            ('lease_count', 's'), ('lease_due_total', 'm'), ('lease_payments', 'm'), ('lease_excess_miles', 'n'),
            ('lease_excess_charge', 'm'), ('lease_running', 'm'), ('lease_paid', 'm'), ('lease_end_value', 'm'),
            ('lease_owed_end', 'm'), ('lease_back', 'm'), ('lease_cost', 'm'), ('lease_cost_monthly', 'm'),
            ('cheapest', 's'),
            ('lease_trade_in_credited', 'm'), ('alt_keep_rise_all', 'm'), ('alt_buy_rise_all', 'm'),
            ('alt_lease_rise_all', 'm'), ('alt_buy_rise_upkeep_only', 'm'), ('alt_lease_rise_upkeep_only', 'm'),
            ('alt_lease_old_running', 'm'),
            ('alt_lease_equity_not_credited', 'm'), ('alt_buy_tax_after_trade_in_credit', 'm'),
            ('alt_keep_owed_end_ignored', 'm'), ('new_car_loss_at_end', 'r'),
            ('alt_cheapest_lowest', 's'), ('alt_buy_blank_keeps_old', 'm'), ('alt_lease_blank_keeps_old', 'm'),
            ('alt_buy_electric_new_at_32_mpg', 'm'), ('alt_lease_electric_new_at_32_mpg', 'm'))


def split_cars(s):
    cars = []
    for part in s.split(';'):
        f = part.split('|')
        assert len(f) == len(CAR_FIELDS), part
        cars.append(dict(zip(CAR_FIELDS, f)))
    return cars


def veh_1(c):
    """Derivation 1: rules.vehicles_case on the CSV's input strings."""
    cars = split_cars(c['cars'])
    w = {k: c[k] for k in WHATIF_FIELDS}
    r = R.vehicles_case({'cars': cars, 'whatif': w})
    rows = []
    for cy in r['cars']:
        ln = cy['loan']
        rows.append({'value_lost': cy['value_lost'], 'fuel': cy['fuel'], 'insurance': cy['insurance'],
                     'maintenance': cy['maintenance'], 'registration': cy['registration'],
                     'loan_interest': cy['loan_interest'], 'total': cy['total'], 'per_mile': cy['per_mile'],
                     'monthly': cy['monthly'], 'loan_paid_year': ln['paid'] if ln else None,
                     'loan_balance_after_year': ln['end'] if ln else None,
                     'loan_months_year': ln['months'] if ln else None})
    wi = r['whatif']
    k, b, l = wi['ways']['keep'], wi['ways']['buy'], wi['ways']['lease']
    a = wi['alt']
    car = cars[0]
    out = {'cars': rows, 'period_months': wi['months'], 'trade_in': b['trade_in'],
           'loan_left': R._or(car['loan_balance'], 0), 'negative_trade_in_cash': b['negative_trade_in_cash'],
           'financed': b['financed'], 'cash_back': b['cash_back'], 'new_payment': b['payment'],
           'keep_loan_paid': k['loan_paid'], 'keep_loan_months': k['loan_months'], 'keep_running': k['running'],
           'keep_paid': k['paid'], 'keep_end_value': k['value_end'], 'keep_owed_end': k['owed_end'], 'keep_back': k['back'],
           'keep_cost': k['cost'], 'keep_cost_monthly': k['monthly'],
           'buy_loan_paid': b['loan_paid'], 'buy_loan_months': b['loan_months'], 'buy_running': b['running'],
           'buy_paid': b['paid'],
           'buy_end_value': b['value_end'], 'buy_owed_end': b['owed_end'], 'buy_back': b['back'], 'buy_cost': b['cost'],
           'buy_cost_monthly': b['monthly'],
           'lease_count': l['leases'], 'lease_due_total': l['due_total'], 'lease_payments': l['payments'],
           'lease_excess_miles': l['excess_miles'], 'lease_excess_charge': l['excess_miles_charge'],
           'lease_running': l['running'], 'lease_paid': l['paid'], 'lease_end_value': ZERO, 'lease_owed_end': ZERO,
           'lease_back': l['back'], 'lease_cost': l['cost'], 'lease_cost_monthly': l['monthly'],
           'cheapest': wi['cheapest'], 'lease_trade_in_credited': l['trade_in_credited'],
           'alt_keep_rise_all': a['rise_all']['keep'], 'alt_buy_rise_all': a['rise_all']['buy'],
           'alt_lease_rise_all': a['rise_all']['lease'],
           'alt_buy_rise_upkeep_only': a['rise_upkeep_only']['buy'],
           'alt_lease_rise_upkeep_only': a['rise_upkeep_only']['lease'],
           'alt_lease_old_running': a['lease_old_running'],
           'alt_lease_equity_not_credited': a['lease_equity_not_credited'],
           'alt_buy_tax_after_trade_in_credit': a['buy_tax_after_trade_in_credit'],
           'alt_keep_owed_end_ignored': a['keep_owed_end_ignored'], 'new_car_loss_at_end': wi['new_car_loss_at_end'],
           'alt_cheapest_lowest': a['cheapest_lowest'], 'alt_buy_blank_keeps_old': a['blank_keeps_old']['buy'],
           'alt_lease_blank_keeps_old': a['blank_keeps_old']['lease'],
           'alt_buy_electric_new_at_32_mpg': a['electric_new_at_32_mpg']['buy'],
           'alt_lease_electric_new_at_32_mpg': a['electric_new_at_32_mpg']['lease']}
    return out


def parse_car_2(d):
    k = {'name': d['name'], 'electric': yes_2(d['electric'])}
    for f in CAR_FIELDS:
        if f not in ('name', 'electric'):
            k[f] = num_2(d[f])
    return k


def fuel_2(k, mpg=None):
    if mpg is None and k['electric']:
        return k['miles'] * k['kwh_per_mile'] * k['kwh_price']
    return k['miles'] * k['fuel_price'] / (k['mpg'] if mpg is None else mpg)


def has_loan_2(k):
    return not (k['loan_balance'] is None and k['loan_rate'] is None and k['loan_payment'] is None)


def run_2(flat, upkeep, rise, years, mode):
    """Running costs over the period, with one geometric series geo = ((1 + rise)^Y - 1) / rise (rise 0: Y).
    'upkeep' (V1, Keep): flat x Y + upkeep x geo; 'flat' (V2, Buy and Lease): (flat + upkeep) x Y; 'all' (A1, the key's
    first reading, a contrast): (flat + upkeep) x geo."""
    geo = F(years) if rise == 0 else ((1 + rise) ** years - 1) / rise
    if mode == 'upkeep':
        return flat * years + upkeep * geo
    if mode == 'flat':
        return (flat + upkeep) * years
    assert mode == 'all', mode
    return (flat + upkeep) * geo


def new_mode_2():
    """V2: Buy and Lease run flat (the deliberate mistake buy_lease_rise gives them Keep's rising upkeep)."""
    return 'upkeep' if MUT == 'buy_lease_rise' else 'flat'


def buy_2(k, w, tin, new_flat, new_upk, rise, years, P, taxable=None, mode=None):
    """w: the what-if with D1's defaults already in place (whatif_2). A7: what is owed for the new car with its tax,
    less the equity and the cash down; below 0 it comes back as cash and nothing is financed."""
    price, tax, down = w['new_price'], w['new_sales_tax'], z_(w['cash_down'])
    base = price if taxable is None else taxable
    if MUT == 'trade_in_taxed' and taxable is None:
        base = max(ZERO, price - max(ZERO, tin))
    owed = price + base * tax - max(ZERO, tin) - down
    financed, negative = max(ZERO, owed), max(ZERO, -tin)
    cash_back = ZERO if (MUT == 'cash_back_dropped' or owed >= 0) else -owed           # A7
    rate = w['new_rate']
    if financed > 0:
        pmt = pay_level_2(financed, rate, int(w['new_term']))
        nl = loan_2(financed, rate, pmt, P)
    else:
        pmt, nl = ZERO, {'paid': ZERO, 'end': ZERO, 'months': 0}
    run = run_2(new_flat, new_upk, rise, years, mode or new_mode_2())
    nv = price
    for y in range(years):
        nv = nv * (NEW_LATER_2 if (y > 0 or MUT == 'new_car_085_from_year_one') else NEW_Y1_2)
    paid = down + negative + nl['paid'] + run - cash_back
    back = nv - nl['end']
    return {'financed': financed, 'cash_back': cash_back, 'negative': negative, 'payment': pmt, 'loan': nl,
            'running': run, 'value_end': nv, 'paid': paid, 'back': back, 'cost': paid - back}


def lease_2(k, w, tin, flat, upk, rise, years, P, mode=None):
    L = int(w['lease_months'])                    # w with D1's defaults in place (whatif_2)
    starts, t = 0, 0
    while t < P:                                  # a lease starts in months 0, L, 2L, ... while inside the period
        starts, t = starts + 1, t + L
    if MUT == 'lease_floor':
        starts = P // L
    due = w['lease_due'] * starts
    payments = w['lease_monthly'] * P
    over_miles = max(ZERO, k['miles'] - w['lease_miles']) * years
    charge = over_miles * w['lease_excess']
    run = run_2(flat, upk * LEASE_UPKEEP_2, rise, years, mode or new_mode_2())
    negative = max(ZERO, -tin)
    credited = ZERO if MUT == 'lease_equity_dropped' else max(ZERO, tin)   # the old car's equity, back at signing (A5)
    paid = due + payments + charge + run + negative - credited
    return {'leases': starts, 'due': due, 'payments': payments, 'over_miles': over_miles, 'charge': charge,
            'running': run, 'paid': paid, 'negative': negative}


def whatif_2(t):
    """D1: the what-if as the page reads it, every blank its stated default (cash down blank = 0)."""
    w = dict(t)
    for f, v in (('new_price', NEW_PRICE_2), ('new_sales_tax', NEW_TAX_2), ('new_mpg', NEW_MPG_2),
                 ('new_rate', NEW_RATE_2), ('new_term', F(NEW_TERM_2)), ('new_insurance_share', SHARE_2),
                 ('new_maintenance', NEW_UPKEEP_2), ('lease_monthly', LEASE_PAY_2), ('lease_due', LEASE_DUE_2),
                 ('lease_months', F(LEASE_MONTHS_2)), ('lease_miles', LEASE_MILES_2), ('lease_excess', LEASE_OVER_2),
                 ('upkeep_rise', RISE_2)):
        w[f] = dflt(t[f], v)
    return w


def veh_2(c):
    """Derivation 2 for one household, from the CSV's input strings."""
    cars = [parse_car_2(d) for d in split_cars(c['cars'])]
    rows = []
    for k in cars:
        lost = k['value'] * dflt(k['loss'], LOSS_2)
        fuel = fuel_2(k)
        ins, upk, reg = z_(k['insurance']), z_(k['maintenance']), z_(k['registration'])
        if has_loan_2(k):
            L = loan_2(z_(k['loan_balance']), z_(k['loan_rate']), z_(k['loan_payment']), 12)
            interest, lp, le, lm = L['interest'], L['paid'], L['end'], L['months']
        else:
            interest, lp, le, lm = ZERO, None, None, None
        total = lost + fuel + ins + upk + reg + interest
        rows.append({'value_lost': lost, 'fuel': fuel, 'insurance': ins, 'maintenance': upk, 'registration': reg,
                     'loan_interest': interest, 'total': total,
                     'per_mile': (total / k['miles']) if k['miles'] else None, 'monthly': total / 12,
                     'loan_paid_year': lp, 'loan_balance_after_year': le, 'loan_months_year': lm})
    typed = {f: num_2(c[f]) for f in WHATIF_FIELDS}
    w = whatif_2(typed)
    k = cars[0]
    years = int(w['years'])
    assert w['years'] == years and years > 0
    P = 12 * years
    bal = z_(k['loan_balance'])
    tin = k['value'] - bal
    rise, share, loss = w['upkeep_rise'], w['new_insurance_share'], dflt(k['loss'], LOSS_2)
    ins, upk, reg = z_(k['insurance']), z_(k['maintenance']), z_(k['registration'])
    old_fuel = fuel_2(k)
    # D1: a blank new mpg is 32 (the petrol rule at the car's own fuel price), a blank new upkeep $500; E1 (corrected
    # after the fourth revision's comparison): an electric car is charged by its kWh and the page does not compare gas
    # against electric, so on an electric first car a blank new mpg leaves the new car charged like the car (its fuel
    # price, which the rows carry, is only for E1's contrast: 32 mpg at that price). A3 (the key's earlier reading, the
    # contrast): a blank new mpg keeps the old car's fuel or electricity cost, a blank upkeep the old
    like_the_car = k['electric'] if MUT != 'electric_new_at_32_mpg' else False
    if typed['new_mpg'] is None and (like_the_car or MUT == 'blank_mpg_keeps_old_fuel'):
        new_fuel = old_fuel
    else:
        new_fuel = fuel_2(k, w['new_mpg'])
    e1_fuel = fuel_2(k, w['new_mpg'])                       # E1's contrast: the new mpg (32 when blank) on any car
    new_upk = w['new_maintenance']
    a3_fuel = old_fuel if typed['new_mpg'] is None else fuel_2(k, typed['new_mpg'])
    a3_upk = upk if typed['new_maintenance'] is None else typed['new_maintenance']
    old_flat, new_flat = old_fuel + ins + reg, new_fuel + ins * share + reg
    # keep
    if has_loan_2(k):
        old = loan_2(bal, z_(k['loan_rate']), z_(k['loan_payment']), P)
    else:
        old = {'paid': ZERO, 'end': ZERO, 'months': 0}
    keep_run = run_2(old_flat, upk, rise, years, 'all' if MUT == 'keep_rise_all' else 'upkeep')     # V1
    v = k['value']
    for _ in range(years):
        v = v * (1 - loss)
    keep_paid = old['paid'] + keep_run
    keep_back = v if MUT == 'keep_owed_ignored' else v - old['end']        # what the old loan still owes comes off (A6)
    keep_cost = keep_paid - keep_back
    # buy, lease
    b = buy_2(k, w, tin, new_flat, new_upk, rise, years, P)
    if MUT == 'lease_old_running':
        l = lease_2(k, w, tin, old_flat, upk, rise, years, P)
    else:
        l = lease_2(k, w, tin, new_flat, new_upk, rise, years, P)
    # A9: walk keep, buy, lease; a later way is the cheapest only when it costs more than $1 less than the current one.
    # The contrast (the key's earlier A9): the lowest, a tie to the earlier way.
    margin = ZERO if MUT == 'cheapest_no_margin' else CHEAP_MARGIN_2
    cheapest, best, lowest, low = 'keep', keep_cost, 'keep', keep_cost
    for name, cost in (('buy', b['cost']), ('lease', l['paid'])):
        if cost < best - margin:
            cheapest, best = name, cost
        if cost < low:
            lowest, low = name, cost
    out = {'cars': rows, 'period_months': P, 'trade_in': tin, 'loan_left': bal, 'negative_trade_in_cash': b['negative'],
           'financed': b['financed'], 'cash_back': b['cash_back'], 'new_payment': b['payment'],
           'keep_loan_paid': old['paid'], 'keep_loan_months': old['months'], 'keep_running': keep_run,
           'keep_paid': keep_paid, 'keep_end_value': v, 'keep_owed_end': old['end'], 'keep_back': keep_back,
           'keep_cost': keep_cost, 'keep_cost_monthly': keep_cost / P,
           'buy_loan_paid': b['loan']['paid'], 'buy_loan_months': b['loan']['months'], 'buy_running': b['running'],
           'buy_paid': b['paid'], 'buy_end_value': b['value_end'], 'buy_owed_end': b['loan']['end'],
           'buy_back': b['back'], 'buy_cost': b['cost'], 'buy_cost_monthly': b['cost'] / P,
           'lease_count': l['leases'], 'lease_due_total': l['due'], 'lease_payments': l['payments'],
           'lease_excess_miles': l['over_miles'], 'lease_excess_charge': l['charge'], 'lease_running': l['running'],
           'lease_paid': l['paid'], 'lease_end_value': ZERO, 'lease_owed_end': ZERO, 'lease_back': ZERO,
           'lease_cost': l['paid'], 'lease_cost_monthly': l['paid'] / P, 'cheapest': cheapest,
           'lease_trade_in_credited': max(ZERO, tin)}
    out['alt_keep_rise_all'] = old['paid'] + run_2(old_flat, upk, rise, years, 'all') - keep_back
    out['alt_buy_rise_all'] = buy_2(k, w, tin, new_flat, new_upk, rise, years, P, mode='all')['cost']
    out['alt_lease_rise_all'] = lease_2(k, w, tin, new_flat, new_upk, rise, years, P, mode='all')['paid']
    out['alt_buy_rise_upkeep_only'] = buy_2(k, w, tin, new_flat, new_upk, rise, years, P, mode='upkeep')['cost']
    out['alt_lease_rise_upkeep_only'] = lease_2(k, w, tin, new_flat, new_upk, rise, years, P, mode='upkeep')['paid']
    out['alt_lease_old_running'] = lease_2(k, w, tin, old_flat, upk, rise, years, P)['paid']
    out['alt_lease_equity_not_credited'] = l['paid'] + max(ZERO, tin)
    out['alt_buy_tax_after_trade_in_credit'] = buy_2(k, w, tin, new_flat, new_upk, rise, years, P,
                                                     taxable=max(ZERO, w['new_price'] - k['value']))['cost']
    out['alt_keep_owed_end_ignored'] = keep_cost - old['end']
    out['new_car_loss_at_end'] = 1 - b['value_end'] / w['new_price']
    out['alt_cheapest_lowest'] = lowest
    a3_flat = a3_fuel + ins * share + reg
    out['alt_buy_blank_keeps_old'] = buy_2(k, w, tin, a3_flat, a3_upk, rise, years, P)['cost']
    out['alt_lease_blank_keeps_old'] = lease_2(k, w, tin, a3_flat, a3_upk, rise, years, P)['paid']
    e1_flat = e1_fuel + ins * share + reg
    out['alt_buy_electric_new_at_32_mpg'] = buy_2(k, w, tin, e1_flat, new_upk, rise, years, P)['cost']
    out['alt_lease_electric_new_at_32_mpg'] = lease_2(k, w, tin, e1_flat, new_upk, rise, years, P)['paid']
    return out


def compare_veh(g, cid, a, b):
    g.lists(cid, 'car_results', CAR_SPEC, a['cars'], b['cars'])
    g.fields(cid, VEH_SPEC, a, b)


# ======================================== page B: big purchase planner ========================================

GOAL_FIELDS = ('name', 'priority', 'due', 'target', 'set_aside', 'monthly', 'growth')
PUR_INPUTS = ('spare', 'usable_cash', 'emergency_target', 'cash_return', 'name', 'price', 'sales_tax', 'when',
              'set_aside', 'apr', 'term', 'promo', 'goals')
PUR_SPEC = (('total', 'm'), ('months', 's'), ('months_w3', 's'), ('save_monthly', 'm'),
            ('save_earned', 'm'), ('save_need', 'm'), ('save_uncovered', 'm'), ('save_more_than_you_have', 's'),
            ('finance_kind', 's'), ('finance_principal', 'm'), ('finance_payment', 'm'), ('finance_interest', 'm'),
            ('finance_need', 'm'), ('finance_uncovered', 'm'), ('finance_more_than_you_have', 's'),
            ('cash_after', 'm'), ('cash_fits', 's'), ('alt_level_payment', 'm'), ('alt_level_interest', 'm'),
            ('alt_all_zero_payment', 'm'), ('balance_after_promo', 'm'), ('deferred_interest_if_not_paid', 'm'),
            ('alt_months_w1', 's'), ('alt_save_monthly_w1', 'm'), ('alt_save_earned_w1', 'm'),
            ('alt_save_uncovered_done_goals_give', 'm'), ('alt_finance_uncovered_done_goals_give', 'm'),
            ('alt_cash_fits_keeps_emergency_target', 's'),
            ('alt_save_need_spare_literal', 'm'), ('alt_save_uncovered_spare_literal', 'm'),
            ('alt_finance_need_spare_literal', 'm'), ('alt_finance_uncovered_spare_literal', 'm'))
GIVE_LISTS = ('save_giving', 'finance_giving', 'alt_save_giving_done_goals_give', 'alt_finance_giving_done_goals_give')
GIVE_SPEC = (('name', 's'), ('gives', 'm'), ('new_monthly', 'm'), ('old_months', 's'), ('new_months', 's'),
             ('paused', 's'))
GOALM_SPEC = (('name', 's'), ('months', 's'), ('arrival', 's'))
KIND_LABEL = {'level': 'level', 'all 0%': 'all_zero', 'promo': 'promo_then_rate'}


def split_goals(s):
    if s.strip() == '':
        return []
    out = []
    for part in s.split(';'):
        f = part.split('|')
        assert len(f) == len(GOAL_FIELDS), part
        out.append(dict(zip(GOAL_FIELDS, f)))
    return out


def giving_1(gw):
    return [{'name': x['name'], 'gives': x['gives'], 'new_monthly': x['monthly_new'], 'old_months': x['old_months'],
             'new_months': x['new_months'], 'paused': x['paused']} for x in gw['goals'] if x['gives'] > 0]


def pur_1(c):
    """Derivation 1: rules.big_purchase_case on the CSV's input strings."""
    goals = split_goals(c['goals'])
    case = {k: c[k] for k in ('name', 'price', 'sales_tax', 'when', 'set_aside', 'apr', 'term', 'promo')}
    case['goals'] = goals
    inputs = {k: c[k] for k in ('spare', 'usable_cash', 'emergency_target', 'cash_return')}
    r = R.big_purchase_case(case, inputs)
    out = {'total': r['total'], 'months': r['months'], 'months_w3': r['months_w3'], 'alt_months_w1': r['months_w1']}
    sv = r['save']
    if sv:
        gw, ga = sv['give_way'], sv['give_way_done_gives']
        out.update({'save_monthly': sv['monthly'], 'save_earned': sv['earned'], 'save_need': gw['need'],
                    'save_uncovered': gw['shortfall'], 'save_more_than_you_have': gw['more_than_you_have'],
                    'save_giving': giving_1(gw), 'alt_save_giving_done_goals_give': giving_1(ga),
                    'alt_save_uncovered_done_goals_give': ga['shortfall'],
                    'alt_save_monthly_w1': r['alt_w1']['monthly'], 'alt_save_earned_w1': r['alt_w1']['earned'],
                    'alt_save_need_spare_literal': sv['give_way_spare_literal']['need'],
                    'alt_save_uncovered_spare_literal': sv['give_way_spare_literal']['shortfall'],
                    'save_done_skipped': sum(x['skipped_done'] for x in gw['goals'])})
    else:
        out.update({'save_monthly': None, 'save_earned': None, 'save_need': None, 'save_uncovered': None,
                    'save_more_than_you_have': None, 'save_giving': [], 'alt_save_giving_done_goals_give': [],
                    'alt_save_uncovered_done_goals_give': None, 'alt_save_monthly_w1': None,
                    'alt_save_earned_w1': None, 'alt_save_need_spare_literal': None,
                    'alt_save_uncovered_spare_literal': None, 'save_done_skipped': 0})
    fn = r['finance']
    gw = fn['give_way']
    ga = fn['give_way_done_gives']
    out.update({'alt_finance_giving_done_goals_give': giving_1(ga), 'alt_finance_uncovered_done_goals_give': ga['shortfall'],
                'alt_finance_need_spare_literal': fn['give_way_spare_literal']['need'],
                'alt_finance_uncovered_spare_literal': fn['give_way_spare_literal']['shortfall'],
                'finance_done_skipped': sum(x['skipped_done'] for x in gw['goals'])})
    amount = r['amount']
    term, apr = int(R._F(c['term'])), R._or(c['apr'], 0)
    out.update({'finance_kind': KIND_LABEL[fn['kind']], 'finance_principal': amount, 'finance_payment': fn['payment'],
                'finance_interest': fn['interest'], 'finance_need': gw['need'], 'finance_uncovered': gw['shortfall'],
                'finance_more_than_you_have': gw['more_than_you_have'], 'finance_giving': giving_1(gw),
                'cash_after': r['cash']['after'], 'cash_fits': r['cash']['fits'],
                'alt_cash_fits_keeps_emergency_target': r['cash']['alt_fits_keeps_emergency_target'],
                'balance_after_promo': fn.get('balance_after_promo'),
                'deferred_interest_if_not_paid': fn.get('deferred_interest_if_not_paid')})
    lvl = R.level_payment(amount, apr, term)
    out['alt_level_payment'] = lvl
    out['alt_level_interest'] = lvl * term - amount
    out['alt_all_zero_payment'] = R.promo_payment(amount, apr, term, term)
    gm = []
    for g in goals:
        n = R.months_to_goal(g['target'], R._or(g['set_aside'], 0), R._or(g['monthly'], 0), R._or(g['growth'], 0))
        gm.append({'name': g['name'], 'months': n, 'arrival': R.add_months(TODAY, n) if n is not None else None})
    out['goals_months'] = gm
    return out


def parse_goals_2(s):
    out = []
    for i, d in enumerate(split_goals(s)):
        out.append({'i': i, 'name': d['name'], 'priority': int(d['priority']), 'due': day_2(d['due']),
                    'target': num_2(d['target']), 'set_aside': z_(num_2(d['set_aside'])),
                    'monthly': z_(num_2(d['monthly'])), 'growth': z_(num_2(d['growth']))})
    return out


def gives_first_2(a, b):
    """True when goal a gives way before goal b: the higher priority number first (3, then 2, then 1); within a
    priority the latest due date first (a blank date counts as the latest); then the listed order."""
    if a['priority'] != b['priority']:
        return a['priority'] > b['priority']
    if (a['due'] is None) != (b['due'] is None):
        return a['due'] is None
    if a['due'] != b['due']:
        if MUT == 'give_earliest_first':
            return a['due'] < b['due']
        return a['due'] > b['due']
    return a['i'] < b['i']


def give_order_2(goals):
    """Repeated selection: take the goal that gives first among those left, until none is left."""
    left, order = list(goals), []
    while left:
        best = left[0]
        for g in left[1:]:
            if gives_first_2(g, best):
                best = g
        order.append(best)
        left = [g for g in left if g is not best]
    return order


def saved_2(S, M, g, n):
    if g == 0:
        return S + M * n
    x = (1 + g) ** n
    return S * x + M * (x - 1) / g


def goal_months_2(T, S, M, growth):
    """The smallest whole n with S (1 + g)^n + M ((1 + g)^n - 1) / g >= T (g = growth / 12), by doubling and bisection
    on that closed form (it never falls as n grows); 0 when already there; None when it never gets there within
    1,200 months."""
    g = growth / 12
    if saved_2(S, M, g, 0) >= T:
        return 0
    if M == 0 and (g == 0 or S <= 0):
        return None
    lo, hi = 0, 1
    while saved_2(S, M, g, hi) < T:
        if hi >= CAP_2:
            return None
        lo, hi = hi, min(hi * 2, CAP_2)
    while hi - lo > 1:
        mid = (lo + hi) // 2
        if saved_2(S, M, g, mid) >= T:
            hi = mid
        else:
            lo = mid
    if MUT == 'goal_months_floor' and saved_2(S, M, g, hi) > T:
        return hi - 1
    return hi


def give_way_2(goals, amount, spare, done_gives=False, literal=False):
    """P2: the goals already done (set aside at or above the target) are taken out before the order is made, so they
    never give; done_gives=True (the contrast, the key's first reading) keeps them in. B5: what is spare counts only
    when above 0 ("Nothing spare: everything comes from goals"); literal=True (the contrast, the key's earlier reading)
    takes a spare below 0 as it is, so the goals cover it too."""
    if not (literal or MUT == 'negative_spare_literal') and spare < 0:
        spare = ZERO
    need = amount - spare if amount > spare else ZERO
    left, giving = need, []
    if MUT == 'done_goal_gives':
        done_gives = True
    pool = goals if done_gives else [g for g in goals if g['set_aside'] < g['target']]
    if need > 0:
        for g in give_order_2(pool):
            give = min(g['monthly'], left)
            if give <= 0:
                continue
            left -= give
            new_m = g['monthly'] - give
            paused = new_m == 0
            giving.append({'name': g['name'], 'gives': give, 'new_monthly': new_m,
                           'old_months': goal_months_2(g['target'], g['set_aside'], g['monthly'], g['growth']),
                           'new_months': None if paused else goal_months_2(g['target'], g['set_aside'], new_m,
                                                                           g['growth']),
                           'paused': paused})
    return need, giving, left


def final_balance_2(amount, r, term, promo, q):
    """The schedule run month by month with payment q: 0% in the promo months, then r a month; interest, then q."""
    b = amount
    for t in range(1, term + 1):
        if t > promo:
            b = b * (1 + r)
        b = b - q
    return b


def pur_2(c):
    """Derivation 2 for one purchase, from the CSV's input strings."""
    spare, usable, target_cash = num_2(c['spare']), num_2(c['usable_cash']), num_2(c['emergency_target'])
    i = z_(num_2(c['cash_return'])) / 12
    total = num_2(c['price']) * (1 + z_(num_2(c['sales_tax'])))
    sa = z_(num_2(c['set_aside']))
    when = day_2(c['when'])
    goals = parse_goals_2(c['goals'])
    out = {'total': total}
    def save_2(n):
        acc, x = ZERO, ONE
        for _ in range(n):                     # acc = sum_{t<n} (1 + i)^t by Horner's rule; x = (1 + i)^n
            acc, x = acc * (1 + i) + 1, x * (1 + i)
        if MUT == 'save_at_start':
            acc = acc * (1 + i)
        m = max(ZERO, (total - sa * x) / acc)
        counted = sa if MUT == 'earned_uncapped' else min(sa, total)        # set aside counts up to the total (B8)
        return m, total - counted - m * n

    if when is None:
        out.update({'months': None, 'alt_months_w1': None, 'months_w3': None, 'save_monthly': None, 'save_earned': None,
                    'save_need': None, 'save_uncovered': None, 'save_more_than_you_have': None, 'save_giving': [],
                    'alt_save_monthly_w1': None, 'alt_save_earned_w1': None, 'alt_save_giving_done_goals_give': [],
                    'alt_save_uncovered_done_goals_give': None, 'alt_save_need_spare_literal': None,
                    'alt_save_uncovered_spare_literal': None})
    else:
        n = months_2(TODAY, when, 'W2')                                      # P1
        n1 = months_2(TODAY, when, 'W1')
        out.update({'months': n, 'alt_months_w1': n1, 'months_w3': months_2(TODAY, when, 'W3')})
        m, earned = save_2(n)
        need, giving, left = give_way_2(goals, m, spare)
        _, giving_a, left_a = give_way_2(goals, m, spare, done_gives=True)
        need_l, _, left_l = give_way_2(goals, m, spare, literal=True)
        m1, earned1 = save_2(n1)
        out.update({'save_monthly': m, 'save_earned': earned, 'save_need': need, 'save_uncovered': left,
                    'save_more_than_you_have': left > 0, 'save_giving': giving, 'alt_save_monthly_w1': m1,
                    'alt_save_earned_w1': earned1, 'alt_save_giving_done_goals_give': giving_a,
                    'alt_save_uncovered_done_goals_give': left_a, 'alt_save_need_spare_literal': need_l,
                    'alt_save_uncovered_spare_literal': left_l})
    amount = max(ZERO, total - sa)
    term, promo, apr = int(num_2(c['term'])), int(z_(num_2(c['promo']))), z_(num_2(c['apr']))
    r = apr / 12
    if MUT == 'promo_ignored':
        promo_used = 0
    else:
        promo_used = promo
    if amount == 0:
        p = ZERO
    else:
        f0 = final_balance_2(amount, r, term, promo_used, ZERO)
        f1 = final_balance_2(amount, r, term, promo_used, ONE)
        p = f0 / (f0 - f1)                     # the final balance is linear in the payment
    kind = 'all_zero' if (promo == term or apr == 0) else ('promo_then_rate' if promo > 0 else 'level')
    need, giving, left = give_way_2(goals, p, spare)
    _, giving_a, left_a = give_way_2(goals, p, spare, done_gives=True)
    need_l, _, left_l = give_way_2(goals, p, spare, literal=True)
    out.update({'alt_finance_need_spare_literal': need_l, 'alt_finance_uncovered_spare_literal': left_l})
    out.update({'finance_kind': kind, 'finance_principal': amount, 'finance_payment': p,
                'finance_interest': p * term - amount, 'finance_need': need, 'finance_uncovered': left,
                'finance_more_than_you_have': left > 0, 'finance_giving': giving,
                'alt_finance_giving_done_goals_give': giving_a, 'alt_finance_uncovered_done_goals_give': left_a})
    after = usable - amount                    # P3: fits when nothing is left owing, i.e. what is left is at least 0
    out.update({'cash_after': after, 'cash_fits': after >= (target_cash if MUT == 'cash_fits_emergency' else ZERO),
                'alt_cash_fits_keeps_emergency_target': after >= target_cash})
    lvl = pay_level_2(amount, apr, term)
    out.update({'alt_level_payment': lvl, 'alt_level_interest': lvl * term - amount, 'alt_all_zero_payment': amount / term})
    if 0 < promo < term and apr > 0 and amount > 0:
        out['balance_after_promo'] = amount - promo * p
        out['deferred_interest_if_not_paid'] = r * (promo * amount - p * promo * (promo - 1) / 2)
    else:
        out['balance_after_promo'] = out['deferred_interest_if_not_paid'] = None
    gm = []
    for g in goals:
        n = goal_months_2(g['target'], g['set_aside'], g['monthly'], g['growth'])
        gm.append({'name': g['name'], 'months': n, 'arrival': plus_months_2(TODAY, n) if n is not None else None})
    out['goals_months'] = gm
    return out


def compare_pur(g, cid, a, b):
    g.fields(cid, PUR_SPEC, a, b)
    for name in GIVE_LISTS:
        g.lists(cid, name, GIVE_SPEC, a[name], b[name])
    g.lists(cid, 'goals_months', GOALM_SPEC, a['goals_months'], b['goals_months'])


# ======================================== page C: renovation ========================================

REN_INPUTS = ('usable_cash', 'blended_return', 'top_rate', 'itemizes', 'essential_monthly')
REN_CASE = ('cost', 'recoup', 'home', 'home_value', 'mortgage_balance', 'mortgage_rate', 'mortgage_payment',
            'heloc_rate', 'heloc_years', 'refi_rate', 'refi_years', 'refi_cost_share', 'loan_rate', 'loan_years',
            'filing_status')
WAY_SPEC = (('monthly', 'm'), ('months', 's'), ('interest', 'm'), ('fees', 'm'), ('deductible', 's'),
            ('tax_saved', 'm'), ('pv_payments', 'm'), ('todays_money', 'm'), ('fits', 's'))
REN_SPEC = (('value_added', 'm'), ('equity_change', 'm'), ('borrowable', 'm'), ('cash_fits', 's'),
            ('cash_todays_money', 'm'), ('cushion', 'm'), ('cushion_months', 'r'),
            *((f'line_{k}', t) for k, t in WAY_SPEC),
            ('refi_new_loan', 'm'), ('refi_fees', 'm'), ('refi_monthly', 'm'), ('refi_months', 's'),
            ('refi_old_payment', 'm'), ('refi_old_months_left', 's'), ('refi_payment_change', 'm'),
            ('refi_new_interest', 'm'), ('refi_old_interest', 'm'), ('refi_interest', 'm'), ('refi_deductible', 's'),
            ('refi_tax_saved', 'm'), ('refi_pv_new', 'm'), ('refi_pv_old', 'm'), ('refi_todays_money', 'm'),
            ('refi_fits', 's'),
            *((f'loan_{k}', t) for k, t in WAY_SPEC),
            ('ranking', 's'), ('best', 's'),
            ('line_cltv_after', 'r'), ('line_law_share', 'r'), ('line_mortgage_interest_in_term', 'm'),
            ('refi_ltv_after', 'r'),
            ('refi_above_fha_80', 's'), ('refi_law_share', 'r'),
            ('refi_tax_saved_whole_new_interest', 'm'), ('alt_refi_new_loan', 'm'), ('alt_refi_fees', 'm'),
            ('alt_refi_monthly', 'm'), ('alt_refi_todays_money', 'm'), ('alt_refi_ltv_after', 'r'),
            ('alt_line_tax_saved_no_limit', 'm'), ('alt_line_todays_money_before_tax', 'm'),
            ('alt_refi_tax_saved_extra_interest', 'm'), ('alt_refi_todays_money_before_tax', 'm'),
            ('alt_refi_no_mortgage_monthly', 'm'), ('alt_refi_no_mortgage_todays_money', 'm'),
            ('alt_refi_no_mortgage_fits', 's'),
            ('alt_ranking_lowest_first', 's'), ('alt_ranking_before_tax', 's'), ('alt_ranking_refi_no_mortgage', 's'),
            ('alt_line_tax_saved_r1', 'm'), ('alt_line_todays_money_r1', 'm'), ('alt_ranking_line_r1', 's'),
            ('alt_ranking_blank_refi_not_offered', 's'))
REN_KEYS = [k for k, _ in REN_SPEC]


def ren_1(c):
    """Derivation 1: rules.renovation_case on the CSV's input strings."""
    case = {k: c[k] for k in REN_CASE}
    inputs = {k: c[k] for k in REN_INPUTS}
    r = R.renovation_case(case, inputs)
    item = R._yes(c['itemizes'])
    W = r['ways']
    out = dict.fromkeys(REN_KEYS)
    cash = W['cash']
    out.update({'value_added': r['value_added'], 'equity_change': r['equity_change'], 'cash_fits': cash['fits'],
                'cash_todays_money': cash['todays_money'], 'cushion': cash['cushion'],
                'cushion_months': cash['cushion_months']})
    for name in ('line', 'loan'):
        if name in W:
            x = W[name]
            out.update({f'{name}_monthly': x['payment'], f'{name}_months': x['months'], f'{name}_interest': x['interest'],
                        f'{name}_fees': ZERO, f'{name}_deductible': (name == 'line' and item),
                        f'{name}_tax_saved': x['tax_saved'], f'{name}_pv_payments': x['pv_payments'],
                        f'{name}_todays_money': x['todays_money'], f'{name}_fits': x['fits']})
    if 'line' in W:
        x = W['line']
        out.update({'borrowable': x['borrowable'], 'line_cltv_after': x['cltv_after'], 'line_law_share': x['law_share'],
                    'line_mortgage_interest_in_term': x['mortgage_interest_in_term'],
                    'alt_line_tax_saved_r1': x['alt_tax_saved_r1'], 'alt_line_todays_money_r1': x['alt_todays_money_r1'],
                    'alt_line_tax_saved_no_limit': x['alt_tax_saved_no_limit'],
                    'alt_line_todays_money_before_tax': x['todays_money_before_tax']})
    if 'refi' in W:
        x = W['refi']
        al = x['alt_cost_of_new_loan']
        out.update({'refi_new_loan': x['new_loan'], 'refi_fees': x['closing_costs'], 'refi_monthly': x['payment'],
                    'refi_months': x['months'], 'refi_old_payment': x['old_payment'],
                    'refi_old_months_left': x['old_months_left'], 'refi_payment_change': x['payment_change'],
                    'refi_new_interest': x['new_interest'], 'refi_old_interest': x['old_interest'],
                    'refi_interest': x['extra_interest'], 'refi_deductible': item, 'refi_tax_saved': x['tax_saved'],
                    'refi_pv_new': x['pv_new'], 'refi_pv_old': x['pv_old'], 'refi_todays_money': x['todays_money'],
                    'refi_fits': x['fits'], 'refi_ltv_after': x['ltv_after'],
                    'refi_above_fha_80': x['above_fha_cash_out_limit'], 'refi_law_share': x['law_share'],
                    'refi_tax_saved_whole_new_interest': x['tax_saved_whole_new_interest'],
                    'alt_refi_new_loan': al['new_loan'], 'alt_refi_fees': al['closing_costs'],
                    'alt_refi_monthly': al['payment'], 'alt_refi_todays_money': al['todays_money'],
                    'alt_refi_ltv_after': al['ltv_after'],
                    'alt_refi_tax_saved_extra_interest': x['alt_tax_saved_extra_interest'],
                    'alt_refi_todays_money_before_tax': x['todays_money_before_tax']})
    nm = r['alt_refi_no_mortgage']
    if nm is not None:
        out.update({'alt_refi_no_mortgage_monthly': nm['payment'], 'alt_refi_no_mortgage_todays_money': nm['todays_money'],
                    'alt_refi_no_mortgage_fits': nm['fits'],
                    'alt_ranking_refi_no_mortgage': ';'.join(r['alt_ranking_refi_no_mortgage'])})
    out['ranking'] = ';'.join(r['ranking'])
    out['best'] = r['best']
    out['alt_ranking_lowest_first'] = ';'.join(r['alt_ranking_lowest_first'])
    out['alt_ranking_before_tax'] = ';'.join(r['alt_ranking_before_tax'])
    out['alt_ranking_line_r1'] = ';'.join(r['alt_ranking_line_r1'])
    out['alt_ranking_blank_refi_not_offered'] = ';'.join(r['alt_ranking_blank_refi_not_offered'])
    return out


def pvi_level_2(A, annual, n, p, ret):
    """The present value of a level loan's monthly interest in closed form. The balance before month m is
    A g^(m-1) - p (g^(m-1) - 1) / r, so that month's interest is (r A - p) g^(m-1) + p (r = 0: 0), and the sum of
    interest_m v^m over m = 1..n is (r A - p) v sum_{k<n} (g v)^k + p a_n, v = 1 / (1 + ret / 12), a_n the annuity
    factor (pv_factor_2). rules.py steps the loan month by month instead."""
    r = annual / 12
    g, v = 1 + r, 1 / (1 + ret / 12)
    q = g * v
    geo = F(n) if q == 1 else (q ** n - 1) / (q - 1)
    return (r * A - p) * v * geo + p * pv_factor_2(ret, n)


def pvi_old_2(L, b, annual, p, ret):
    """The same for the old mortgage run by loan_2: its L['level'] uncut months in closed form, plus the cut last month's
    interest r B_k discounted k + 1 months (B_k = b g^k - p (g^k - 1) / r, or b - p k at 0%)."""
    r = annual / 12
    g, v, k = 1 + r, 1 / (1 + ret / 12), L['level']
    q = g * v
    geo = F(k) if q == 1 else (q ** k - 1) / (q - 1)
    ak = F(k) if ret == 0 else (1 - v ** k) / (ret / 12)
    pvi = (r * b - p) * v * geo + p * ak
    if L['last'] is not None:
        bk = b - p * k if r == 0 else b * g ** k - p * (g ** k - 1) / r
        pvi += r * bk * v ** (k + 1)
    return pvi


def walk_2(cands, margin=MARGIN_2):
    """R5: from the first way (in the order cash, line, refinance, loan), jump to the first later way whose today's money
    is lower by more than the margin, and again from there, until none is; the last one reached is the best."""
    if MUT == 'best_lowest':
        margin = ZERO
    i = 0
    while True:
        j = next((j for j in range(i + 1, len(cands)) if cands[j][1] < cands[i][1] - margin), None)
        if j is None:
            return cands[i][0]
        i = j


def rank_2(cands):
    """The ranking: the best by walk_2, then the best of the ways left, until none is left."""
    cands, out = list(cands), []
    while cands:
        b = walk_2(cands)
        out.append(b)
        cands = [w for w in cands if w[0] != b]
    return ';'.join(out)


def lowest_first_2(cands):
    """Contrast (C7, the key's first reading): repeated selection of the lowest today's money; a tie keeps the earlier."""
    cands, out = list(cands), []
    while cands:
        best = cands[0]
        for w in cands[1:]:
            if w[1] < best[1]:
                best = w
        out.append(best[0])
        cands = [w for w in cands if w is not best]
    return ';'.join(out)


def ren_2(c):
    """Derivation 2 for one project, from the CSV's input strings."""
    cost, recoup = num_2(c['cost']), num_2(c['recoup'])
    usable, ret, top = num_2(c['usable_cash']), z_(num_2(c['blended_return'])), num_2(c['top_rate'])
    item = yes_2(c['itemizes'])
    if MUT == 'tax_without_itemizing':
        item = True
    essential = num_2(c['essential_monthly'])
    value = num_2(c['home_value'])
    home = yes_2(c['home']) and value is not None
    status = 'married_separate' if c['filing_status'].strip() == 'married_separate' else 'other'
    lim = LIMIT_2[status]
    no_tax_in_pv = MUT == 'todays_money_before_tax'
    out = dict.fromkeys(REN_KEYS)
    cushion = usable - cost
    out.update({'value_added': cost * recoup, 'equity_change': cost * recoup - cost, 'cash_fits': usable >= cost,
                'cash_todays_money': ZERO, 'cushion': cushion,
                'cushion_months': (cushion / essential) if essential else None})
    ways = [('cash', ZERO, ZERO, usable >= cost)]          # (name, today's money after tax, before tax, fits)

    def level_way(prefix, rate, years, share):
        """share: the deductible share of the interest (R1), or None for a loan whose interest is never deductible."""
        n = 12 * years
        p = pay_level_2(cost, rate, n)
        interest = p * n - cost
        pv = p * pv_factor_2(ret, n)
        deduct = share is not None and item
        pv_tax = top * share * pvi_level_2(cost, rate, n, p, ret) if (deduct and not no_tax_in_pv) else ZERO
        out.update({f'{prefix}_monthly': p, f'{prefix}_months': n, f'{prefix}_interest': interest, f'{prefix}_fees': ZERO,
                    f'{prefix}_deductible': deduct, f'{prefix}_tax_saved': interest * share * top if deduct else ZERO,
                    f'{prefix}_pv_payments': pv, f'{prefix}_todays_money': pv - cost - pv_tax})
        return interest, pv - cost - pv_tax, pv - cost

    def new_loan_2(M, share_cost, rr, nn, base_reading=True):
        """A refinance's new loan of M + C: closing costs = share x (M + C) (C1), or the contrast's share of the new loan;
        its payment, interest, PV of payments and PV of interest, and the deductible share min(M + C, L) / N (R1)."""
        debt = M + cost
        if base_reading and MUT != 'refi_share_of_new_loan':
            closing = debt * share_cost
        else:
            closing = debt * share_cost / (1 - share_cost)
        N = debt + closing
        pay = pay_level_2(N, rr, nn)
        return {'N': N, 'closing': closing, 'pay': pay, 'interest': pay * nn - N, 'pv': pay * pv_factor_2(ret, nn),
                'pvi': pvi_level_2(N, rr, nn, pay, ret), 'law': min(debt, F(lim)) / N}

    refi_blank = False
    if home:
        mort = z_(num_2(c['mortgage_balance']))
        mrate, mp = z_(num_2(c['mortgage_rate'])), num_2(c['mortgage_payment'])
        has_mortgage = mort > 0 and mp is not None and mp > 0
        debt = mort + cost
        s_new = ONE if debt <= lim else F(lim) / debt                        # the line's share (R1, L1)
        s_old = ZERO if mort == 0 else (ONE if mort <= lim else F(lim) / mort)   # the mortgage's own share before the line
        share = ONE if MUT == 'tax_no_limit' else s_new
        hr, hy = dflt(num_2(c['heloc_rate']), HELOC_RATE_2), int(dflt(num_2(c['heloc_years']), HELOC_YEARS_2))
        interest, r1_today, before = level_way('line', hr, hy, share)       # writes R1's figures; L1 below
        n_l, p_l = out['line_months'], out['line_monthly']
        pvi_line = pvi_level_2(cost, hr, n_l, p_l, ret)
        # L1 (P936 Table 1, lines 12-15): the limit's share falls on all the home's interest, so while the line runs the
        # mortgage's deduction falls from s_old to s_new: tax saved = (line interest x s_new - the mortgage's interest
        # over the line's term x (s_old - s_new)) x top; the mortgage over the line's term in closed form (loan_2 with the
        # line's months as the limit, it stops if paid first), its interest's PV by pvi_old_2
        if has_mortgage:
            during = loan_2(mort, mrate, mp, n_l)
            out['line_mortgage_interest_in_term'] = during['interest']
            if MUT == 'line_whole_mortgage_life':
                during = loan_2(mort, mrate, mp, None)
        cut = s_old - s_new
        if MUT in ('line_law_mortgage_kept', 'tax_no_limit'):
            cut = ZERO
        line_tax = interest * share * top if item else ZERO
        line_today = r1_today
        if item and has_mortgage and cut != 0:
            line_tax = (interest * share - during['interest'] * cut) * top
            if not no_tax_in_pv:
                line_today = before - top * (share * pvi_line - cut * pvi_old_2(during, mort, mrate, mp, ret))
        cl = F(80, 100) if MUT == 'cltv_80' else CLTV_2
        borrowable = value * cl - mort
        if MUT != 'borrowable_negative':
            borrowable = max(ZERO, borrowable)
        out.update({'borrowable': borrowable, 'line_fits': borrowable >= cost, 'line_cltv_after': debt / value,
                    'line_law_share': s_new, 'line_tax_saved': line_tax, 'line_todays_money': line_today,
                    'alt_line_tax_saved_r1': interest * s_new * top if item else ZERO,
                    'alt_line_todays_money_r1': before - top * s_new * pvi_line if item else before,
                    'alt_line_tax_saved_no_limit': interest * top if item else ZERO,
                    'alt_line_todays_money_before_tax': before})
        ways.append(('line', line_today, before, borrowable >= cost))
        out['_line_r1'] = out['alt_line_todays_money_r1']
        # D1: a blank refinance rate or years is 6.5% and 30 years
        typed_rr, typed_ry = num_2(c['refi_rate']), num_2(c['refi_years'])
        refi_blank = typed_rr is None or typed_ry is None
        rr, ry = dflt(typed_rr, REFI_RATE_2), dflt(typed_ry, F(REFI_YEARS_2))
        s = dflt(num_2(c['refi_cost_share']), REFI_SHARE_2)
        nn = 12 * int(ry)
        if has_mortgage or MUT == 'refi_without_mortgage':
            if has_mortgage:
                OL = loan_2(mort, mrate, mp, None)
                old_pay, old_int, old_pv, old_n = mp, OL['interest'], pv_loan_2(OL, mp, ret), OL['months']
                old_pvi = pvi_old_2(OL, mort, mrate, mp, ret)
                old_share = s_old
            else:
                old_pay = old_int = old_pv = old_pvi = old_share = ZERO
                old_n = 0
            nl = new_loan_2(mort, s, rr, nn)
            extra = nl['interest'] - old_int
            refi_fits = True if MUT == 'refi_always_fits' else nl['N'] <= value * FHA_2   # C4: the cash-out limit

            def after_tax(x):                  # R2: today's money after the tax saved, discounted like the payments
                before_x = x['pv'] - old_pv - cost
                if not item or no_tax_in_pv:
                    return before_x
                return before_x - top * (x['law'] * x['pvi'] - old_share * old_pvi)

            if MUT == 'tax_no_limit':
                tax = extra * top if item else ZERO
            else:
                tax = (nl['interest'] * nl['law'] - old_int * old_share) * top if item else ZERO     # R1
            al = new_loan_2(mort, s, rr, nn, base_reading=False)                              # C1 contrast
            out.update({'refi_new_loan': nl['N'], 'refi_fees': nl['closing'], 'refi_monthly': nl['pay'],
                        'refi_months': nn, 'refi_old_payment': old_pay, 'refi_old_months_left': old_n,
                        'refi_payment_change': nl['pay'] - old_pay, 'refi_new_interest': nl['interest'],
                        'refi_old_interest': old_int, 'refi_interest': extra, 'refi_deductible': item,
                        'refi_tax_saved': tax, 'refi_pv_new': nl['pv'], 'refi_pv_old': old_pv,
                        'refi_todays_money': after_tax(nl), 'refi_fits': refi_fits,
                        'refi_ltv_after': nl['N'] / value, 'refi_above_fha_80': nl['N'] / value > FHA_2,
                        'refi_law_share': nl['law'],
                        'refi_tax_saved_whole_new_interest': nl['interest'] * top if item else ZERO,
                        'alt_refi_new_loan': al['N'], 'alt_refi_fees': al['closing'], 'alt_refi_monthly': al['pay'],
                        'alt_refi_todays_money': after_tax(al), 'alt_refi_ltv_after': al['N'] / value,
                        'alt_refi_tax_saved_extra_interest': extra * top if item else ZERO,
                        'alt_refi_todays_money_before_tax': nl['pv'] - old_pv - cost})
            ways.append(('refi', after_tax(nl), nl['pv'] - old_pv - cost, refi_fits))
        else:
            # R3: no mortgage, no refinance; the contrast is the key's first reading, an old side of 0
            x0 = new_loan_2(ZERO, s, rr, nn)
            t0 = x0['pv'] - cost - (top * x0['law'] * x0['pvi'] if item else ZERO)
            fits0 = x0['N'] <= value * FHA_2
            out.update({'alt_refi_no_mortgage_monthly': x0['pay'], 'alt_refi_no_mortgage_todays_money': t0,
                        'alt_refi_no_mortgage_fits': fits0})
            out['_no_mortgage_refi'] = ('refi', t0, None, fits0)
    _, todays, before = level_way('loan', dflt(num_2(c['loan_rate']), LOAN_RATE_2),
                                  int(dflt(num_2(c['loan_years']), LOAN_YEARS_2)), None)
    out['loan_fits'] = True
    ways.append(('loan', todays, before, True))
    fit = [w for w in ways if w[3]]
    out['ranking'] = rank_2([(w[0], w[1]) for w in fit])
    out['best'] = out['ranking'].split(';')[0]
    out['alt_ranking_lowest_first'] = lowest_first_2([(w[0], w[1]) for w in fit])
    out['alt_ranking_before_tax'] = rank_2([(w[0], w[2]) for w in fit])
    line_r1 = out.pop('_line_r1', None)              # L1's contrast: the walk with the line's today's money by R1
    out['alt_ranking_line_r1'] = rank_2([(w[0], line_r1 if w[0] == 'line' else w[1]) for w in fit])
    # D1's contrast (the key's earlier C4): no refinance offered when its rate or years is blank
    out['alt_ranking_blank_refi_not_offered'] = rank_2([(w[0], w[1]) for w in fit if not (w[0] == 'refi' and refi_blank)])
    x0 = out.pop('_no_mortgage_refi', None)
    if x0 is not None:
        with_refi = [w for w in ways if w[0] in ('cash', 'line')] + [x0] + [w for w in ways if w[0] == 'loan']
        out['alt_ranking_refi_no_mortgage'] = rank_2([(w[0], w[1]) for w in with_refi if w[3]])
    return out


def compare_ren(g, cid, a, b):
    g.fields(cid, REN_SPEC, a, b)


# ======================================== RULES.md section 8 by derivation 2 ========================================

def car_str(d):
    return '|'.join(str(d.get(f, '')) for f in CAR_FIELDS)


def goals_str(goals):
    return ';'.join('|'.join(str(g.get(f, '')) for f in GOAL_FIELDS) for g in goals)


def veh_row(cars, w):
    row = {'cars': ';'.join(car_str(x) for x in cars)}
    for f in WHATIF_FIELDS:
        row[f] = str(w.get(f, ''))
    return row


def pur_row(case, inputs):
    row = {k: str(inputs.get(k, '')) for k in ('spare', 'usable_cash', 'emergency_target', 'cash_return')}
    for k in ('name', 'price', 'sales_tax', 'when', 'set_aside', 'apr', 'term', 'promo'):
        row[k] = str(case.get(k, ''))
    row['goals'] = goals_str(case.get('goals') or [])
    return row


def ren_row(case, inputs):
    row = {k: str(inputs.get(k, '')) for k in REN_INPUTS}
    for k in REN_CASE:
        row[k] = str(case.get(k, ''))
    if row['filing_status'] == '':
        row['filing_status'] = 'other'
    return row


def check_examples():
    """RULES.md section 8, worked by hand there, reproduced by derivation 2 alone."""
    n = 0
    v = veh_2(veh_row([R.SEDAN, R.EV], R.SEDAN_WHATIF))
    s, e = v['cars']
    assert [money(s[k]) for k in ('value_lost', 'fuel', 'loan_interest', 'total', 'monthly', 'loan_balance_after_year',
                                  'loan_paid_year')] == ['2160.00', '1400.00', '252.62', '6312.62', '526.05', '2052.62',
                                                         '4200.00']
    assert rate6(s['per_mile']) == '0.526052' and s['loan_months_year'] == 12
    assert [money(e[k]) for k in ('value_lost', 'fuel', 'total', 'monthly')] == ['2640.00', '384.00', '4874.00', '406.17']
    assert rate6(e['per_mile']) == '0.609250' and e['loan_paid_year'] is None
    n += 4
    assert (v['keep_loan_months'], money(v['keep_loan_paid']), v['keep_owed_end']) == (18, '6288.55', 0)
    assert [money(v[k]) for k in ('keep_running', 'keep_paid', 'keep_back', 'keep_cost', 'keep_cost_monthly')] == \
        ['20384.08', '26672.63', '9499.17', '17173.45', '286.22']                                          # V1
    assert [money(v[k]) for k in ('trade_in', 'financed', 'new_payment', 'buy_loan_paid', 'buy_owed_end', 'buy_running',
                                  'buy_paid', 'buy_back', 'buy_cost', 'buy_cost_monthly')] == \
        ['12000.00', '19560.00', '387.31', '23238.69', '0.00', '17875.00', '44113.69', '13363.36', '30750.33', '512.51']   # V2
    assert (v['lease_count'], money(v['lease_due_total']), money(v['lease_payments']), money(v['lease_excess_charge'])) \
        == (2, '4000.00', '23940.00', '2000.00')
    assert [money(v[k]) for k in ('lease_running', 'lease_paid', 'lease_cost', 'lease_cost_monthly')] == \
        ['17125.00', '35065.00', '35065.00', '584.42'] and v['lease_trade_in_credited'] == 12000           # V2, A5
    assert v['cheapest'] == 'keep' and v['lease_excess_miles'] == 10000
    assert [money(v[k]) for k in ('alt_keep_rise_all', 'alt_buy_rise_all', 'alt_lease_rise_all', 'alt_buy_rise_upkeep_only',
                                  'alt_lease_rise_upkeep_only', 'alt_lease_old_running', 'alt_lease_equity_not_credited',
                                  'alt_buy_tax_after_trade_in_credit', 'alt_keep_owed_end_ignored')] == \
        ['20599.26', '34701.06', '38849.97', '31081.86', '35230.77', '35440.00', '47065.00', '29039.50', '17173.45']
    assert v['alt_lease_rise_upkeep_only'] == F('35230.765') and rate6(v['new_car_loss_at_end']) == '0.582395'
    v1 = veh_2(veh_row([R.SEDAN], dict(R.SEDAN_WHATIF, years=1)))                                       # veh-0002 (A6)
    assert [money(v1[k]) for k in ('keep_paid', 'keep_back', 'keep_cost', 'alt_keep_owed_end_ignored')] == \
        ['8100.00', '13787.38', '-5687.38', '-7740.00']
    assert v['alt_cheapest_lowest'] == 'keep' and v['cash_back'] == 0
    n += 10
    # fourth revision: D1 (the sedan with a blank new mpg and upkeep: 32 mpg and 500; A3 keeps 1,400 and 800)
    vd = veh_2(veh_row([R.SEDAN], dict(R.SEDAN_WHATIF, new_mpg='', new_maintenance='')))
    assert [money(vd[k]) for k in ('buy_running', 'buy_cost', 'lease_running', 'lease_cost', 'alt_buy_blank_keeps_old',
                                   'alt_lease_blank_keeps_old')] == \
        ['19437.50', '32312.83', '18187.50', '36127.50', '34250.33', '37315.00'] and vd['cheapest'] == 'keep'
    # A7 (the sedan without its loan worth 40,000; a 24,000 car at 6%; 3,000 down or none)
    for down, back in (('3000', '17560.00'), ('0', '14560.00')):
        va = veh_2(veh_row([dict({x: y for x, y in R.SEDAN.items() if not x.startswith('loan')}, value=40000)],
                           dict(R.SEDAN_WHATIF, new_price=24000, new_sales_tax='0.06', cash_down=down)))
        assert [money(va[k]) for k in ('cash_back', 'financed', 'new_payment', 'buy_paid', 'buy_back', 'buy_cost',
                                       'keep_cost', 'lease_cost')] == \
            [back, '0.00', '0.00', '3315.00', '10022.52', '-6707.52', '-725.20', '7065.00'] and va['cheapest'] == 'buy'
    # A9 (the wagon: buy 0.40 below keep, keep stays the cheapest)
    v9 = veh_2(veh_row([R.WAGON], R.WAGON_WHATIF))
    assert [money(v9[k]) for k in ('keep_cost', 'buy_cost', 'lease_cost')] == ['300.00', '299.60', '5624.80']
    assert v9['cheapest'] == 'keep' and v9['alt_cheapest_lowest'] == 'buy'
    n += 5
    # E1, corrected after the fourth revision's comparison (veh-0007: Ana's hatchback, electric, carrying a 3.50 fuel
    # price, over 6 years, the new mpg blank): the new car charged like the hatchback, 384 a year; E1's contrast 32 mpg
    ve = veh_2(veh_row([dict(R.EV, fuel_price='3.50'), R.SEDAN], dict(R.SEDAN_WHATIF, new_mpg='', years=6)))
    assert [money(ve[k]) for k in ('buy_running', 'buy_cost', 'lease_running', 'lease_cost', 'keep_cost',
                                   'alt_buy_electric_new_at_32_mpg', 'alt_lease_electric_new_at_32_mpg')] == \
        ['15354.00', '18353.11', '14454.00', '25182.00', '3701.79', '21299.11', '28128.00'] and ve['cheapest'] == 'keep'
    assert (ve['alt_buy_blank_keeps_old'], ve['alt_lease_blank_keeps_old']) == (ve['buy_cost'], ve['lease_cost'])
    n += 2
    p = pur_2(pur_row(R.SOFA, R.SOFA_INPUTS))
    assert money(p['total']) == '3180.00' and (p['months'], p['alt_months_w1'], p['months_w3']) == (7, 8, 8)    # P1
    assert (money(p['save_monthly']), money(p['save_earned']), money(p['save_need'])) == ('304.99', '45.04', '224.99')
    assert (money(p['alt_save_monthly_w1']), money(p['alt_save_earned_w1'])) == ('266.00', '51.97')
    sg = [(x['name'], money(x['gives']), money(x['new_monthly']), x['old_months'], x['new_months'], x['paused'])
          for x in p['save_giving']]
    assert sg == [('Holiday', '150.00', '0.00', 11, None, True), ('Car fund', '74.99', '125.01', 35, 52, False)]
    assert p['save_uncovered'] == 0 and p['save_more_than_you_have'] is False
    assert p['alt_save_giving_done_goals_give'] == p['save_giving'] and p['alt_save_uncovered_done_goals_give'] == 0
    assert (p['finance_kind'], money(p['finance_principal']), money(p['finance_payment']), money(p['finance_interest'])) \
        == ('promo_then_rate', '2180.00', '96.79', '143.07')
    assert (money(p['balance_after_promo']), money(p['deferred_interest_if_not_paid'])) == ('1018.47', '411.74')
    fg = [(x['name'], money(x['gives']), money(x['new_monthly']), x['old_months'], x['new_months'])
          for x in p['finance_giving']]
    assert fg == [('Holiday', '16.79', '133.21', 11, 12)]
    assert (money(p['cash_after']), p['cash_fits'], p['alt_cash_fits_keeps_emergency_target']) == ('3820.00', True, False)
    assert (money(p['alt_level_payment']), money(p['alt_level_interest']), money(p['alt_all_zero_payment'])) == \
        ('116.34', '612.14', '90.83')
    gm = [(x['name'], x['months'], iso(x['arrival'])) for x in p['goals_months']]
    assert gm == [('Holiday', 11, '2027-09-30'), ('Car fund', 35, '2029-09-30'), ('Rainy-day top-up', 20, '2028-06-30')]
    p3 = pur_2(pur_row(dict(R.SOFA, set_aside=4000), R.SOFA_INPUTS))                       # B8: more set aside than the total
    assert p3['save_monthly'] == 0 and p3['save_earned'] == 0 and p3['finance_principal'] == 0
    done = [G('Gift fund', 3, '2027-06-30', 1000, 1500, 50, '0.01'), R.SOFA_GOALS[1]]                    # P2 (pur-0020)
    pd = pur_2(pur_row(dict(R.SOFA, goals=done), R.SOFA_INPUTS))
    assert [(x['name'], money(x['gives']), x['paused']) for x in pd['save_giving']] == [('Car fund', '200.00', True)]
    assert money(pd['save_uncovered']) == '24.99' and pd['save_more_than_you_have'] is True
    assert [(x['name'], money(x['gives'])) for x in pd['alt_save_giving_done_goals_give']] == \
        [('Gift fund', '50.00'), ('Car fund', '174.99')] and pd['alt_save_uncovered_done_goals_give'] == 0
    assert [(x['name'], money(x['gives']), x['new_months']) for x in pd['finance_giving']] == [('Car fund', '16.79', 37)]
    assert [(x['name'], money(x['gives'])) for x in pd['alt_finance_giving_done_goals_give']] == [('Gift fund', '16.79')]
    n += 18
    # fourth revision: B5 (the sofa with spare -150, counted as 0; the literal reading as the contrast)
    pb = pur_2(pur_row(R.SOFA, dict(R.SOFA_INPUTS, spare=-150)))
    assert [(x['name'], money(x['gives']), money(x['new_monthly']), x['old_months'], x['new_months'], x['paused'])
            for x in pb['save_giving']] == [('Holiday', '150.00', '0.00', 11, None, True), ('Car fund', '154.99', '45.01', 35, 116, False)]
    assert [money(pb[k]) for k in ('save_need', 'save_uncovered', 'alt_save_need_spare_literal',
                                   'alt_save_uncovered_spare_literal')] == ['304.99', '0.00', '454.99', '4.99']
    assert [(x['name'], money(x['gives']), money(x['new_monthly']), x['new_months']) for x in pb['finance_giving']] == \
        [('Holiday', '96.79', '53.21', 29)]
    assert [money(pb[k]) for k in ('finance_need', 'finance_uncovered', 'alt_finance_need_spare_literal',
                                   'alt_finance_uncovered_spare_literal')] == ['96.79', '0.00', '246.79', '0.00']
    pc = pur_2(pur_row(dict(R.SOFA, set_aside=4000), dict(R.SOFA_INPUTS, spare=-150)))
    assert (pc['save_need'], pc['finance_need'], pc['alt_save_need_spare_literal'], pc['alt_finance_need_spare_literal']) == (0, 0, 150, 150)
    n += 5
    k = ren_2(ren_row(R.KITCHEN, R.KITCHEN_INPUTS))
    assert (money(k['value_added']), money(k['equity_change'])) == ('21000.00', '-9000.00')
    assert k['cash_fits'] and money(k['cushion']) == '10000.00' and rate6(k['cushion_months']) == '2.500000'
    assert [money(k[x]) for x in ('borrowable', 'line_monthly', 'line_interest', 'line_pv_payments', 'line_todays_money',
                                  'line_tax_saved', 'alt_line_tax_saved_no_limit', 'alt_line_todays_money_before_tax')] == \
        ['58000.00', '363.98', '13677.93', '34316.79', '1554.04', '3282.70', '3282.70', '4316.79']        # R1, R2
    assert rate6(k['line_cltv_after']) == '0.776316' and k['line_law_share'] == 1
    assert (k['alt_line_tax_saved_r1'], k['alt_line_todays_money_r1']) == (k['line_tax_saved'], k['line_todays_money'])   # L1 = R1 under L
    assert [money(k[x]) for x in ('refi_new_loan', 'refi_fees', 'refi_monthly', 'refi_old_interest', 'refi_pv_old',
                                  'refi_payment_change', 'refi_new_interest', 'refi_interest', 'refi_pv_new',
                                  'refi_todays_money', 'refi_tax_saved', 'refi_tax_saved_whole_new_interest',
                                  'alt_refi_tax_saved_extra_interest', 'alt_refi_todays_money_before_tax')] == \
        ['303850.00', '8850.00', '1870.86', '115861.11', '230312.77', '433.86', '369658.42', '253797.31', '348506.21',
         '55591.64', '58327.33', '88718.02', '60911.35', '88193.44']
    assert k['refi_old_months_left'] == 266 and rate6(k['refi_ltv_after']) == '0.799605' and not k['refi_above_fha_80']
    assert k['refi_fits'] and k['refi_law_share'] == F(100, 103)
    assert [money(k[x]) for x in ('alt_refi_new_loan', 'alt_refi_fees', 'alt_refi_monthly', 'alt_refi_todays_money')] == \
        ['304123.71', '9123.71', '1872.54', '55905.57'] and rate6(k['alt_refi_ltv_after']) == '0.800326'
    assert [money(k[x]) for x in ('loan_monthly', 'loan_interest', 'loan_todays_money')] == ['667.33', '10040.01', '5362.47']
    assert k['ranking'] == k['alt_ranking_lowest_first'] == k['alt_ranking_before_tax'] == 'cash;line;loan;refi'
    assert k['best'] == 'cash' and k['alt_ranking_refi_no_mortgage'] is None
    k2 = ren_2(ren_row(R.KITCHEN, dict(R.KITCHEN_INPUTS, usable_cash=25000, itemizes='no')))
    assert k2['ranking'] == 'line;loan;refi' and k2['line_tax_saved'] == 0 and money(k2['cushion']) == '-5000.00'
    assert money(k2['line_todays_money']) == '4316.79'
    k4 = ren_2(ren_row(dict(R.KITCHEN, home_value=330000), R.KITCHEN_INPUTS))                # C4: 303,850 > 80% of 330,000
    assert money(k4['borrowable']) == '15500.00' and not k4['line_fits'] and not k4['refi_fits'] and k4['ranking'] == 'cash;loan'
    k5 = ren_2(ren_row(dict(R.KITCHEN, home_value=300000), R.KITCHEN_INPUTS))                # borrowable at least 0
    assert k5['borrowable'] == 0
    k6 = ren_2(ren_row(dict(R.KITCHEN, mortgage_balance='', mortgage_rate='', mortgage_payment=''), R.KITCHEN_INPUTS))
    assert k6['refi_new_loan'] is None and k6['refi_todays_money'] is None and k6['ranking'] == 'cash;line;loan'   # R3
    assert (money(k6['alt_refi_no_mortgage_monthly']), money(k6['alt_refi_no_mortgage_todays_money'])) == ('190.26', '150.46')
    assert k6['alt_refi_no_mortgage_fits'] and k6['alt_ranking_refi_no_mortgage'] == 'cash;refi;line;loan'
    k7 = ren_2(ren_row(dict(R.KITCHEN, cost=2000, recoup='1.5'),
                       dict(R.KITCHEN_INPUTS, blended_return='0.0801', itemizes='no')))                 # R5 (ren-0014)
    assert money(k7['line_todays_money']) == '-0.87' and k7['best'] == 'cash' and k7['ranking'] == 'cash;line;loan;refi'
    assert k7['alt_ranking_lowest_first'] == 'line;cash;loan;refi'
    n += 21
    # fourth revision: L1 (ren-0008: the mortgage over the limit loses part of its deduction while the line runs)
    k8 = ren_2(ren_row(dict(R.KITCHEN, cost=120000, home_value=1400000, mortgage_balance=900000, mortgage_rate='0.04',
                            mortgage_payment=5000), dict(R.KITCHEN_INPUTS, usable_cash=150000)))
    assert [money(k8[x]) for x in ('line_interest', 'line_mortgage_interest_in_term', 'line_tax_saved', 'alt_line_tax_saved_r1',
                                   'line_todays_money', 'alt_line_todays_money_r1')] == \
        ['54711.74', '305500.39', '2466.77', '9655.01', '14878.56', '9141.43']
    assert k8['ranking'] == k8['alt_ranking_line_r1'] == 'cash;line;loan;refi'
    # D1 (ren-0016: the kitchen with the refinance rate blank, 6.5% over 30 years)
    k9 = ren_2(ren_row(dict(R.KITCHEN, refi_rate=''), R.KITCHEN_INPUTS))
    assert [money(k9[x]) for x in ('refi_new_loan', 'refi_monthly', 'refi_tax_saved', 'alt_refi_todays_money_before_tax',
                                   'refi_todays_money')] == ['303850.00', '1920.54', '62494.83', '97448.28', '62438.67']
    assert k9['refi_months'] == 360 and k9['refi_fits'] and k9['ranking'] == 'cash;line;loan;refi'
    assert k9['alt_ranking_blank_refi_not_offered'] == 'cash;line;loan'
    n += 5
    return n


# ======================================== the generator: helpers ========================================

def pick(rng, weighted):
    total = sum(w for w, _ in weighted)
    x = rng.randrange(total)
    for w, v in weighted:
        if x < w:
            return v
        x -= w
    raise AssertionError


def cents_str(c):
    """Integer cents -> '1234' (whole dollars) or '1234.56'."""
    assert c >= 0
    return str(c // 100) if c % 100 == 0 else f'{c // 100}.{c % 100:02d}'


def dec_str(n, places):
    """n / 10^places as the shortest decimal string ('0.0725', '0.06', '0', '1.25')."""
    s = f'{n // 10 ** places}.{n % 10 ** places:0{places}d}'.rstrip('0').rstrip('.')
    return s


def pay_cents(balance_cents, bps, months):
    """The level payment that repays balance_cents at bps / 10000 a year in `months`, rounded up to the cent."""
    r = F(bps, 120000)
    b = F(balance_cents, 100)
    p = b / months if r == 0 else b * r / (1 - (1 + r) ** -months)
    return ceil_f(p * 100)


def last_day(y, m):
    return date(y, m, mlen_2(y, m))


def month_after(k, day=None):
    """A date k months after October 2026: the month's last day, or `day` (capped at the month's length)."""
    t = 9 + k
    y, m = 2026 + t // 12, t % 12 + 1
    if day is None:
        return last_day(y, m)
    return date(y, m, min(day, mlen_2(y, m)))


CAR_NAMES = ('Sedan', 'Hatchback', 'Wagon', 'Pickup', 'Minivan', 'Coupe', 'Crossover', 'Van', 'Roadster', 'Compact')
ITEMS = ('Sofa', 'Laptop', 'Bike', 'Fridge', 'Piano', 'Kayak', 'Roof', 'Trip', 'Camera', 'Hot tub', 'Dining set',
         'Mower', 'Phone', 'Bed', 'TV', 'Washer', 'Furnace', 'Guitar')
GOAL_NAMES = ('Holiday', 'Car fund', 'Rainy-day top-up', 'Wedding', 'Course', 'Gift fund', 'New roof', 'Move',
              'Baby fund', 'Garden', 'Dental work', 'Tools')


# ======================================== the generator: vehicles ========================================

def V(name, value, miles, insurance, maintenance, registration, mpg='', fuel_price='', electric='', kwh='', kwh_price='',
      loss='', loan=None):
    d = {'name': name, 'value': value, 'miles': miles, 'mpg': mpg, 'fuel_price': fuel_price, 'electric': electric,
         'kwh_per_mile': kwh, 'kwh_price': kwh_price, 'insurance': insurance, 'maintenance': maintenance,
         'registration': registration, 'loss': loss}
    if loan:
        d['loan_balance'], d['loan_rate'], d['loan_payment'] = loan
    return d


def W(**kw):
    w = {k: str(v) for k, v in R.SEDAN_WHATIF.items()}
    w.update({k: str(v) for k, v in kw.items()})
    return w


def veh_edges():
    sedan, ev = R.SEDAN, R.EV
    nol = {k: v for k, v in sedan.items() if not k.startswith('loan')}
    guz = V('Pickup', 3000, 25000, 1200, 3500, 100, mpg=12, fuel_price='5.00', loss='0.15')
    guz2 = V('Van', 3000, 12000, 1000, 4000, 100, mpg=11, fuel_price='5.20')
    return [
        ("RULES.md 8.1: Ana's sedan and hatchback, the sedan's what-if over 5 years", [sedan, ev], W()),
        ('the sedan over 1 year: period shorter than the 36-month lease', [sedan], W(years=1)),
        ('the sedan over 3 years: period equal to the lease (one lease)', [sedan], W(years=3)),
        ('the sedan over 10 years: four 36-month leases, the new loan paid off inside the period', [sedan], W(years=10)),
        ('the sedan over 2 years with a 24-month lease, miles equal to the allowance',
         [sedan], W(years=2, lease_months=24, lease_miles=12000)),
        ('the sedan over 4 years, miles under the allowance (no excess charge)', [sedan], W(years=4, lease_miles=15000)),
        ('electric first car over 6 years; new mpg blank: the new car charged like the hatchback (E1; its contrast, 32 '
         'mpg at the 3.50 fuel price the electric car carries)', [dict(ev, fuel_price='3.50'), sedan],
         W(new_mpg='', years=6)),
        ('the sedan with no loan', [nol], W(years=5)),
        ('a car worth less than its loan: the negative trade-in paid in cash on buy and lease',
         [V('Compact', 9000, 14000, 1100, 600, 150, mpg=33, fuel_price='3.89', loan=(14000, '0.089', 450))],
         W(years=4, new_price=26000, cash_down=0)),
        ('0% new rate', [sedan], W(new_rate=0, years=7)),
        ('new term 84 months over a 3-year period: the new loan still owed at the end',
         [sedan], W(new_term=84, years=3)),
        ('upkeep rise 0', [sedan], W(upkeep_rise=0, years=8)),
        ('typed loss 20%, insurance share 1.00 and rise 5%',
         [dict(sedan, loss='0.20')], W(new_insurance_share='1.00', upkeep_rise='0.05', years=6)),
        ('a gas guzzler kept 10 years: buying aims to be cheapest', [guz],
         W(years=10, new_price=21000, new_sales_tax='0.05', new_mpg=55, new_rate=0, new_term=60, cash_down=0,
           new_insurance_share='1.00', new_maintenance=300, lease_monthly=450, lease_due=1500, lease_months=36,
           lease_miles=15000, lease_excess='0.25', upkeep_rise='0.03')),
        ('a gas guzzler over 3 years against an expensive new car: leasing aims to be cheapest', [guz2],
         W(years=3, new_price=65000, new_sales_tax='0.09', new_mpg=50, new_rate='0.11', new_term=72, cash_down=0,
           new_insurance_share='1.60', new_maintenance=600, lease_monthly=189, lease_due=0, lease_months=36,
           lease_miles=12000, lease_excess='0.25', upkeep_rise='0.05')),
        ('old loan at 0%: 16 payments of 250', [V('Wagon', 15000, 10000, 1300, 700, 180, mpg=29, fuel_price='3.65',
                                                   loan=(4000, 0, 250))], W(years=2)),
        ('a tiny old loan paid off in its first month (payment cut to balance + interest)',
         [V('Coupe', 11000, 9000, 1400, 500, 220, mpg=27, fuel_price='4.10', loan=(200, '0.06', 350))], W(years=1)),
        ('two cars, both with loans', [sedan, V('Crossover', 25000, 11000, 1600, 650, 300, mpg=31, fuel_price='3.50',
                                                 loan=(15000, '0.049', 400))], W(years=5)),
        ('electric second car with a loan', [nol, dict(ev, loan_balance=12000, loan_rate='0.039', loan_payment=310)],
         W(years=5)),
        ('a loan of 24 level payments over a 2-year period',
         [V('Sedan', 16000, 12000, 1500, 800, 200, mpg=30, fuel_price='3.50', loan=(8000, '0.05', '350.98'))],
         W(years=2)),
        ('large cash down: a small new loan', [sedan], W(cash_down=20000, years=5)),
        ('lease of 39 months over 5 years (two leases), excess charge 0.30 a mile', [sedan],
         W(lease_months=39, lease_excess='0.30', lease_miles=7500)),
        ('long period, high rise: 9 years at 15%', [sedan], W(years=9, upkeep_rise='0.15')),
        ('fuel price and mpg with decimals, loss blank, share blank',
         [V('Hatchback', '12345.67', 13500, '987.65', '432.10', '123.45', mpg='31.5', fuel_price='3.479')],
         W(years=5, new_mpg='42.5', new_price='28999.99', new_sales_tax='0.0725')),
        # fourth revision (2026-10-31): D1, A7, A9
        ("D1: the sedan with the new mpg and the new upkeep blank: 32 mpg (fuel 1,312.50) and $500 (A3, the contrast, "
         "keeps the sedan's 1,400 and 800)", [sedan], W(new_mpg='', new_maintenance='')),
        ('D1: every what-if field blank but the years: new price 35,000, tax 6%, 32 mpg, 7% over 60 months, cash down 0, '
         'insurance share 1.25, upkeep 500, lease 450 a month, 3,000 due, 36 months, 12,000 miles, 0.25 a mile, rise 10%',
         [sedan], W(**{f: '' for f in WHATIF_FIELDS if f != 'years'})),
        ('A7: the old car (40,000, no loan) is worth more than the new car with its tax (24,000 x 1.06 = 25,440); with '
         '3,000 down the cash back is 17,560', [dict(nol, value=40000)],
         W(new_price=24000, new_sales_tax='0.06', cash_down=3000)),
        ('A7: the same with no cash down: cash back 14,560, the same cost (with cash back the cash down comes straight '
         'back)', [dict(nol, value=40000)], W(new_price=24000, new_sales_tax='0.06', cash_down=0)),
        ('A7: a car with a loan whose equity (45,000 - 5,000) and 1,000 down are more than the new car with tax (30,000 x '
         '1.07): cash back 8,900; the old loan is paid off by the trade-in',
         [dict(sedan, value=45000, loan_balance=5000)], W(new_price=30000, new_sales_tax='0.07', cash_down=1000, years=3)),
        ('A7: worth more than the new price but not with its tax (26,000 against 25,000 x 1.08 = 27,000); the 1,500 down '
         'tips it: cash back 500', [dict(nol, value=26000)],
         W(new_price=25000, new_sales_tax='0.08', cash_down=1500, years=4)),
        ('A7: the equity and the cash down cover the new price with tax exactly (25,000 + 2,000 = 25,000 x 1.08): '
         'nothing financed, no cash back', [dict(nol, value=25000)],
         W(new_price=25000, new_sales_tax='0.08', cash_down=2000, years=2)),
        ('A9: a 5,000 wagon kept a year costs 300.00, a 15,000 car at 0% over 12 months 299.60: 0.40 lower, not more '
         'than $1, so keep stays the cheapest (the lowest is buy)', [R.WAGON], {k: str(v) for k, v in R.WAGON_WHATIF.items()}),
    ]


def random_loan(rng, value_c, P, kind):
    bps = 0 if rng.randint(1, 100) <= 8 else rng.randint(150, 2200)
    if kind == 'short':
        bal = value_c * rng.randint(5, 60) // 100
        n = rng.randint(1, max(1, P - 1))
    elif kind == 'under':
        bal = value_c * rng.randint(105, 170) // 100
        n = rng.randint(24, 84)
    else:
        bal = value_c * rng.randint(5, 95) // 100
        n = rng.randint(6, 84)
    bal = max(bal, 10000) // 100 * 100 if rng.randint(1, 3) > 1 else max(bal, 10000)
    pay = pay_cents(bal, bps, n)
    if rng.randint(1, 4) == 1:
        pay = ceil_f(F(pay, 100)) * 100                     # a whole-dollar payment
    return cents_str(bal), dec_str(bps, 4), cents_str(pay)


def random_car(rng, electric, P, guzzler=False):
    value_c = rng.randint(15, 600) * 10000
    if rng.randint(1, 10) == 1:
        value_c += rng.randint(1, 9999)
    if guzzler:
        miles = rng.randint(30, 60) * 500
    else:
        miles = rng.randint(6, 50) * 500
    d = {'name': rng.choice(CAR_NAMES), 'value': cents_str(value_c), 'miles': str(miles)}
    if electric:
        d.update({'mpg': '', 'fuel_price': '', 'electric': 'yes', 'kwh_per_mile': dec_str(rng.randint(24, 40), 2),
                  'kwh_price': dec_str(rng.randint(9, 45), 2)})
    else:
        if guzzler:
            mpg = str(rng.randint(10, 17))
        elif rng.randint(1, 5) == 1:
            mpg = dec_str(rng.randint(120, 550), 1)
        else:
            mpg = str(rng.randint(14, 55))
        d.update({'mpg': mpg, 'fuel_price': dec_str(rng.randint(250, 560), 2), 'electric': '', 'kwh_per_mile': '',
                  'kwh_price': ''})
    d['insurance'] = str(rng.randint(40, 300) * 10)
    d['maintenance'] = str(rng.randint(30, 80) * 50 if guzzler else rng.randint(2, 40) * 50)
    d['registration'] = str(rng.randint(3, 80) * 10)
    d['loss'] = '' if rng.randint(1, 100) <= 55 else dec_str(rng.randint(3, 25), 2)
    kind = pick(rng, [(35, 'none'), (35, 'normal'), (15, 'short'), (15, 'under')])
    if kind == 'none':
        d['loan_balance'] = d['loan_rate'] = d['loan_payment'] = ''
    else:
        d['loan_balance'], d['loan_rate'], d['loan_payment'] = random_loan(rng, value_c, P, kind)
    return d


def random_veh_case(rng, rng_fuel):
    years = rng.randint(1, 10)
    P = 12 * years
    guzzler = rng.randint(1, 100) <= 12
    first_electric = (not guzzler) and rng.randint(1, 100) <= 7
    cars = [random_car(rng, first_electric, P, guzzler)]
    if first_electric:                           # E1's contrast (32 mpg) needs a fuel price (second stream)
        cars[0]['fuel_price'] = dec_str(rng_fuel.randint(250, 560), 2)
    if rng.randint(1, 100) <= 40:
        cars.append(random_car(rng, rng.randint(1, 100) <= 20, P))
    car = cars[0]
    tax_bps = 0 if rng.randint(1, 100) <= 12 else rng.randint(1, 40) * 25
    w = {'years': str(years), 'new_price': str(rng.randint(120, 750) * 100), 'new_sales_tax': dec_str(tax_bps, 4),
         'new_mpg': '' if first_electric else str(rng.randint(18, 60)),
         'new_rate': '0' if rng.randint(1, 100) <= 14 else dec_str(rng.randint(1, 140) * 10, 4),
         'new_term': str(rng.choice((24, 36, 48, 60, 60, 72, 84))), 'cash_down': str(rng.randint(0, 30) * 250),
         'new_insurance_share': '' if rng.randint(1, 2) == 1 else dec_str(rng.randint(90, 170), 2),
         'new_maintenance': str(rng.randint(0, 24) * 50),
         'lease_monthly': str(rng.randint(149, 899) if not guzzler else rng.randint(149, 450)),
         'lease_due': str(rng.randint(0, 40) * 100),
         'lease_months': str(rng.choice((24, 36, 36, 39, 48))),
         'lease_miles': str(rng.choice((7500, 10000, 10000, 12000, 12000, 15000))),
         'lease_excess': dec_str(rng.randint(10, 35), 2),
         'upkeep_rise': pick(rng, [(40, ''), (15, '0'), (45, None)])}
    if w['upkeep_rise'] is None:
        w['upkeep_rise'] = dec_str(rng.randint(1, 15), 2)
    tin = fr(car['value']) - (fr(car['loan_balance']) if car['loan_balance'] else ZERO)
    while True:                                  # keep the new loan's amount above 0 (A7 is not exercised)
        raw = fr(w['new_price']) * (1 + fr(w['new_sales_tax'])) - max(ZERO, tin) - fr(w['cash_down'])
        if raw > 500:
            break
        w['cash_down'] = '0'
        if fr(w['new_price']) * (1 + fr(w['new_sales_tax'])) - max(ZERO, tin) <= 500:
            w['new_price'] = str(int(fr(w['new_price'])) + 5000)
    return cars, w


VEH_COLUMNS = ['case_id', 'row_kind', 'cars', *WHATIF_FIELDS, 'car_results',
               *[k for k, _ in VEH_SPEC], 'note']


def veh_note(c, d, edge):
    bits = [edge] if edge else []
    cars = split_cars(c['cars'])
    car = cars[0]
    P = d['period_months']
    if car['loan_balance'] == '':
        bits.append('no old loan')
    elif d['keep_owed_end'] > STOP_2:
        bits.append(f'keep: the old loan still owes {usd(d["keep_owed_end"])} at the end (taken off what keep gets back, A6)')
    else:
        bits.append(f'the old loan is paid off in month {d["keep_loan_months"]} of {P}')
    if d['trade_in'] < 0:
        bits.append(f'worth less than its loan: {usd(-d["trade_in"])} paid in cash on buy and lease')
    elif d['trade_in'] > 0:
        bits.append(f'lease: the {usd(d["trade_in"])} trade-in is credited (A5)')
    if d['buy_owed_end'] > STOP_2:
        bits.append(f'buy: {usd(d["buy_owed_end"])} still owed on the new loan at the end')
    if d['cash_back'] > 0:
        bits.append(f'buy: the equity and the cash down are {usd(d["cash_back"])} more than the new car with its tax: '
                    'cash back, nothing financed (A7)')
    elif d['financed'] == 0:
        bits.append('buy: nothing financed, no cash back (A7)')
    if c['new_mpg'] == '' and car['electric'] == 'yes':
        bits.append('electric first car, new mpg blank: the new car charged like the car (E1; at 32 mpg and the car\'s '
                    f'fuel price buy would cost {usd(d["alt_buy_electric_new_at_32_mpg"])}, lease '
                    f'{usd(d["alt_lease_electric_new_at_32_mpg"])})')
    elif c['new_mpg'] == '':
        bits.append("new mpg blank: the new car at 32 mpg and the car's fuel price (D1)")
    if c['new_maintenance'] == '':
        bits.append('new upkeep blank: $500 a year (D1)')
    bits.append(f'cheapest: {d["cheapest"]}')
    if d['alt_cheapest_lowest'] != d['cheapest']:
        bits.append(f'kept by the $1 margin (A9); the lowest is {d["alt_cheapest_lowest"]}')
    return join_note(bits)


def veh_csv_row(cid, kind, c, d, note):
    row = {'case_id': cid, 'row_kind': kind, 'cars': c['cars']}
    for f in WHATIF_FIELDS:
        row[f] = c[f]
    row['car_results'] = ';'.join('|'.join(fmt(t, x[k]) for k, t in CAR_SPEC) for x in d['cars'])
    for k, t in VEH_SPEC:
        row[k] = fmt(t, d[k])
    row['note'] = note
    return row


def veh_stats(s, c, d):
    cars = split_cars(c['cars'])
    car = cars[0]
    P = d['period_months']
    L = int(c['lease_months']) if c['lease_months'] != '' else R.DEFAULT_LEASE_MONTHS        # D1
    s[f'rows with {len(cars)} car(s)'] += 1
    s[f'period {P // 12} years'] += 1
    s['electric cars (any position)'] += sum(x['electric'] == 'yes' for x in cars)
    s['electric first car (new mpg blank: charged like the car, E1)'] += car['electric'] == 'yes'
    s['cars with a loan'] += sum(x['loan_balance'] != '' for x in cars)
    s['car loan paid off inside its 12-month year'] += sum(x['loan_balance_after_year'] is not None and
                                                           x['loan_months_year'] < 12 for x in d['cars'])
    if car['loan_balance'] == '':
        s['first car: no loan'] += 1
    elif d['keep_owed_end'] > STOP_2:
        s['first car: old loan outlasts the period (keep owes at the end)'] += 1
    else:
        s['first car: loan paid off inside the period'] += 1
    s['first car worth less than its loan'] += d['trade_in'] < 0
    s['old loan rate 0'] += car['loan_rate'] == '0'
    s['new rate 0%'] += c['new_rate'] != '' and fr(c['new_rate']) == 0
    s['new loan still owed at the end'] += d['buy_owed_end'] > STOP_2
    s['new loan paid off inside the period'] += d['buy_owed_end'] <= STOP_2
    s['period shorter than the lease' if P < L else ('period equal to the lease' if P == L
                                                     else 'period longer than the lease')] += 1
    miles, allow = fr(car['miles']), (fr(c['lease_miles']) if c['lease_miles'] != '' else F(R.DEFAULT_LEASE_MILES))
    s['miles over the allowance' if miles > allow else ('miles equal to the allowance' if miles == allow
                                                        else 'miles under the allowance')] += 1
    s['upkeep rise blank (10%)' if c['upkeep_rise'] == '' else ('upkeep rise 0' if fr(c['upkeep_rise']) == 0
                                                                else 'upkeep rise typed above 0')] += 1
    s['loss blank (12%)'] += car['loss'] == ''
    s['insurance share blank (1.25)'] += c['new_insurance_share'] == ''
    s[f'cheapest {d["cheapest"]}'] += 1
    s['lease: positive trade-in credited'] += d['trade_in'] > 0
    s['keep: what the old loan still owes taken off'] += d['keep_owed_end'] > STOP_2
    alt = {'keep': d['alt_keep_rise_all'], 'buy': d['alt_buy_rise_all'], 'lease': d['alt_lease_rise_all']}
    alt_cheapest = R.best_by_walk(R.WAY_ORDER_A, alt, R.CHEAPEST_MARGIN)               # the main walk (A9) on A1's costs
    s['cheapest differs under the all-rising contrast (A1)'] += alt_cheapest != d['cheapest']
    s['buy: cash back (A7)'] += d['cash_back'] > 0
    s['buy: nothing financed and no cash back (exactly covered, A7)'] += d['financed'] == 0 and d['cash_back'] == 0
    s['cheapest kept by the $1 margin (A9; the lowest is another way)'] += d['alt_cheapest_lowest'] != d['cheapest']
    s['new mpg blank on a petrol first car (32 mpg, D1)'] += c['new_mpg'] == '' and car['electric'] != 'yes'
    s['new maintenance blank ($500, D1)'] += c['new_maintenance'] == ''
    s['every what-if field blank but the years (D1)'] += all(c[f] == '' for f in WHATIF_FIELDS if f != 'years')
    s["A3 contrast differs (a blank new mpg or upkeep kept the old car's)"] += \
        d['alt_buy_blank_keeps_old'] != d['buy_cost'] or d['alt_lease_blank_keeps_old'] != d['lease_cost']
    e1 = d['alt_buy_electric_new_at_32_mpg'] != d['buy_cost'] or d['alt_lease_electric_new_at_32_mpg'] != d['lease_cost']
    s["E1 contrast differs (an electric first car's new car at 32 mpg)"] += e1
    s['E1 contrast changes the cheapest'] += e1 and R.best_by_walk(R.WAY_ORDER_A, {
        'keep': d['keep_cost'], 'buy': d['alt_buy_electric_new_at_32_mpg'],
        'lease': d['alt_lease_electric_new_at_32_mpg']}, R.CHEAPEST_MARGIN) != d['cheapest']


def build_veh(rng, guard, rng_fuel):
    rows, stats = [], Counter()
    edges = veh_edges()
    cases = [('edge', note, veh_row(cars, w)) for note, cars, w in edges]
    for _ in range(RANDOM_DRAWS['veh']):         # the same draws as before; the first ones that fit are kept
        cars, w = random_veh_case(rng, rng_fuel)
        if len(cases) < N_VEH:
            cases.append(('random', '', {'cars': ';'.join(car_str(x) for x in cars), **w}))
    assert len(cases) == N_VEH
    for i, (kind, note, c) in enumerate(cases, 1):
        cid = f'veh-{i:04d}'
        d1, d2 = veh_1(c), veh_2(c)
        compare_veh(guard, cid, d1, d2)
        row = veh_csv_row(cid, kind, c, d1, veh_note(c, d1, note))
        rows.append(row)
        veh_stats(stats, c, d1)
        stats['half-cent amounts written (rounded up)'] += sum(half_cent(x[k]) for x in d1['cars']
                                                               for k, t in CAR_SPEC if t == 'm') + \
            sum(half_cent(d1[k]) for k, t in VEH_SPEC if t == 'm')
    return rows, stats, len(edges)


# ======================================== the generator: purchases ========================================

def G(name, priority, due, target, set_aside, monthly, growth):
    return {'name': name, 'priority': priority, 'due': due, 'target': target, 'set_aside': set_aside,
            'monthly': monthly, 'growth': growth}


def pur_edges():
    sofa, inp = R.SOFA, R.SOFA_INPUTS

    def S(goals=None, inputs=None, **kw):
        case = dict(sofa, **kw)
        if goals is not None:
            case['goals'] = goals
        return case, dict(inp, **(inputs or {}))

    perm = []
    for pr in ((1, 2, 3), (1, 3, 2), (2, 1, 3), (2, 3, 1), (3, 1, 2), (3, 2, 1)):
        gs = [G(nm, p, due, 4000, 500, 100, '0.03') for nm, p, due in
              zip(('Holiday', 'Car fund', 'Course'), pr, ('2027-12-31', '2028-06-30', '2029-03-31'))]
        perm.append((f'priority order {"-".join(map(str, pr))}: three goals give 100 + 100 + 50 of a 250 need',
                     S(goals=gs, price=3000, sales_tax=0, set_aside=0, when='2027-10-31', apr='0.18', term=24, promo=0,
                       inputs={'spare': 0, 'cash_return': 0})))
    tie = [G('Holiday', 3, '2028-03-31', 3000, 200, 100, '0.02'), G('Course', 3, '2030-06-30', 3000, 200, 100, '0.02'),
           G('Car fund', 1, '2029-12-31', 10000, 2500, 200, '0.04')]
    eq = [G('Holiday', 2, '2028-03-31', 3000, 200, 100, '0.02'), G('Course', 2, '2028-03-31', 3000, 200, 100, '0.02')]
    small = [G('Holiday', 3, '2027-12-31', 2000, 400, 60, '0.04'), G('Gift fund', 2, '2028-12-31', 1500, 100, 40, 0)]
    done = [G('Gift fund', 3, '2027-06-30', 1000, 1500, 50, '0.01'), G('Car fund', 2, '2029-12-31', 10000, 2500, 200,
                                                                         '0.04')]
    nothing = [G('Garden', 3, '2028-06-30', 5000, 2000, 0, '0.05'), G('Tools', 3, '2028-09-30', 900, 300, 0, 0),
               G('Car fund', 1, '2029-12-31', 10000, 2500, 200, '0.04')]
    four = [G('Holiday', 3, '2027-12-31', 2000, 400, 150, '0.04'), G('Course', 2, '2028-08-31', 2500, 0, 120, '0.02'),
            G('Car fund', 2, '2029-12-31', 10000, 2500, 200, '0.04'), G('Move', 1, '2028-02-29', 6000, 1000, 300, 0)]
    return [
        ("RULES.md 8.2: Ben's sofa", S()),
        ('no date', S(when='')),
        ('the date is today (2026-10-31): 0 whole months, at least 1', S(when='2026-10-31')),
        ('a date earlier this month (in the past): at least 1 month', S(when='2026-10-05')),
        ('next month, its last day: W2 0 -> 1 (the 31st is not reached; W1 1)', S(when='2026-11-30')),
        ('next month, mid-month: 0 whole months -> 1', S(when='2026-11-15')),
        ('2026-12-30: W2 1 (the 30th is before the 31st), W1 1, W3 2', S(when='2026-12-30')),
        ("2027-02-28, February's last day: W2 3, W1 4", S(when='2027-02-28')),
        ('already set aside more than the total: save 0, earned 0 (B8, the set-aside money counts up to the total), nothing financed',
         S(set_aside=4000)),
        ('set aside exactly the total', S(set_aside=3180)),
        ('cash return 0: save (total - set aside) / months', S(inputs={'cash_return': 0})),
        ('spare 0: the whole monthly amount is needed', S(inputs={'spare': 0})),
        ('spare enough for both ways: no goal gives way', S(inputs={'spare': 2000})),
        ('promo equal to the term: all 0%', S(promo=24)),
        ('APR 0 and no promo: all 0%', S(apr=0, promo=0)),
        ('no promo: a level payment at the APR', S(promo=0)),
        ('promo of 1 month', S(promo=1)),
        ('promo of term - 1 months', S(promo=23)),
        ('more than you have: spare 0 and the goals give only 100 of 266', S(goals=small, inputs={'spare': 0})),
        ('a goal already done (1,500 set aside of 1,000) is skipped: the Car fund gives instead (P2)', S(goals=done)),
        ('goals saving nothing: one reaches its target by growth alone, one never', S(goals=nothing)),
        ('same priority, different due dates: the later due gives first', S(goals=tie, inputs={'spare': 116})),
        ('same priority and the same due date: the listed order (B3)', S(goals=eq, inputs={'spare': 116})),
        ('four goals', S(goals=four, inputs={'spare': 0})),
        ('no goals: spare 0, all of it more than you have', S(goals=[], inputs={'spare': 0})),
        ('price with cents, 4-decimal tax', S(price='2499.99', sales_tax='0.0825', set_aside='123.45')),
        *perm,
        # fourth revision (2026-10-31): B5
        ('B5: spare -150 counts as 0 ("Nothing spare: everything comes from goals"): the goals cover the whole monthly '
         'amount; the literal reading would take 150 more from them', S(inputs={'spare': -150})),
        ('B5: spare -150 and more than the total set aside: nothing is needed (the literal reading would still take 150 '
         'a month from the goals)', S(set_aside=4000, inputs={'spare': -150})),
        ('B5: spare -200 and no goals: the whole monthly amount is more than you have (the literal reading: 200 more)',
         S(goals=[], inputs={'spare': -200})),
    ]


def random_goal(rng, name):
    priority = rng.randint(1, 3)
    k = rng.randint(1, 120)
    due = month_after(k) if rng.randint(1, 4) == 1 else month_after(k, rng.randint(1, 31))
    target = rng.randint(5, 400) * 100
    kind = pick(rng, [(8, 'done'), (10, 'nothing'), (82, 'normal')])
    growth = '0' if rng.randint(1, 100) <= 30 else dec_str(rng.randint(1, 60) * 10, 4)
    if kind == 'done':
        sa, monthly = target + rng.randint(0, 50) * 100, rng.randint(0, 40) * 10
    elif kind == 'nothing':
        sa, monthly = rng.randint(0, target // 100 - 1) * 100, 0
    else:
        sa, monthly = rng.randint(0, target // 100 - 1) * 100, rng.randint(1, 80) * 10
    return G(name, priority, due.isoformat(), target, sa, monthly, growth)


def random_pur_case(rng):
    price_c = rng.randint(2, 600) * 10000
    if rng.randint(1, 4) == 1:
        price_c += rng.randint(1, 9999)
    tax_bps = 0 if rng.randint(1, 100) <= 20 else rng.randint(1, 40) * 25
    total = F(price_c, 100) * (1 + F(tax_bps, 10000))
    kind = pick(rng, [(7, 'none'), (5, 'this'), (5, 'next'), (13, 'end'), (70, 'any')])
    if kind == 'none':
        when = ''
    elif kind == 'this':
        when = date(2026, 10, rng.randint(1, 31)).isoformat()
    elif kind == 'next':
        when = date(2026, 11, rng.randint(1, 30)).isoformat()
    elif kind == 'end':
        when = month_after(rng.randint(2, 60)).isoformat()
    else:
        when = month_after(rng.randint(2, 60), rng.randint(1, 31)).isoformat()
    total_c = total * 100
    sk = pick(rng, [(25, 'zero'), (60, 'part'), (9, 'over'), (6, 'equal')])
    if sk == 'equal' and total_c.denominator != 1:
        sk = 'over'
    if sk == 'zero':
        sa_c = 0
    elif sk == 'part':
        sa_c = rng.randint(1, max(1, int(total_c) - 1))
        if rng.randint(1, 3) > 1:
            sa_c = sa_c // 100 * 100
    elif sk == 'over':
        sa_c = int(total_c) + rng.randint(1, 100000)
    else:
        sa_c = int(total_c)
    term = rng.choice((6, 12, 12, 18, 24, 24, 36, 48, 60))
    pk = pick(rng, [(40, 'none'), (15, 'all'), (45, 'part')])
    promo = 0 if pk == 'none' else (term if pk == 'all' else rng.randint(1, term - 1))
    apr = 0 if rng.randint(1, 100) <= 10 else rng.randint(299, 2999)
    n_goals = pick(rng, [(10, 0), (20, 1), (25, 2), (28, 3), (17, 4)])
    goals = [random_goal(rng, nm) for nm in rng.sample(GOAL_NAMES, n_goals)]
    spare = pick(rng, [(15, 0), (12, 5000), (73, None)])
    if spare is None:
        spare = rng.randint(0, 150) * 10
    case = {'name': rng.choice(ITEMS), 'price': cents_str(price_c), 'sales_tax': dec_str(tax_bps, 4), 'when': when,
            'set_aside': cents_str(sa_c), 'apr': dec_str(apr, 4), 'term': str(term), 'promo': str(promo),
            'goals': goals}
    inputs = {'spare': str(spare), 'usable_cash': str(rng.randint(0, 800) * 100),
              'emergency_target': str(rng.randint(0, 400) * 100),
              'cash_return': '0' if rng.randint(1, 100) <= 20 else dec_str(rng.randint(1, 50) * 10, 4)}
    return case, inputs


PUR_COLUMNS = ['case_id', 'row_kind', *PUR_INPUTS, 'total', 'months', 'months_w3', 'save_monthly',
               'save_earned', 'save_need', 'save_giving', 'save_uncovered', 'save_more_than_you_have', 'finance_kind',
               'finance_principal', 'finance_payment', 'finance_interest', 'finance_need', 'finance_giving',
               'finance_uncovered', 'finance_more_than_you_have', 'cash_after', 'cash_fits', 'goals_months',
               'alt_level_payment', 'alt_level_interest', 'alt_all_zero_payment', 'balance_after_promo',
               'deferred_interest_if_not_paid', 'alt_months_w1', 'alt_save_monthly_w1', 'alt_save_earned_w1',
               'alt_save_giving_done_goals_give', 'alt_save_uncovered_done_goals_give',
               'alt_finance_giving_done_goals_give', 'alt_finance_uncovered_done_goals_give',
               'alt_cash_fits_keeps_emergency_target', 'alt_save_need_spare_literal', 'alt_save_uncovered_spare_literal',
               'alt_finance_need_spare_literal', 'alt_finance_uncovered_spare_literal', 'note']


def giving_str(rows):
    return ';'.join('|'.join(fmt(t, x[k]) for k, t in GIVE_SPEC) for x in rows)


def pur_csv_row(cid, kind, c, d, note):
    row = {'case_id': cid, 'row_kind': kind}
    for k in PUR_INPUTS:
        row[k] = c[k]
    for k, t in PUR_SPEC:
        row[k] = fmt(t, d[k])
    for name in GIVE_LISTS:
        row[name] = giving_str(d[name])
    row['goals_months'] = ';'.join('|'.join(fmt(t, x[k]) for k, t in GOALM_SPEC) for x in d['goals_months'])
    row['note'] = note
    return row


def pur_note(c, d, edge):
    bits = [edge] if edge else []
    if fr(c['spare']) < 0:
        bits.append('spare below 0 counts as 0 (B5): "Nothing spare: everything comes from goals"')
    if d['months'] is None:
        bits.append('no date: no save-up way (B1)')
    elif d['months'] != d['alt_months_w1']:
        bits.append(f'whole months W2 {d["months"]} (W1 would say {d["alt_months_w1"]})')
    if fr(c['set_aside']) >= d['total']:
        bits.append('set aside covers the total')
    for way in ('save', 'finance'):
        for x in d[f'{way}_giving']:
            if x['paused']:
                bits.append(f'{way}: {x["name"]} paused')
        if d[f'{way}_uncovered']:
            bits.append(f'{way}: {usd(d[way + "_uncovered"])} a month more than you have')
        if d[f'{way}_done_skipped']:
            bits.append(f'{way}: a goal already done is skipped (P2)')
    if d['balance_after_promo'] is not None:
        bits.append(f'{usd(d["balance_after_promo"])} still owed after the promo')
    if d['cash_fits'] and not d['alt_cash_fits_keeps_emergency_target']:
        bits.append('pay cash fits (P3) but leaves less than the emergency target')
    return join_note(bits)


def pur_stats(s, c, d):
    when = c['when']
    if when == '':
        s['no date'] += 1
    elif when.startswith('2026-10'):
        s['date this month (October 2026)'] += 1
    elif when.startswith('2026-11'):
        s['date next month (November 2026)'] += 1
    else:
        s['date later'] += 1
    if d['months'] is not None:
        s['W2 differs from W1 (the contrast)'] += d['months'] != d['alt_months_w1']
        s['W2 differs from W3'] += d['months'] != d['months_w3']
    sa = fr(c['set_aside'])
    s['set aside more than the total'] += sa > d['total']
    s['set aside equal to the total'] += sa == d['total']
    s['cash return 0'] += fr(c['cash_return']) == 0
    s['spare 0'] += fr(c['spare']) == 0
    s['spare below 0 (counted as 0, B5)'] += fr(c['spare']) < 0
    for way in ('save', 'finance'):
        if d[f'{way}_need'] is not None:
            s['ways where the literal spare would change the need (B5 contrast)'] += \
                d[f'alt_{way}_need_spare_literal'] != d[f'{way}_need']
    if d['save_need'] is not None:
        s['save: spare enough (need 0)'] += d['save_need'] == 0
        s['save: goals give way'] += bool(d['save_giving'])
        s['save: more than you have'] += bool(d['save_uncovered'])
    s['finance: spare enough (need 0)'] += d['finance_need'] == 0
    s['finance: goals give way'] += bool(d['finance_giving'])
    s['finance: more than you have'] += bool(d['finance_uncovered'])
    s[f'finance {d["finance_kind"]}'] += 1
    s['cash fits' if d['cash_fits'] else 'cash does not fit'] += 1
    s['cash fits but leaves less than the emergency target (P3 against the contrast)'] += \
        d['cash_fits'] and not d['alt_cash_fits_keeps_emergency_target']
    goals = split_goals(c['goals'])
    s[f'rows with {len(goals)} goal(s)'] += 1
    pri = [int(g['priority']) for g in goals]
    if len(goals) == 3 and sorted(pri) == [1, 2, 3]:
        s[f'three goals, priority order {"-".join(map(str, pri))}'] += 1
    s['goals already done'] += sum(fr(g['set_aside']) >= fr(g['target']) for g in goals)
    s['goals saving nothing'] += sum(fr(g['monthly']) == 0 for g in goals)
    s['goals never reached (blank months)'] += sum(x['months'] is None for x in d['goals_months'])
    by = {g['name']: g for g in goals}
    for way in ('save', 'finance'):
        gv = d[f'{way}_giving']
        s['ways where two or more goals give way'] += len(gv) >= 2
        s['paused goals'] += sum(x['paused'] for x in gv)
        s['done goals skipped (P2), counted per way'] += d[f'{way}_done_skipped']
        s['ways where skipping a done goal changes who gives (P2)'] += \
            [x['name'] for x in gv] != [x['name'] for x in d[f'alt_{way}_giving_done_goals_give']]
        tie = False
        for a in range(len(gv)):
            for b in range(a + 1, len(gv)):
                ga, gb = by[gv[a]['name']], by[gv[b]['name']]
                if ga['priority'] == gb['priority'] and ga['due'] > gb['due']:
                    tie = True
        s['ways where a same-priority goal due later gives first'] += tie


def build_pur(rng, guard):
    rows, stats = [], Counter()
    edges = pur_edges()
    cases = [('edge', note, pur_row(case, inputs)) for note, (case, inputs) in edges]
    for _ in range(RANDOM_DRAWS['pur']):         # the same draws as before; the first ones that fit are kept
        case, inputs = random_pur_case(rng)
        if len(cases) < N_PUR:
            cases.append(('random', '', pur_row(case, inputs)))
    assert len(cases) == N_PUR
    for i, (kind, note, c) in enumerate(cases, 1):
        cid = f'pur-{i:04d}'
        d1, d2 = pur_1(c), pur_2(c)
        compare_pur(guard, cid, d1, d2)
        rows.append(pur_csv_row(cid, kind, c, d1, pur_note(c, d1, note)))
        pur_stats(stats, c, d1)
        stats['half-cent amounts written (rounded up)'] += sum(half_cent(d1[k]) for k, t in PUR_SPEC if t == 'm') + \
            sum(half_cent(x[k]) for way in GIVE_LISTS for x in d1[way] for k in ('gives', 'new_monthly'))
    return rows, stats, len(edges)


# ======================================== the generator: renovations ========================================

def ren_edges():
    kit, inp = R.KITCHEN, R.KITCHEN_INPUTS

    def K(inputs=None, **kw):
        return dict(kit, **kw), dict(inp, **(inputs or {}))

    none_home = dict(home='no', home_value='', mortgage_balance='', mortgage_rate='', mortgage_payment='',
                     refi_rate='', refi_years='')
    return [
        ("RULES.md 8.3: Cy and Dee's kitchen", K()),
        ('the kitchen with usable cash 25,000 and no itemizing: cash does not fit, no tax saved',
         K(inputs={'usable_cash': 25000, 'itemizes': 'no'})),
        ('no home: cash and the personal loan only', K(**none_home)),
        ('a home with no mortgage: the line can borrow 85% of value',
         K(mortgage_balance='', mortgage_rate='', mortgage_payment='')),
        ('not enough equity: 323,000 - 340,000 is below 0, so nothing could be borrowed',
         K(mortgage_balance=340000, mortgage_payment=1900)),
        ('plan return 0: today\'s money = total interest less the tax saved (R2)', K(inputs={'blended_return': 0})),
        ('refinance rate below the old rate', K(mortgage_rate='0.0725', mortgage_payment=2100, refi_rate='0.055')),
        ('a big mortgage: debt over $750,000, so only that share of the interest saves tax (R1, 163(h)(3)(F))',
         K(cost=120000, home_value=1400000, mortgage_balance=900000, mortgage_rate='0.04', mortgage_payment=5000,
           inputs={'usable_cash': 150000})),
        ('married filing separately: the $375,000 limit (R1)',
         K(cost=50000, home_value=700000, mortgage_balance=400000, mortgage_rate='0.045', mortgage_payment=2600,
           filing_status='married_separate')),
        ('mortgage rate 0: 100 payments of 1,000', K(mortgage_balance=100000, mortgage_rate=0, mortgage_payment=1000)),
        ('extra interest negative: an 8% mortgage refinanced at 4% over 15 years (the tax saved below 0 too)',
         K(mortgage_balance=300000, mortgage_rate='0.08', mortgage_payment=2400, home_value=500000, refi_rate='0.04',
           refi_years=15)),
        ('every default typed: refinance costs 5%, line 9.5% over 15 years, loan 18% over 3 years',
         K(refi_cost_share='0.05', heloc_rate='0.095', heloc_years=15, loan_rate='0.18', loan_years=3)),
        ('nothing fits but the loan: the line has 3,000 to lend and the refinance would be 111% of the value (C4)',
         K(cost=90000, mortgage_balance=320000, mortgage_payment=1800,
                                                          inputs={'usable_cash': 20000})),
        ('recoup above 1; no itemizing and a plan return just above the line\'s 8%: the line\'s today\'s money is 0.87 '
         'below cash\'s, not more than $1, so cash stays best (R5); sorted plainly the line would be first',
         K(cost=2000, recoup='1.5', inputs={'blended_return': '0.0801', 'itemizes': 'no'})),
        ('a cheap line against a 9% plan return: the line beats cash', K(heloc_rate='0.06',
                                                                         inputs={'blended_return': '0.09'})),
        # fourth revision (2026-10-31): D1 and L1
        ('D1: the refinance rate blank: 6.5% over the typed 30 years (before D1 the key offered no refinance)',
         K(refi_rate='')),
        ('D1: the refinance rate and years both blank, on a 7.25% mortgage: 6.5% over 30 years',
         K(mortgage_rate='0.0725', mortgage_payment=2100, refi_rate='', refi_years='')),
        ('D1: the refinance years blank with 5.5% typed: 30 years', K(refi_rate='0.055', refi_years='')),
        ('L1: a 700,000 mortgage under the $750,000 limit; the 100,000 line takes the debt to 800,000, so while the line '
         'runs the mortgage keeps only 750/800 of its deduction (R1 counts the line alone)',
         K(cost=100000, home_value=1200000, mortgage_balance=700000, mortgage_rate='0.05', mortgage_payment=4200,
           inputs={'usable_cash': 50000})),
        ("L1: married filing separately ($375,000); a 400,000 mortgage paid off in 60 months, inside the line's 120: its "
         "interest counts until it is paid",
         K(cost=60000, home_value=900000, mortgage_balance=400000, mortgage_rate='0.04',
           mortgage_payment=cents_str(pay_cents(40000000, 400, 60)), filing_status='married_separate')),
    ]


def random_ren_case(rng):
    cost = rng.randint(20, 1500) * 100
    if rng.randint(1, 5) == 1:
        cost += rng.randint(1, 99)
    case = {'cost': str(cost), 'recoup': dec_str(rng.randint(20, 120) if rng.randint(1, 20) > 1 else
                                                  rng.randint(121, 200), 2)}
    home = rng.randint(1, 100) > 8
    if home:
        value = rng.randint(80, 1500) * 1000
        case.update({'home': 'yes', 'home_value': str(value)})
        if rng.randint(1, 100) <= 18:
            case.update({'mortgage_balance': '', 'mortgage_rate': '', 'mortgage_payment': ''})
        else:
            bal = value * rng.randint(10, 97) // 100
            bps = 0 if rng.randint(1, 100) <= 2 else rng.randint(225, 799)
            n = rng.randint(36, 360)
            case.update({'mortgage_balance': str(bal), 'mortgage_rate': dec_str(bps, 4),
                         'mortgage_payment': cents_str(pay_cents(bal * 100, bps, n))})
        case.update({'refi_rate': dec_str(rng.randint(250, 900), 4), 'refi_years': str(rng.choice((10, 15, 20, 25, 30))),
                     'refi_cost_share': '' if rng.randint(1, 2) == 1 else dec_str(rng.randint(150, 600), 4)})
        case.update({'heloc_rate': '' if rng.randint(1, 2) == 1 else dec_str(rng.randint(500, 1100), 4),
                     'heloc_years': '' if rng.randint(1, 2) == 1 else str(rng.choice((5, 10, 15, 20)))})
    else:
        case.update({'home': 'no', 'home_value': '', 'mortgage_balance': '', 'mortgage_rate': '',
                     'mortgage_payment': '', 'refi_rate': '', 'refi_years': '', 'refi_cost_share': '',
                     'heloc_rate': '', 'heloc_years': ''})
    case.update({'loan_rate': '' if rng.randint(1, 2) == 1 else dec_str(rng.randint(600, 2400), 4),
                 'loan_years': '' if rng.randint(1, 2) == 1 else str(rng.randint(2, 7)),
                 'filing_status': 'married_separate' if rng.randint(1, 100) <= 15 else 'other'})
    inputs = {'usable_cash': str(rng.randint(0, 300) * 1000),
              'blended_return': '0' if rng.randint(1, 100) <= 12 else dec_str(rng.randint(100, 900), 4),
              'top_rate': rng.choice(('0.10', '0.12', '0.22', '0.24', '0.32', '0.35', '0.37')),
              'itemizes': 'yes' if rng.randint(1, 2) == 1 else 'no',
              'essential_monthly': str(rng.randint(15, 120) * 100)}
    return case, inputs


REN_COLUMNS = ['case_id', 'row_kind', *REN_INPUTS, *REN_CASE, *REN_KEYS, 'note']


def ren_csv_row(cid, kind, c, d, note):
    row = {'case_id': cid, 'row_kind': kind}
    for k in (*REN_INPUTS, *REN_CASE):
        row[k] = c[k]
    for k, t in REN_SPEC:
        row[k] = fmt(t, d[k])
    row['note'] = note
    return row


def ren_note(c, d, edge):
    bits = [edge] if edge else []
    if d['line_monthly'] is None:
        bits.append('no home: no line or refinance (C6)')
    else:
        if c['mortgage_balance'] == '':
            bits.append('no mortgage: no refinance (R3)')
        if not d['line_fits']:
            bits.append(f'line does not fit: borrowable {usd(d["borrowable"])}'
                        + (' (value x 85% is below the mortgage)' if d['borrowable'] == 0 else ''))
        if d['refi_above_fha_80']:
            bits.append(f'refinance at {rate6(d["refi_ltv_after"])} of value, above the 80% cash-out limit: does not fit (C4)')
        if d['line_law_share'] < 1:
            bits.append('debt over the acquisition-debt limit: only part of the interest saves tax (R1)')
        if d['alt_line_tax_saved_r1'] != d['line_tax_saved']:
            bits.append(f"L1: while the line runs the mortgage loses part of its deduction: the line saves "
                        f"{usd(d['line_tax_saved'])} of tax ({usd(d['alt_line_tax_saved_r1'])} by R1)")
        if d['refi_new_loan'] is not None and c['refi_rate'] == '':
            bits.append('refinance rate blank: 6.5% (D1)')
        if d['refi_new_loan'] is not None and c['refi_years'] == '':
            bits.append('refinance years blank: 30 (D1)')
        if d['refi_interest'] is not None and d['refi_interest'] < 0:
            bits.append('the refinance pays less interest than the old mortgage')
        if d['refi_tax_saved'] is not None and d['refi_tax_saved'] < 0:
            bits.append('the refinance saves less tax than the old mortgage would (tax saved below 0, R1)')
    if not d['cash_fits']:
        bits.append('cash does not fit')
    bits.append(f'ranking {d["ranking"]}')
    if d['alt_ranking_lowest_first'].split(';')[0] != d['best']:
        bits.append(f'best {d["best"]} by the $1 margin (R5); the lowest is {d["alt_ranking_lowest_first"].split(";")[0]}')
    if d['alt_ranking_line_r1'] != d['ranking']:
        bits.append(f"with R1's line figure the ranking would be {d['alt_ranking_line_r1']}")
    return join_note(bits)


def ren_stats(s, c, d):
    if d['line_monthly'] is None:
        s['no home'] += 1
    elif c['mortgage_balance'] == '':
        s['home, no mortgage'] += 1
    else:
        s['home with a mortgage'] += 1
        old = fr(c['mortgage_rate'])
        new = fr(c['refi_rate']) if c['refi_rate'] != '' else R.DEFAULT_REFI_RATE          # D1
        s['refi rate below the old rate' if new < old else ('refi rate equal to the old rate' if new == old
                                                            else 'refi rate above the old rate')] += 1
        s['mortgage rate 0'] += old == 0
    if d['line_monthly'] is not None:
        s['not enough equity (line does not fit)'] += not d['line_fits']
        s['line fits'] += bool(d['line_fits'])
        if d['refi_new_loan'] is not None:
            s['refi above FHA 80%'] += bool(d['refi_above_fha_80'])
            s['refi at or below 80%'] += not d['refi_above_fha_80']
        else:
            s['no refinance (no mortgage, R3)'] += 1
            s['R3 contrast: a refinance with no mortgage would fit'] += bool(d['alt_refi_no_mortgage_fits'])
            s['R3 contrast: the best would change'] += d['alt_ranking_refi_no_mortgage'].split(';')[0] != d['best']
        s['law share below 1 (line)'] += d['line_law_share'] < 1
        s['line law share below 1 and itemizes (R1 cuts the tax saved)'] += d['line_law_share'] < 1 and yes_2(c['itemizes'])
        s["line: L1 tax saved below R1's (the mortgage loses part of its deduction)"] += \
            d['line_tax_saved'] < d['alt_line_tax_saved_r1']
        s['line: L1 tax saved below 0'] += d['line_tax_saved'] < 0
        cut = d['line_tax_saved'] != d['alt_line_tax_saved_r1']
        lim = R.ACQ_DEBT_LIMIT['married_separate' if c['filing_status'] == 'married_separate' else 'other']
        s['L1: the mortgage alone at or under the limit, the line takes the debt over it'] += \
            cut and fr(c['mortgage_balance']) <= lim
        s["L1: the mortgage paid off inside the line's term while its share is cut"] += \
            cut and d['refi_old_months_left'] < d['line_months']
        s["best differs with R1's line figure (L1 against the contrast)"] += d['alt_ranking_line_r1'].split(';')[0] != d['best']
        s["ranking differs with R1's line figure (L1)"] += d['alt_ranking_line_r1'] != d['ranking']
        if d['refi_new_loan'] is not None:
            s['refinance rate blank (6.5%, D1)'] += c['refi_rate'] == ''
            s['refinance years blank (30, D1)'] += c['refi_years'] == ''
            s['D1 contrast: no refinance offered changes the ranking'] += \
                d['alt_ranking_blank_refi_not_offered'] != d['ranking']
        s['law share of the refinance below 1 / 1.03'] += d['refi_law_share'] is not None and d['refi_law_share'] < F(100, 103)
        s['refi does not fit (new loan above 80% of the value)'] += d['refi_fits'] is False
        s['borrowable 0 (value x 85% below the mortgage)'] += d['borrowable'] == 0
        s['extra interest negative'] += d['refi_interest'] is not None and d['refi_interest'] < 0
        s['refinance tax saved below 0 (R1)'] += d['refi_tax_saved'] is not None and d['refi_tax_saved'] < 0
        s['heloc rate blank (8%)'] += c['heloc_rate'] == ''
        s['refi cost share blank (3%)'] += c['refi_cost_share'] == ''
    s['not enough cash (cash does not fit)'] += not d['cash_fits']
    s['itemizes yes' if yes_2(c['itemizes']) else 'itemizes no'] += 1
    s['plan return 0'] += fr(c['blended_return']) == 0
    s['married filing separately (the $375,000 limit, R1)'] += c['filing_status'] == 'married_separate'
    s['loan rate blank (12%)'] += c['loan_rate'] == ''
    s[f'best {d["best"]}'] += 1
    s['cushion negative'] += d['cushion'] < 0
    s['best kept by the $1 margin (R5; the lowest is another way)'] += d['alt_ranking_lowest_first'].split(';')[0] != d['best']
    s['ranking differs from the plain lowest-first sort'] += d['alt_ranking_lowest_first'] != d['ranking']
    s['ranking after tax differs from before tax (R2)'] += d['alt_ranking_before_tax'] != d['ranking']
    s['best after tax differs from before tax (R2)'] += d['alt_ranking_before_tax'].split(';')[0] != d['best']


def build_ren(rng, guard):
    rows, stats = [], Counter()
    edges = ren_edges()
    cases = [('edge', note, ren_row(case, inputs)) for note, (case, inputs) in edges]
    for _ in range(RANDOM_DRAWS['ren']):         # the same draws as before; the first ones that fit are kept
        case, inputs = random_ren_case(rng)
        if len(cases) < N_REN:
            cases.append(('random', '', ren_row(case, inputs)))
    assert len(cases) == N_REN
    for i, (kind, note, c) in enumerate(cases, 1):
        cid = f'ren-{i:04d}'
        d1, d2 = ren_1(c), ren_2(c)
        compare_ren(guard, cid, d1, d2)
        rows.append(ren_csv_row(cid, kind, c, d1, ren_note(c, d1, note)))
        ren_stats(stats, c, d1)
        stats['half-cent amounts written (rounded up)'] += sum(half_cent(d1[k]) for k, t in REN_SPEC if t == 'm')
    return rows, stats, len(edges)


# ======================================== coverage ========================================

COVERAGE_VEH = {
    'rows with 1 car(s)': 600, 'rows with 2 car(s)': 400,
    **{f'period {y} years': 60 for y in range(1, 11)},
    'first car: no loan': 300, 'first car: loan paid off inside the period': 150,
    'first car: old loan outlasts the period (keep owes at the end)': 150, 'first car worth less than its loan': 150,
    'electric cars (any position)': 100, 'electric first car (new mpg blank: charged like the car, E1)': 40,
    'old loan rate 0': 20,
    'car loan paid off inside its 12-month year': 50,
    'new rate 0%': 100, 'new loan still owed at the end': 300, 'new loan paid off inside the period': 300,
    'period shorter than the lease': 150, 'period equal to the lease': 40, 'period longer than the lease': 600,
    'miles over the allowance': 400, 'miles under the allowance': 300, 'miles equal to the allowance': 40,
    'upkeep rise 0': 150, 'upkeep rise blank (10%)': 400, 'upkeep rise typed above 0': 400,
    'loss blank (12%)': 500, 'insurance share blank (1.25)': 500,
    'cheapest keep': 300, 'cheapest buy': 20, 'cheapest lease': 20,
    'lease: positive trade-in credited': 600, 'keep: what the old loan still owes taken off': 150,
    'cheapest differs under the all-rising contrast (A1)': 20,
    'buy: cash back (A7)': 4, 'buy: nothing financed and no cash back (exactly covered, A7)': 1,
    'cheapest kept by the $1 margin (A9; the lowest is another way)': 1,
    'new mpg blank on a petrol first car (32 mpg, D1)': 2, 'new maintenance blank ($500, D1)': 2,
    'every what-if field blank but the years (D1)': 1,
    "A3 contrast differs (a blank new mpg or upkeep kept the old car's)": 2,
    "E1 contrast differs (an electric first car's new car at 32 mpg)": 40, 'E1 contrast changes the cheapest': 1,
}
COVERAGE_PUR = {
    'no date': 60, 'date this month (October 2026)': 40, 'date next month (November 2026)': 40, 'date later': 900,
    'W2 differs from W1 (the contrast)': 100, 'W2 differs from W3': 20,
    'set aside more than the total': 80, 'set aside equal to the total': 20, 'cash return 0': 200,
    'spare 0': 150, 'save: spare enough (need 0)': 150, 'finance: spare enough (need 0)': 200,
    'save: goals give way': 400, 'finance: goals give way': 300, 'save: more than you have': 100,
    'finance: more than you have': 100,
    'finance level': 400, 'finance all_zero': 200, 'finance promo_then_rate': 400,
    'cash fits': 300, 'cash does not fit': 300,
    'cash fits but leaves less than the emergency target (P3 against the contrast)': 100,
    **{f'rows with {n} goal(s)': 100 for n in range(5)},
    **{f'three goals, priority order {"-".join(map(str, p))}': 8
       for p in ((1, 2, 3), (1, 3, 2), (2, 1, 3), (2, 3, 1), (3, 1, 2), (3, 2, 1))},
    'goals already done': 150, 'goals saving nothing': 150, 'goals never reached (blank months)': 40,
    'ways where two or more goals give way': 200, 'paused goals': 300, 'done goals skipped (P2), counted per way': 50,
    'ways where skipping a done goal changes who gives (P2)': 30,
    'ways where a same-priority goal due later gives first': 30,
    'spare below 0 (counted as 0, B5)': 3, 'ways where the literal spare would change the need (B5 contrast)': 4,
}
COVERAGE_REN = {
    'no home': 80, 'home, no mortgage': 150, 'home with a mortgage': 900,
    'refi rate below the old rate': 150, 'refi rate above the old rate': 400, 'mortgage rate 0': 10,
    'not enough equity (line does not fit)': 200, 'line fits': 400, 'not enough cash (cash does not fit)': 300,
    'itemizes yes': 500, 'itemizes no': 500, 'plan return 0': 100,
    'refi above FHA 80%': 200, 'refi at or below 80%': 400, 'law share below 1 (line)': 50,
    'law share of the refinance below 1 / 1.03': 50, 'married filing separately (the $375,000 limit, R1)': 100,
    'refi does not fit (new loan above 80% of the value)': 150, 'borrowable 0 (value x 85% below the mortgage)': 50,
    'extra interest negative': 30,
    'heloc rate blank (8%)': 300, 'refi cost share blank (3%)': 300, 'loan rate blank (12%)': 300,
    'best cash': 300, 'best line': 100, 'best refi': 100, 'best loan': 100, 'cushion negative': 200,
    'no refinance (no mortgage, R3)': 150, 'R3 contrast: a refinance with no mortgage would fit': 100,
    'R3 contrast: the best would change': 10, 'refinance tax saved below 0 (R1)': 50,
    'line law share below 1 and itemizes (R1 cuts the tax saved)': 50,
    "line: L1 tax saved below R1's (the mortgage loses part of its deduction)": 50, 'line: L1 tax saved below 0': 10,
    'L1: the mortgage alone at or under the limit, the line takes the debt over it': 1,
    "L1: the mortgage paid off inside the line's term while its share is cut": 1,
    "best differs with R1's line figure (L1 against the contrast)": 1, "ranking differs with R1's line figure (L1)": 1,
    'refinance rate blank (6.5%, D1)': 2, 'refinance years blank (30, D1)': 2,
    'D1 contrast: no refinance offered changes the ranking': 1,
    'best kept by the $1 margin (R5; the lowest is another way)': 1,
    'ranking after tax differs from before tax (R2)': 50, 'best after tax differs from before tax (R2)': 30,
}


def check_coverage(name, s, minimums):
    short = {k: (s.get(k, 0), v) for k, v in minimums.items() if s.get(k, 0) < v}
    if short:
        raise SystemExit(f'{name}: coverage short of the brief: {short}; no CSV written')
    return len(minimums)


# ======================================== run ========================================

def render_csv(columns, rows):
    """The CSV as text (a row with a field outside the columns raises here, before any file is written)."""
    fh = io.StringIO(newline='')
    w = csv.DictWriter(fh, fieldnames=columns, lineterminator='\n')
    w.writeheader()
    w.writerows(rows)
    return fh.getvalue()


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
    if not skip_examples:
        try:
            n_ex = check_examples()
        except AssertionError as e:
            line = traceback.extract_tb(e.__traceback__)[-1].lineno
            raise SystemExit(f'RULES.md examples check failed in derivation 2 at pg_key.py line {line}; no CSV written')
        print(f'RULES.md section 8 worked examples reproduced by derivation 2: {n_ex} assertions')
    rng = random.Random(SEED)
    g_veh, g_pur, g_ren = Guard('vehicles.csv'), Guard('purchases.csv'), Guard('renovations.csv')
    veh_rows, veh_s, n_veh_edge = build_veh(rng, g_veh, random.Random(SEED_FUEL))
    pur_rows, pur_s, n_pur_edge = build_pur(rng, g_pur)
    ren_rows, ren_s, n_ren_edge = build_ren(rng, g_ren)
    for rows, n in ((veh_rows, N_VEH), (pur_rows, N_PUR), (ren_rows, N_REN)):
        assert len(rows) == n and len({r['case_id'] for r in rows}) == n
    n_cov = 0
    for name, s, mins in (('vehicles.csv', veh_s, COVERAGE_VEH), ('purchases.csv', pur_s, COVERAGE_PUR),
                          ('renovations.csv', ren_s, COVERAGE_REN)):
        try:
            n_cov += check_coverage(name, s, mins)
        except SystemExit:
            for key in sorted(s):
                print(f'  {name} {key}: {s[key]}')
            raise
    files = (('vehicles.csv', VEH_COLUMNS, veh_rows, g_veh, veh_s, n_veh_edge),
             ('purchases.csv', PUR_COLUMNS, pur_rows, g_pur, pur_s, n_pur_edge),
             ('renovations.csv', REN_COLUMNS, ren_rows, g_ren, ren_s, n_ren_edge))
    texts = [(name, render_csv(cols, rows)) for name, cols, rows, *_ in files]   # all three rendered first
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    for name, text in texts:                                            # written only once all three have passed
        (out_dir / name).write_bytes(text.encode('utf-8'))
    for name, cols, rows, g, s, n_edge in files:
        print(f'wrote {name}: {len(rows)} rows ({n_edge} edge, {len(rows) - n_edge} random), {len(cols)} columns; '
              f'both derivations agree; largest gap before rounding {money(g.max_gap)} '
              f'(rates {float(g.max_rate_gap):.3g})')
        for key in sorted(g.n):
            print(f'  check: {key}: {g.n[key]}')
        for key in sorted(s):
            print(f'  {key}: {s[key]}')
    print(f'{n_cov} coverage minimums met')
    for name, *_ in files:
        print(f'  sha256 {name}: {hashlib.sha256((out_dir / name).read_bytes()).hexdigest()}')
    print(f'total {time.time() - t0:.1f} s')


if __name__ == '__main__':
    main(sys.argv[1:])
