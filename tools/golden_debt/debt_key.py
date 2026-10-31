"""Debt answer key: pay off debts (avalanche / snowball), credit cards, mortgage. Three CSVs of invented rows.

Run:  python3 tools/golden_debt/debt_key.py
Writes tests/golden/debt/payoff.csv (1,500 rows), cards.csv (1,000) and mortgage.csv (1,000). Standard library
only, exact arithmetic (fractions.Fraction), deterministic (random.Random(20261031)). The figures and the model
come from rules.py next to this file; the sources and the reasons are in tests/golden/debt/RULES.md and in
README.md here. Nothing under modules/, core/ or tests/*.test.mjs was opened, and the app is never imported.
(On 2026-10-31 a verifier who had read the pages to decide which side of each disagreement was wrong changed
the balance-transfer payment with no required payment set, and the tie-break wording; see RULES.md section 5.)

Model (the page READMEs, made exact by rules.py):
  * Interest each month = APR / 12 x the month's opening balance. The payment pays that interest first, then
    principal; the payment that clears a balance is exactly what is left. A part month counts as a month. A
    payment at or below the month's interest never pays the balance off ("never").
  * Pay off debts: budget = every required payment + extra, the same every month. Each month every open debt
    adds interest and gets its required payment (or what it owes, if less); the rest of the budget goes to the
    open debts in target order, each up to what it owes, in the same month. Avalanche = highest APR first,
    snowball = smallest starting balance first; the order is set once; the figures put a tie in input order
    (one valid choice: no source decides, and the payoff page breaks a tie by name). plus100 =
    avalanche with extra + 100. baseline = required payments only, nothing rolls over. baseline_rollover = the
    other reading: avalanche with extra 0, freed payments roll over.
  * Credit card minimum: the required payment if one is set, held level; otherwise max(2% x the month's
    opening balance, $25), recomputed every month (Regulation Z appendix M1 (b)(1) and M2's loop, re-read for
    this key). Balance transfer over P promo months at fee f: the old card's interest over the P months when
    paying max(required, B / P) every month (required = the payment set; with none set it is B / P, and the
    page's usual 2% / $25 minimum as a floor is written as a contrast); fee = B x f;
    saves = interest - fee; pay to clear = B (1 + f) / P.
  * Mortgage: months and interest at the payment, at payment + extra, every two weeks as payment x 13/12 each
    month (the page) and as 26 half payments a year with interest at rate / 26 per two weeks (contrast only);
    recast = the level payment that repays balance - lump over the whole months left at the payment (and the
    fractional-months reading, contrast); months until the balance is at or below 80% of home_value at
    payment + extra; months on the schedule at the payment (taken as the initial schedule) until the balance
    is at or below 80% and 78% of original_value (Homeowners Protection Act), and 80% at payment + extra.

Two tracks. The main track is exact (Fraction) and only written values are rounded, half up to the cent. A
second track rounds every month's interest and every computed payment to the cent, half up, as Regulation Z
appendix M2 does; its interest is written in the *_cents_track columns. Random rows are kept only when both
tracks give the same month counts.

Two derivations of every value, run on every row (kept or not) before anything is written:
  derivation 1  rules.py stepping month by month (Decimal, 60 significant digits): payoff_plan, baseline,
                card_payoff, balance_transfer, mortgage_compare, recast_payment, months_to_ltv, schedule.
  derivation 2  this file, exact Fractions, written separately: closed forms for every fixed payment
                (balance after k months = B g^k - P (g^k - 1) / r, the payoff month found exactly), the 2% / $25
                minimum as two closed-form phases (geometric while 2% is above $25, then a $25 annuity), and
                the debt plans jumped from one payoff to the next in closed form, with each payoff month worked
                by a separately written one-month rule.
  cents track   written from an integer-cents loop (schedule_ct, plan_ct), checked against a second exact loop
                written in the shape of appendix M2's SAS code (schedule_m2, plan_m2). rules.py's own
                round_cents=True track and rules.regz_m2_single are not used as the check, because they hold
                APR / 12 (or 1 + APR / 12) to 60 digits and so round some interest that is exactly on a half cent
                down. Instead each is reproduced exactly by the integer loop run with rules.py's 60-digit rate
                (dec_interest), and how far it is from the exact cents track is printed as information.
The script refuses to write any CSV if a month count differs or an amount differs by more than a cent between
the derivations, on either track. All three CSVs are worked first and written only if all three pass.
"""
import sys
sys.dont_write_bytecode = True  # before importing rules.py, so no __pycache__ lands in the repo

import csv
import math
import random
import time
from collections import Counter
from decimal import Decimal as D, localcontext
from fractions import Fraction as F
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import rules as R  # noqa: E402  (importing it runs rules.check_tables())

ROOT = HERE.parents[1]
OUT_DIR = ROOT / 'tests' / 'golden' / 'debt'
SEED = 20261031
N_PAYOFF, N_CARDS, N_MORTGAGE = 1500, 1000, 1000
ZERO, HALF = F(0), F(1, 2)
MARGIN = F(1)             # $1: last payment, room to spare in a payoff month, distance from an MI limit
CARD_MONTHS_CAP = 1200    # random card rows whose minimum-only payoff takes longer (100 years) are redrawn
TINY = F(1, 10 ** 20)     # derivation 1 (60 digits) vs derivation 2 (exact): "differs at all"

PCT, FLOOR = F(R.PAGE_MIN_PCT), F(R.PAGE_MIN_FLOOR)                    # page default 2%, $25 floor
CANCEL, TERMINATE = F(R.HPA_CANCEL_LTV), F(R.HPA_TERMINATE_LTV)        # 80%, 78% of the original value
BIWEEKLY = F(R.BIWEEKLY_PAYMENTS_PER_YEAR, 2 * R.MONTHS_PER_YEAR)      # 26 half payments / 12 months = 13/12
assert BIWEEKLY == R.BIWEEKLY_MONTHLY_FACTOR == F(13, 12)
TWELVE, TWENTYSIX = R.MONTHS_PER_YEAR, R.BIWEEKLY_PAYMENTS_PER_YEAR


# ======================================== small helpers ========================================

def fr(x):
    """str / int / Decimal / Fraction -> exact Fraction."""
    if isinstance(x, F):
        return x
    if isinstance(x, D):
        return F(x)
    return F(str(x))


def to_cents(x):
    """Exact value -> integer cents, half away from zero (rules.cents is Decimal ROUND_HALF_UP)."""
    x = fr(x)
    c = math.floor(abs(x) * 100 + HALF)
    return -c if x < 0 else c


def money(x):
    if x is None:
        return 'never'
    c = to_cents(x)
    sign = '-' if c < 0 else ''
    c = abs(c)
    return f'{sign}{c // 100}.{c % 100:02d}'


def months_str(n):
    return 'never' if n is None else str(n)


def rhu(x):
    """A non-negative exact amount in cents -> whole cents, half up (the cents track)."""
    return math.floor(x + HALF)


def whole_cents(x):
    c = fr(x) * 100
    assert c.denominator == 1, x
    return int(c)


def dec_str(x, places):
    """An exact value with at most `places` decimals, written with exactly `places` decimals."""
    x = fr(x)
    q = x * 10 ** places
    assert q.denominator == 1, (x, places)
    q = int(q)
    sign = '-' if q < 0 else ''
    q = abs(q)
    return f'{sign}{q // 10 ** places}.{q % 10 ** places:0{places}d}'


def half_cent(x):
    return x is not None and (fr(x) * 100).denominator == 2


class Guard:
    """Compares derivation 1 with derivation 2; any month count that differs, or any amount more than a cent
    apart, stops the run before a CSV is written."""

    def __init__(self, name):
        self.name = name
        self.n = Counter()
        self.max_gap = ZERO
        self.rules_ct_gap = 0      # largest cents gap, rules.py's cents track vs the exact cents track
        self.rules_ct_rows = set()

    def _stop(self, where, a, b):
        raise SystemExit(f'{self.name} {where}: derivation 1 gives {a}, derivation 2 gives {b}; no CSV written')

    def months(self, where, a, b):
        self.n['month counts compared'] += 1
        if a != b:
            self._stop(where, a, b)

    def money(self, where, a, b, track='exact'):
        self.n[f'amounts compared ({track} track)'] += 1
        if (a is None) != (b is None):
            self._stop(where, a, b)
        if a is None:
            return
        fa, fb = fr(a), fr(b)
        if abs(to_cents(fa) - to_cents(fb)) > 1:
            self._stop(where, float(fa), float(fb))
        gap = abs(fa - fb)
        if track == 'exact':
            self.max_gap = max(self.max_gap, gap)
            self.n['exact-track amounts that differ by more than 1e-20 before rounding'] += gap > TINY
        else:
            self.n['cents-track amounts that differ at all'] += gap != 0

    def rules_cents(self, where, row, a, b):
        """Information only: rules.py's round_cents track against the exact cents track that is written."""
        if a is None or b is None:
            return
        gap = abs(to_cents(a) - to_cents(b))
        self.n['information: rules.py cents-track amounts compared with the written cents track'] += 1
        if gap:
            self.n['information: rules.py cents-track amounts that differ from the written cents track'] += 1
            self.rules_ct_rows.add(row)
            self.rules_ct_gap = max(self.rules_ct_gap, gap)


# ======================= derivation 2: one balance at a fixed payment, closed form =======================

def bal_after(B, r, P, k):
    """Balance after k payments of P (none of them the last): B g^k - P (g^k - 1) / r, g = 1 + r."""
    if r == 0:
        return B - P * k
    gk = (1 + r) ** k
    return B * gk - P * (gk - 1) / r


def first_true(pred, guess):
    """Smallest k >= 0 with pred(k), for a pred that is False up to some k and True from there on.
    Starts at `guess` (a float estimate), then gallops and bisects; every test is exact."""
    k = max(0, int(guess))
    if pred(k):
        hi, step = k, 1
        lo = hi - step
        while lo >= 0 and pred(lo):
            hi, step = lo, step * 2
            lo = hi - step
        lo = max(lo, -1)
    else:
        lo, step = k, 1
        hi = lo + step
        while not pred(hi):
            lo, step = hi, step * 2
            hi = lo + step
    while hi - lo > 1:
        mid = (lo + hi) // 2
        if pred(mid):
            hi = mid
        else:
            lo = mid
    return hi


def payoff_month(B, r, P):
    """Month whose payment clears B at a fixed payment P (the first N with balance_{N-1} x g <= P), 0 if B is
    already 0, None for never (P at or below the first month's interest)."""
    if B <= 0:
        return 0
    if r == 0:
        return math.ceil(B / P) if P > 0 else None
    if P <= r * B:
        return None
    g = 1 + r
    K = P / r
    x = (K - P / g) / (K - B)            # g^k >= x  <=>  balance_k x g <= P
    guess = 0 if x <= 1 else math.log(float(x)) / math.log1p(float(r))
    return first_true(lambda k: bal_after(B, r, P, k) * g <= P, math.floor(guess)) + 1


def fixed_payoff(B, r, P):
    """Fixed-payment payoff: months, interest, paid, the last payment and the room left in it, or None."""
    n = payoff_month(B, r, P)
    if n is None:
        return None
    if n == 0:
        return {'months': 0, 'interest': ZERO, 'paid': ZERO, 'last': None, 'slack': None}
    last = bal_after(B, r, P, n - 1) * (1 + r)
    paid = (n - 1) * P + last
    return {'months': n, 'interest': paid - B, 'paid': paid, 'last': last, 'slack': P - last}


def window(B, r, P, months):
    """Interest and payments over at most `months` months at a fixed payment (balance transfer)."""
    full = fixed_payoff(B, r, P)
    if full is None:
        raise ValueError('window: payment below interest')
    if full['months'] <= months:
        return dict(full, left=ZERO, paid_off=True)
    left = bal_after(B, r, P, months)
    return {'months': months, 'interest': months * P - (B - left), 'paid': months * P, 'left': left,
            'paid_off': False, 'last': None, 'slack': None}


def months_to_target(B, r, P, T):
    """First k >= 0 whose closing balance is at or below T (0 if B already is), with the balances either side."""
    if B <= T:
        return {'k': 0, 'after': B, 'before': None}
    n = payoff_month(B, r, P)
    if n is None:
        return None
    if r == 0:
        guess = (B - T) / P
    else:
        K = P / r
        guess = math.log(float((K - T) / (K - B))) / math.log1p(float(r))   # K - (K - B) g^k <= T
    bal = lambda k: ZERO if k >= n else bal_after(B, r, P, k)              # noqa: E731
    k = first_true(lambda k: bal(k) <= T, math.floor(float(guess)))
    return {'k': k, 'after': bal(k), 'before': bal(k - 1)}


def level_payment_2(B, r, n):
    """The level payment that repays B in n months: B r g^n / (g^n - 1)."""
    if B <= 0:
        return ZERO
    if r == 0:
        return B / n
    gn = (1 + r) ** n
    return B * r * gn / (gn - 1)


# ================== derivation 2: the 2% / $25 minimum, recomputed monthly, in closed form ==================

def card_minimum_2(B, r):
    """Minimum-only payoff with max(2% x opening balance, $25) every month.

    Phase 1, while the opening balance is at least $25 / 2% = $1,250: the payment is 2% of it, so each month
    the balance is multiplied by f = 1 + r - 2% (geometric). Phase 2, below $1,250: $25 a month (an annuity).
    The balance only falls once the first month falls, so "never" is decided by the first month."""
    first = max(PCT * B, FLOOR)
    if first >= B * (1 + r):
        return {'months': 1, 'interest': B * r, 'paid': B * (1 + r), 'last': B * (1 + r),
                'slack': first - B * (1 + r), 'first': B * (1 + r), 'phase1': 0}
    if first <= r * B:
        return None
    thr = FLOOR / PCT
    f = 1 + r - PCT
    k1 = 0
    if B >= thr:
        k1 = first_true(lambda j: B * f ** j < thr,
                        math.floor(math.log(float(B / thr)) / -math.log(float(f))))
    fk = f ** k1
    i1 = r * B * (1 - fk) / (1 - f) if k1 else ZERO
    p1 = PCT * B * (1 - fk) / (1 - f) if k1 else ZERO
    tail = fixed_payoff(B * fk, r, FLOOR)
    return {'months': k1 + tail['months'], 'interest': i1 + tail['interest'], 'paid': p1 + tail['paid'],
            'last': tail['last'], 'slack': tail['slack'], 'first': first, 'phase1': k1}


# ============================ derivation 2: debt plans, payoff to payoff ============================

def target_order(debts, method):
    idx = range(len(debts))
    if method == 'avalanche':
        return sorted(idx, key=lambda i: (-debts[i]['apr'], i))
    return sorted(idx, key=lambda i: (debts[i]['B'], i))


def plan_2(debts, method, extra, rollover=True):
    """Exact plan. Between payoffs every open debt pays a fixed amount (non-targets their required payment,
    the target the rest of the budget), so each phase is jumped in closed form to the first month in which
    some debt's own payment clears it; that month is worked by the one-month rule below."""
    n = len(debts)
    B = [d['B'] for d in debts]
    r = [d['apr'] / TWELVE for d in debts]
    q = [d['req'] for d in debts]
    order = target_order(debts, method)
    if not rollover:
        each = [fixed_payoff(B[i], r[i], q[i]) for i in range(n)]
        if any(e is None for e in each):
            return {'months': None, 'order': order}
        return {'months': max(e['months'] for e in each), 'interest': sum((e['interest'] for e in each), ZERO),
                'paid': sum((e['paid'] for e in each), ZERO), 'payoff': [e['months'] for e in each],
                'ends': [(i, e['last'], e['slack']) for i, e in enumerate(each)], 'events': [], 'order': order}
    budget = sum(q, ZERO) + extra
    bal, payoff = list(B), [None] * n
    month, interest, paid = 0, ZERO, ZERO
    ends, events = [], []
    while True:
        open_ = [i for i in order if bal[i] > 0]
        if not open_:
            break
        t = open_[0]
        plain = {i: q[i] for i in open_}
        plain[t] = budget - sum((q[i] for i in open_[1:]), ZERO)
        ks = [k for k in (payoff_month(bal[i], r[i], plain[i]) for i in open_) if k is not None]
        if not ks:
            return {'months': None, 'order': order}
        k = min(ks)
        for i in open_:                            # k - 1 ordinary months, in closed form
            nb = bal_after(bal[i], r[i], plain[i], k - 1)
            interest += (k - 1) * plain[i] - (bal[i] - nb)
            paid += (k - 1) * plain[i]
            bal[i] = nb
        month += k
        done, info = payoff_month_rule(bal, r, q, open_, budget)
        interest += info['interest']
        paid += info['paid']
        for i, last, room in done:
            payoff[i] = month
            ends.append((i, last, room))
        events.append({'month': month, 'done': [i for i, _, _ in done], 'rolled': info['rolled'],
                       'target': t, 'step2': info['step2']})
    return {'months': month, 'interest': interest, 'paid': paid, 'payoff': payoff, 'ends': ends,
            'events': events, 'order': order}


def payoff_month_rule(bal, r, q, open_, budget):
    """One month of a plan, written separately from rules.payoff_plan: interest on every open debt, every
    open debt its required payment or what it owes, then the rest of the budget down the target order. Changes
    bal in place. Returns the debts it finished as (debt, last payment, room to spare: what the debt could still
    have absorbed this month beyond what it owed)."""
    due = {i: bal[i] * (1 + r[i]) for i in open_}
    interest = sum((bal[i] * r[i] for i in open_), ZERO)
    give = {i: min(q[i], due[i]) for i in open_}
    left = budget - sum(give.values(), ZERO)
    room, step2 = {}, [i for i in open_ if give[i] == due[i]]
    rolled = False
    for i in open_:
        # cleared by its own required payment with q - due to spare, or by the money still unspent at its turn
        room[i] = max(q[i], give[i] + left) - due[i]
        x = min(left, due[i] - give[i])
        if x > 0 and i != open_[0]:
            rolled = True                          # money passed down the order to a debt that is not the target
        give[i] += x
        left -= x
    done = []
    for i in open_:
        bal[i] = due[i] - give[i]
        if bal[i] == 0:
            done.append((i, due[i], room[i]))
    return done, {'interest': interest, 'paid': sum(give.values(), ZERO), 'rolled': rolled, 'step2': step2}


# ===================== derivation 2, cents track: integer cents, written separately =====================

def schedule_ct(B, r, pay_c, stop_after=None, target=None, cap=R.MAX_MONTHS, interest_c=None):
    """One balance in whole cents: interest = cents(balance x r), payment = cents(pay_c(opening cents)).
    Returns months (None for never), interest, paid (dollars) and the first month at or below target.
    interest_c replaces the exact interest (only to reproduce rules.py's 60-digit rate, see dec_interest)."""
    interest_c = interest_c or (lambda b: rhu(b * r))
    b = whole_cents(B)
    tc = None if target is None else fr(target) * 100
    m, interest, paid = 0, 0, 0
    tmonth = 0 if tc is not None and b <= tc else None
    while b > 0:
        if stop_after is not None and m >= stop_after:
            break
        m += 1
        if m > cap:
            raise RuntimeError('cents track still open')
        i = interest_c(b)
        due = b + i
        p = rhu(fr(pay_c(b)))
        if p >= due:
            p, nb = due, 0
        elif p <= i:
            return {'months': None, 'interest': None, 'paid': None, 'target_month': None}
        else:
            nb = due - p
        interest += i
        paid += p
        b = nb
        if tc is not None and tmonth is None and b <= tc:
            tmonth = m
    return {'months': m, 'interest': F(interest, 100), 'paid': F(paid, 100), 'target_month': tmonth,
            'left': F(b, 100)}


def plan_ct(debts, method, extra, rollover=True, cap=R.MAX_MONTHS, interest_c=None):
    """A plan in whole cents (interest rounded each month). Never: in some month no open debt's ordinary
    payment beats its interest, so no balance can fall again. interest_c: per-debt replacements for the exact
    interest (only to reproduce rules.py's 60-digit rate)."""
    n = len(debts)
    bal = [whole_cents(d['B']) for d in debts]
    r = [d['apr'] / TWELVE for d in debts]
    ifn = interest_c or [(lambda b, _r=x: rhu(b * _r)) for x in r]
    q = [whole_cents(d['req']) for d in debts]
    budget = sum(q) + whole_cents(extra)
    order = target_order(debts, method)
    payoff = [None] * n
    m = interest = paid = 0
    while any(b > 0 for b in bal):
        open_ = [i for i in order if bal[i] > 0]
        its = {i: ifn[i](bal[i]) for i in open_}
        if rollover:
            plain = {i: q[i] for i in open_}
            plain[open_[0]] = budget - sum(q[i] for i in open_[1:])
            if all(plain[i] <= its[i] for i in open_):
                return {'months': None}
        elif any(q[i] <= its[i] for i in open_):
            return {'months': None}
        m += 1
        if m > cap:
            raise RuntimeError('plan still open')
        due = {i: bal[i] + its[i] for i in open_}
        interest += sum(its.values())
        pay = {i: min(q[i], due[i]) for i in open_}
        left = budget - sum(pay.values())
        if rollover:
            for i in open_:
                x = min(left, due[i] - pay[i])
                pay[i] += x
                left -= x
        for i in open_:
            paid += pay[i]
            bal[i] = due[i] - pay[i]
            if bal[i] == 0:
                payoff[i] = m
    return {'months': m, 'interest': F(interest, 100), 'paid': F(paid, 100), 'payoff': payoff}


def rnd(x):
    """Exact non-negative dollars -> dollars rounded half up to the cent."""
    return F(math.floor(fr(x) * 100 + HALF), 100)


def schedule_m2(B, r, pay, stop_after=None, target=None, cap=R.MAX_MONTHS):
    """Second cents-track loop, shaped like Regulation Z appendix M2's SAS code but exact (Fraction dollars,
    round = half up): pmt = round(pay(tbal)); xxxbal = round(cbal x (1 + perrate)); fc = xxxbal - tbal; if pmt
    is above tbal + fc it becomes xxxbal (the final payment); cbal = xxxbal - pmt."""
    tbal, month, sumpmts, fcs = fr(B), 0, ZERO, ZERO
    hit = 0 if target is not None and tbal <= target else None
    while tbal > 0:
        if stop_after is not None and month >= stop_after:
            break
        month += 1
        if month > cap:
            raise RuntimeError('M2-shaped loop still open')
        pmt = rnd(pay(tbal))
        xxxbal = rnd(tbal * (1 + r))
        fc = xxxbal - tbal
        if pmt > tbal + fc:
            pmt = xxxbal
        elif pmt <= fc:
            return {'months': None, 'interest': None, 'paid': None, 'target_month': None}
        tbal = xxxbal - pmt
        sumpmts += pmt
        fcs += fc
        if hit is None and target is not None and tbal <= target:
            hit = month
    return {'months': month, 'interest': fcs, 'paid': sumpmts, 'target_month': hit}


def plan_m2(debts, method, extra, rollover=True, cap=R.MAX_MONTHS):
    """Second cents-track plan loop (exact Fraction dollars, M2-shaped: xxxbal = round(balance x (1 + r)) per
    debt). Never is decided as RULES.md section 2 words it: no non-target debt's required payment beats its
    interest and the target's payment does not beat its own."""
    n = len(debts)
    order = target_order(debts, method)
    cbal = [d['B'] for d in debts]
    rate = [d['apr'] / TWELVE for d in debts]
    q = [d['req'] for d in debts]
    budget = sum(q, ZERO) + extra
    month, fcs, paid, when = 0, ZERO, ZERO, [None] * n
    while True:
        live = [i for i in order if cbal[i] > 0]
        if not live:
            break
        xxx = {i: rnd(cbal[i] * (1 + rate[i])) for i in live}
        fc = {i: xxx[i] - cbal[i] for i in live}
        if rollover:
            t, rest = live[0], live[1:]
            if not any(q[i] > fc[i] for i in rest) and budget - sum((q[i] for i in rest), ZERO) <= fc[t]:
                return {'months': None}
        elif any(q[i] <= fc[i] for i in live):
            return {'months': None}
        month += 1
        if month > cap:
            raise RuntimeError('M2-shaped plan still open')
        pmt = {i: min(q[i], xxx[i]) for i in live}
        spend = budget - sum(pmt.values(), ZERO)
        for i in (live if rollover else ()):
            more = min(spend, xxx[i] - pmt[i])
            pmt[i] += more
            spend -= more
        for i in live:
            cbal[i] = xxx[i] - pmt[i]
            fcs += fc[i]
            paid += pmt[i]
            if cbal[i] == 0:
                when[i] = month
    return {'months': month, 'interest': fcs, 'paid': paid, 'payoff': when}


def dec_interest(apr_s, form='rate'):
    """rules.py's own cents-track interest for whole-cent balances, used only to reproduce rules.py's cents
    tracks exactly. form='rate': cents(balance x (APR / 12)), as rules.schedule / payoff_plan / card_payoff /
    balance_transfer do with round_cents=True; form='one_plus': cents(balance x (1 + APR / 12)) - balance, as
    rules.regz_m2_single does. Both hold the rate to 60 significant digits, so when the exact interest is on a
    half cent and APR / 12 does not end in decimal the product can fall a hair short and round down (README,
    open point 2). With these the key's integer loop gives rules.py's numbers to the cent."""
    rd = R.monthly_rate(D(apr_s))
    if form == 'rate':
        return lambda b: whole_cents(R._interest(D(b) / 100, rd, True))
    with localcontext(R.CTX):
        one_plus = 1 + rd

    def m2(b):
        with localcontext(R.CTX):
            x = D(b) / 100 * one_plus
        return whole_cents(R.cents(x)) - b
    return m2


# =========================================== checks against RULES.md ===========================================

def check_examples():
    """RULES.md's worked examples, with derivation 2 (exact) and the cents track."""
    ex = [debt('500', '0.24', '40'), debt('300', '0.12', '30')]
    av, sn = plan_2(ex, 'avalanche', F(130)), plan_2(ex, 'snowball', F(130))
    assert (av['months'], av['payoff'], money(av['interest'])) == (5, [4, 5], '31.22'), av
    assert av['interest'] == F('31.22101193')
    assert (sn['months'], sn['payoff'], money(sn['interest'])) == (5, [5, 2], '37.69'), sn
    assert sn['interest'] == F('37.69178664')
    assert money(plan_ct(ex, 'avalanche', F(130))['interest']) == '31.23'
    assert money(plan_ct(ex, 'snowball', F(130))['interest']) == '37.70'
    p_a, p_s = plan_2(ex, 'avalanche', F(230)), plan_2(ex, 'snowball', F(230))
    assert (p_a['months'], money(p_a['interest']), p_s['months'], money(p_s['interest'])) == (3, '22.74', 3, '27.29')
    base = plan_2(ex, 'avalanche', ZERO, rollover=False)
    assert (base['months'], base['payoff'], money(base['interest'])) == (15, [15, 11], '98.89'), base
    r0 = plan_2(ex, 'avalanche', ZERO)
    assert (r0['months'], money(r0['interest'])) == (13, '96.19'), r0
    # Example 2: cards
    c = card_minimum_2(F(3000), F('0.18') / 12)
    assert (c['months'], money(c['interest']), money(c['last'])) == (268, '6327.77', '19.14'), c
    ct = schedule_ct(F(3000), F('0.18') / 12, lambda b: max(rhu(PCT * b), 2500))
    assert (ct['months'], money(ct['interest'])) == (268, '6327.65')
    held = fixed_payoff(F(3000), F('0.18') / 12, F(60))
    assert (held['months'], money(held['interest'])) == (94, '2586.71')
    assert card_minimum_2(F(2000), F('0.30') / 12) is None
    c9 = card_minimum_2(F(900), F('0.30') / 12)
    assert (c9['months'], money(c9['interest'])) == (94, '1431.31')
    bt = window(F(3000), F('0.24') / 12, max(F(75), F(3000) / 12), 12)
    assert money(bt['interest']) == '451.70' and money(bt['interest'] - 90) == '361.70'
    assert F(3000) * (1 + F('0.03')) / 12 == F('257.50')
    # Example 3: mortgage
    r = F('0.06') / 12
    assert (lambda x: (x['months'], money(x['interest'])))(fixed_payoff(F(200000), r, F(1250))) == (323, '203365.21')
    assert (lambda x: (x['months'], money(x['interest'])))(fixed_payoff(F(200000), r, F(1450))) == (235, '140169.13')
    bw = fixed_payoff(F(200000), r, F(1250) * BIWEEKLY)
    assert (bw['months'], money(bw['interest'])) == (269, '164142.23')
    assert money(schedule_ct(F(200000), r, lambda b: 125000)['interest']) == '203365.35'
    assert money(schedule_ct(F(200000), r, lambda b: F(1250) * BIWEEKLY * 100)['interest']) == '164141.12'
    assert money(level_payment_2(F(180000), r, 323)) == '1124.57'
    assert months_to_target(F(200000), r, F(1450), F(192000))['k'] == 18
    assert money(level_payment_2(F(216000), r, 360)) == '1295.03'
    assert months_to_target(F(216000), r, F('1295.03'), CANCEL * 240000)['k'] == 89
    assert months_to_target(F(216000), r, F('1295.03'), TERMINATE * 240000)['k'] == 103


# ================================================ pay off debts ================================================

VARIANTS = (  # column prefix, target order, extra, rollover
    ('avalanche', 'avalanche', 'extra', True),
    ('snowball', 'snowball', 'extra', True),
    ('plus100', 'avalanche', 'extra+100', True),
    ('baseline', 'avalanche', 'none', False),
    ('baseline_rollover', 'avalanche', 'zero', True),
)
PAYOFF_COLUMNS = ['case_id', 'label', 'n_debts', 'debts', 'extra']
for _v in VARIANTS:
    PAYOFF_COLUMNS += [f'{_v[0]}_months', f'{_v[0]}_interest', f'{_v[0]}_paid', f'{_v[0]}_payoff_months',
                       f'{_v[0]}_interest_cents_track']
PAYOFF_COLUMNS.append('note')


def debt(b, a, q):
    return {'B': fr(b), 'apr': fr(a), 'req': fr(q),
            's': f'{dec_str(b, 2)}:{dec_str(a, 4)}:{dec_str(q, 2)}'}


def variant_extra(rule, extra):
    return {'extra': extra, 'extra+100': extra + 100, 'none': ZERO, 'zero': ZERO}[rule]


def plan_1(c, method, extra, rollover, round_cents=False, dynamic=False):
    """Derivation 1: rules.py."""
    ds = [{'name': str(i), 'balance': D(d['s'].split(':')[0]), 'apr': D(d['s'].split(':')[1]),
           'required': D(d['s'].split(':')[2])} for i, d in enumerate(c['debts'])]
    if rollover:
        res = R.payoff_plan(ds, method, D(dec_str(extra, 2)), round_cents=round_cents, dynamic_order=dynamic)
    else:
        res = R.baseline(ds, round_cents=round_cents)
    return {'months': res['months'], 'interest': res['interest'], 'paid': res['paid'],
            'payoff': res['payoff_month'], 'order': res['order']}


def work_payoff(c, guard, where):
    """Both derivations on both tracks for every variant; returns the results and the robustness issues."""
    out, issues = {}, []
    for name, method, xrule, roll in VARIANTS:
        x = variant_extra(xrule, c['extra'])
        w = f'{where} {name}'
        # exact track: rules.py (derivation 1) against payoff-to-payoff closed forms (derivation 2)
        two, one = plan_2(c['debts'], method, x, roll), plan_1(c, method, x, roll)
        if roll:
            guard.months(w + ' target order', one['order'], two['order'])
        guard.months(w + ' months', one['months'], two['months'])
        if two['months'] is not None:
            guard.months(w + ' payoff months', one['payoff'], two['payoff'])
            guard.money(w + ' interest', one['interest'], two['interest'])
            guard.money(w + ' paid', one['paid'], two['paid'])
            assert two['paid'] == sum((d['B'] for d in c['debts']), ZERO) + two['interest']
        # cents track: integer cents (written) against the M2-shaped exact loop
        two_c, alt_c = plan_ct(c['debts'], method, x, roll), plan_m2(c['debts'], method, x, roll)
        guard.months(w + ' cents-track months', alt_c['months'], two_c['months'])
        if two_c['months'] is not None:
            guard.months(w + ' cents-track payoff months', alt_c['payoff'], two_c['payoff'])
            guard.money(w + ' cents-track interest', alt_c['interest'], two_c['interest'], 'cents')
            guard.money(w + ' cents-track paid', alt_c['paid'], two_c['paid'], 'cents')
        # rules.py's own cents track: reproduced exactly with its 60-digit rate; compared with the exact one
        one_c = plan_1(c, method, x, roll, round_cents=True)
        emu = plan_ct(c['debts'], method, x, roll, interest_c=[dec_interest(dd['s'].split(':')[1]) for dd in c['debts']])
        guard.months(w + ' rules.py cents track (60-digit rate) months', one_c['months'], emu['months'])
        if emu['months'] is not None:
            guard.months(w + ' rules.py cents track (60-digit rate) payoff', one_c['payoff'], emu['payoff'])
            if fr(one_c['interest']) != emu['interest']:
                guard._stop(w + ' rules.py cents track (60-digit rate) interest', one_c['interest'], emu['interest'])
        guard.rules_cents(w, where, one_c['interest'], two_c['interest'] if two_c['months'] is not None else None)
        out[name] = {'exact': two, 'cents': two_c}
        # robustness: the two tracks agree on every month, and no payoff sits within $1 of a month boundary
        if two['months'] != two_c['months'] or (two['months'] is not None and two['payoff'] != two_c['payoff']):
            issues.append(f'{name}: cents track gives {months_str(two_c["months"])} months'
                          + (f' (payoffs {"|".join(map(str, two_c["payoff"]))})' if two_c['months'] else ''))
        if two['months'] is not None:
            for i, last, room in two['ends']:
                if last is not None and last < MARGIN:
                    issues.append(f'{name}: debt {i + 1} last payment {money(last)}')
                if room is not None and room < MARGIN:
                    issues.append(f'{name}: debt {i + 1} cleared with {money(room)} to spare')
    sn = out['snowball']['exact']
    if sn['months'] is not None:
        dyn = plan_1(c, 'snowball', c['extra'], True, dynamic=True)
        if dyn['months'] != sn['months'] or dyn['payoff'] != sn['payoff'] or \
                abs(to_cents(dyn['interest']) - to_cents(sn['interest'])) > 1:
            issues.append(f'snowball re-sorted every month: {dyn["months"]} months, payoffs '
                          f'{"|".join(map(str, dyn["payoff"]))}, interest {money(dyn["interest"])}')
    return out, issues


PAYOFF_EDGES = [
    # (label, [(balance, apr, required), ...], extra)
    ('RULES.md example 1 (avalanche pays the store card off in month 4 and rolls the rest the same month)',
     [('500', '0.24', '40'), ('300', '0.12', '30')], '130'),
    ('one debt (rules.py self-check: same as one balance at 150 a month)', [('4321.50', '0.1899', '95')], '55'),
    ('one debt at 0%, balance an exact multiple of the payment (last payment is a full one)',
     [('2500', '0', '100')], '25'),
    ('one debt at 0%', [('1999.99', '0', '40')], '15'),
    ('one debt, required payment exactly covers the interest (never without extra; plus100 finishes)',
     [('12000', '0.12', '120')], '0'),
    ('target payment exactly covers its interest until the other debt is paid (baseline never)',
     [('6000', '0.18', '90'), ('2000', '0.10', '60')], '0'),
    ('every payment exactly covers its interest (never; plus100 finishes)',
     [('6000', '0.18', '90'), ('12000', '0.06', '60')], '0'),
    ('a debt paid off in the first month, the rest rolling to the next debt the same month',
     [('150', '0.20', '150'), ('3000', '0.15', '90')], '100'),
    ('required payment above what a debt owes: paid off in month 1 by its own payment, the unused part rolls on',
     [('400', '0.05', '500'), ('8000', '0.22', '200')], '50'),
    ('two debts paid off in month 1 (rollover cascades down the order)',
     [('300', '0.10', '50'), ('320', '0.11', '40'), ('10000', '0.05', '120')], '600'),
    ('equal rates (avalanche tie, larger balance entered first: input order kept)',
     [('5000', '0.1999', '150'), ('2000', '0.1999', '80'), ('1000', '0.05', '40')], '100'),
    ('equal rates (avalanche tie, smaller balance entered first: input order kept)',
     [('2000', '0.1999', '80'), ('5000', '0.1999', '150'), ('1000', '0.05', '40')], '100'),
    ('equal balances (snowball tie, higher rate entered first: input order kept)',
     [('3000', '0.24', '100'), ('3000', '0.08', '90'), ('7000', '0.15', '200')], '150'),
    ('equal balances (snowball tie, lower rate entered first: input order kept)',
     [('3000', '0.08', '90'), ('3000', '0.24', '100'), ('7000', '0.15', '200')], '150'),
    ('equal rates: two 0% debts (avalanche tie)',
     [('1200', '0', '60'), ('800', '0', '40'), ('5000', '0.12', '100')], '50'),
    ('total owed rises at first (month-1 interest 430 > budget 400), yet the plan finishes; baseline never',
     [('10000', '0.30', '300'), ('60000', '0.036', '100')], '0'),
    ('stuck plan: never for avalanche and snowball, plus100 finishes (rules.py self-check)',
     [('5000', '0', '100'), ('10000', '0.30', '100')], '50'),
    ('the same stuck debts rescued by a larger extra', [('5000', '0', '100'), ('10000', '0.30', '100')], '200'),
    ('the target grows until the other debt is paid off, then finishes; baseline never',
     [('1500', '0.24', '300'), ('9000', '0.36', '150')], '0'),
    ('snowball order would change if re-sorted every month (the key keeps the starting order; see note)',
     [('1000', '0.10', '20'), ('1100', '0.30', '300')], '100'),
    ('five debts', [('250.75', '0.2999', '25'), ('1800', '0.1749', '54'), ('4200', '0.0699', '105'),
                    ('9600', '0.2249', '288'), ('23000', '0.0425', '330')], '400'),
    ('five debts with a 0% debt', [('600', '0', '25'), ('1450.10', '0.2699', '58'), ('3333.33', '0.1299', '80'),
                                   ('8000', '0.0899', '160'), ('15000', '0.3599', '600')], '250'),
    ('largest balances, extra $2,000', [('60000', '0.0799', '900'), ('45000', '0.1299', '1050'),
                                        ('30000', '0.2099', '900')], '2000'),
    ('smallest balance $100 at 36%, a $60,000 debt at 0.01%, no extra',
     [('100', '0.36', '4'), ('60000', '0.0001', '601'), ('5000', '0.18', '200')], '0'),
    ('required payment equal to the balance (two months)', [('800', '0.15', '800'), ('2500', '0.20', '75')], '0'),
    ('the highest rate is also the smallest balance (avalanche and snowball agree)',
     [('700', '0.29', '35'), ('4000', '0.09', '80')], '120'),
    ('rates 0.01% and 0.02% apart by 0.0001', [('3000', '0.0001', '31'), ('2000', '0.0002', '21')], '5'),
    ('a non-target debt finishes first and its payment rolls to the target',
     [('9000', '0.2499', '300'), ('1200', '0.0599', '400'), ('4000', '0.1099', '120')], '75'),
]


def payoff_case(debts, extra, label):
    return {'debts': [debt(*d) for d in debts], 'extra': fr(extra), 'label': label}


def log_money(rng, lo, hi):
    """Log-uniform between lo and hi: cents (70%), whole hundreds (20%), whole dollars (10%)."""
    x = math.exp(rng.uniform(math.log(lo), math.log(hi)))
    u = rng.random()
    if u < 0.7:
        v = F(round(x * 100), 100)
    elif u < 0.9:
        v = F(max(1, round(x / 100)) * 100)
    else:
        v = F(round(x))
    return min(max(v, F(lo)), F(hi))


def ceil_cent(x):
    return F(math.ceil(fr(x) * 100), 100)


def rand_apr4(rng, zero=0.10, high=0.45):
    """APR in units of 0.0001: 0 (10%), 12%-36% (45%), 0.01%-11.99% (45%)."""
    u = rng.random()
    if u < zero:
        return 0
    if u < zero + high:
        return rng.randint(1200, 3600)
    return rng.randint(1, 1199)


def random_payoff(rng):
    n = rng.choices((1, 2, 3, 4, 5), weights=(10, 25, 25, 20, 20))[0]
    debts = []
    for _ in range(n):
        b = log_money(rng, 100, 60000)
        apr = F(rand_apr4(rng), 10000)
        lo = ceil_cent(b * (F(1, 100) + apr / 12))      # 1% of the balance + the first month's interest
        u = rng.random()
        if u < 0.75:
            q = ceil_cent(lo * F(rng.randint(100, 300), 100))
        else:
            q = ceil_cent(F(repr(math.exp(rng.uniform(math.log(float(lo)), math.log(float(b)))))))
        if rng.random() < 0.3:
            q = F(math.ceil(q))                       # whole dollars
        q = max(lo, min(q, b))
        debts.append((b, apr, q))
    u = rng.random()
    if u < 0.15:
        extra = ZERO
    elif u < 0.50:
        extra = F(25 * rng.randint(1, 80))
    else:
        extra = F(round(math.exp(rng.uniform(0, math.log(2000)))))
    return {'debts': [debt(b, a, q) for b, a, q in debts], 'extra': extra, 'label': 'random'}


def has_ties(c):
    aprs = [d['apr'] for d in c['debts']]
    bals = [d['B'] for d in c['debts']]
    return len(set(aprs)) < len(aprs) or len(set(bals)) < len(bals)


def build_payoff(rng):
    guard = Guard('payoff.csv')
    cases = [payoff_case(d, x, lab) for lab, d, x in PAYOFF_EDGES]
    n_edge = len(cases)
    rows, stats, drawn, rejected = [], Counter(), 0, Counter()
    k = 0
    while len(rows) < N_PAYOFF:
        if k < n_edge:
            c = cases[k]
            k += 1
            res, issues = work_payoff(c, guard, f'edge {k} ({c["label"]})')
        else:
            c = random_payoff(rng)
            drawn += 1
            if has_ties(c):
                rejected['exact tie in rate or balance'] += 1
                continue
            res, issues = work_payoff(c, guard, f'random draw {drawn}')
            if issues:
                rejected[_reason(issues[0])] += 1
                continue
        idx = len(rows)
        case_id = f'po-edge-{idx + 1:03}' if idx < n_edge else f'po-{idx + 1 - n_edge:04}'
        row = {'case_id': case_id, 'label': c['label'], 'n_debts': len(c['debts']),
               'debts': '|'.join(d['s'] for d in c['debts']), 'extra': dec_str(c['extra'], 2),
               'note': '; '.join(issues)}
        for name, *_ in VARIANTS:
            e, ct = res[name]['exact'], res[name]['cents']
            never = e['months'] is None
            row[f'{name}_months'] = months_str(e['months'])
            row[f'{name}_interest'] = money(None if never else e['interest'])
            row[f'{name}_paid'] = money(None if never else e['paid'])
            row[f'{name}_payoff_months'] = 'never' if never else '|'.join(map(str, e['payoff']))
            row[f'{name}_interest_cents_track'] = money(ct['interest'] if ct['months'] is not None else None)
            for v in (None if never else e['interest'], None if never else e['paid']):
                stats['written amounts exactly on a half cent (before rounding)'] += half_cent(v)
        rows.append(row)
        payoff_stats(stats, c, res, idx < n_edge)
    stats['random draws'] = drawn
    for why, n in rejected.items():
        stats[f'random draws redrawn: {why}'] = n
    return rows, stats, guard, n_edge


def _reason(issue):
    """A short bucket for a redraw reason."""
    for key in ('cents track', 'last payment', 'to spare', 're-sorted'):
        if key in issue:
            return {'cents track': 'the cents track gives other months', 'last payment': 'a last payment under $1',
                    'to spare': 'a debt cleared with under $1 to spare',
                    're-sorted': 'snowball re-sorted every month would differ'}[key]
    return issue


def payoff_stats(s, c, res, edge):
    n = len(c['debts'])
    s['rows'] += 1
    s['edge rows' if edge else 'random rows'] += 1
    s[f'debts per row: {n}'] += 1
    s['rows with a 0% debt'] += any(d['apr'] == 0 for d in c['debts'])
    s['rows with extra = 0'] += c['extra'] == 0
    s['rows with an exact tie in rate or balance (edge rows only)'] += has_ties(c)
    av, sn = res['avalanche']['exact'], res['snowball']['exact']
    for name, *_ in VARIANTS:
        s[f'{name}: never'] += res[name]['exact']['months'] is None
    if av['months'] is not None and sn['months'] is not None:
        s['avalanche and snowball use different orders'] += av['order'] != sn['order']
        d = av['interest'] - sn['interest']
        s['avalanche interest lower than snowball'] += d < 0
        s['avalanche interest equal to snowball'] += d == 0
        s['avalanche interest higher than snowball'] += d > 0
        s['avalanche fewer months than snowball'] += av['months'] < sn['months']
        s['avalanche more months than snowball'] += av['months'] > sn['months']
    p1 = res['plus100']['exact']
    if av['months'] is not None and p1['months'] is not None:
        s['plus100 finishes sooner than avalanche'] += p1['months'] < av['months']
    if av['months'] is None and p1['months'] is not None:
        s['plus100 finishes where avalanche never does'] += 1
    b, br = res['baseline']['exact'], res['baseline_rollover']['exact']
    s['baseline and baseline_rollover differ in months'] += b['months'] != br['months']
    if av['months'] is not None and n > 1:
        s['avalanche: money rolls past the target in a payoff month'] += any(e['rolled'] for e in av['events'])
        s['avalanche: a non-target debt is paid off before the target'] += any(
            any(i != e['target'] for i in e['done']) and e['target'] not in e['done'] for e in av['events'])
        s['avalanche: two or more debts paid off in the same month'] += any(len(e['done']) > 1 for e in av['events'])
    s['some debt paid off in month 1 (avalanche)'] += av['months'] is not None and 1 in av['payoff']
    for name, *_ in VARIANTS:
        e = res[name]['exact']
        if e['months'] is not None:
            s['largest months (any variant)'] = max(s['largest months (any variant)'], e['months'])
            s['largest interest, whole dollars (any variant)'] = max(
                s['largest interest, whole dollars (any variant)'], int(e['interest']))


# ================================================ credit cards ================================================

CARD_COLUMNS = ['case_id', 'label', 'balance', 'apr', 'required', 'promo_months', 'fee_pct',
                'min_first_payment', 'min_months', 'min_interest', 'min_paid', 'min_interest_cents_track',
                'held_min_months', 'held_min_interest',
                'bt_payment', 'bt_interest', 'bt_interest_cents_track', 'bt_fee', 'bt_saves', 'bt_pay_to_clear',
                'bt_interest_with_min_floor', 'note']

CARD_EDGES = [
    # (label, balance, apr, required or None, promo months, fee)
    ('RULES.md example 2: 2% / $25 recomputed every month', '3000', '0.18', None, 12, '0.03'),
    ('RULES.md example 2: never (2% is below 2.5% interest)', '2000', '0.30', None, 12, '0.03'),
    ('RULES.md example 2: the $25 floor from the start', '900', '0.30', None, 12, '0.03'),
    ('RULES.md example 2: balance transfer (required $75, B / P = $250)', '3000', '0.24', '75', 12, '0.03'),
    ('balance exactly $1,250 (2% = $25)', '1250', '0.1999', None, 15, '0.03'),
    ('balance $1,249.99 (floor from the start)', '1249.99', '0.1999', None, 15, '0.03'),
    ('balance $1,250.01 (one month at 2%)', '1250.01', '0.1999', None, 15, '0.03'),
    ('APR 24%: 2% exactly equals the interest (never)', '5000', '0.24', None, 18, '0.05'),
    ('APR 23.99%: 2% barely beats the interest (more than 80 years)', '1260', '0.2399', None, 18, '0.05'),
    ('APR 0, default minimum', '4000', '0', None, 6, '0.03'),
    ('APR 0, required set (transfer saves minus the fee)', '4000', '0', '100', 6, '0.03'),
    ('required payment below the interest (never)', '8000', '0.2499', '150', 21, '0.03'),
    ('required payment exactly equals the interest (never)', '6000', '0.20', '100', 21, '0.03'),
    ('required payment clears the card in one month', '500', '0.1999', '600', 12, '0.03'),
    ('shortest lawful promotion: 6 months', '5200', '0.1999', None, 6, '0.03'),
    ('fee 0: saves = all the interest', '5200', '0.1999', None, 18, '0'),
    ('fee 5%', '5200', '0.1999', None, 18, '0.05'),
    ('transfer: balance / promo months ($16.67) is under the usual $25 minimum; no required payment set, so it is paid as it is',
     '300', '0.2299', None, 18, '0.03'),
    ('required beats balance / promo months: paid off inside the promotion', '1000', '0.2199', '400', 12, '0.03'),
    ('smallest balance $100', '100', '0.2999', None, 6, '0.03'),
    ('APR 36%, $25 floor still beats the interest', '700', '0.36', None, 12, '0.03'),
    ('APR 36%, the $25 floor below the interest (never)', '900', '0.36', None, 12, '0.03'),
    ('first minimum exactly on a half cent (2% of 3,000.25 = 60.005)', '3000.25', '0.15', None, 12, '0.03'),
    ('large balance on the 2% minimum', '30000', '0.1499', None, 18, '0.03'),
    ('promotion 21 months', '15000', '0.2799', '450', 21, '0.04'),
]


def card_case(b, a, q, p, f, label):
    return {'B': fr(b), 'apr': fr(a), 'req': None if q is None else fr(q), 'P': int(p), 'fee': fr(f),
            'label': label}


def bt_payment_2(c, min_floor=False):
    """max(required, B / P), required = the payment the person set; with none set it is B / P (the page README).
    min_floor=True (contrast): with none set, at least the usual minimum max(2% x opening balance, $25); every
    opening balance in the promotion is at most B and 2% x B < B / P (P < 50), so that is max($25, B / P)."""
    straight = c['B'] / c['P']
    if c['req'] is not None:
        return max(c['req'], straight)
    if not min_floor:
        return straight
    assert c['P'] < 1 / PCT
    return max(FLOOR, straight)


def work_card(c, guard, where, edge=False):
    B, apr, q, P, fee = c['B'], c['apr'], c['req'], c['P'], c['fee']
    r = apr / TWELVE
    bs, as_ = D(dec_str(B, 2)), D(dec_str(apr, 4))
    qs = None if q is None else D(dec_str(q, 2))
    issues = []
    # minimum-only payoff
    dec = dec_interest(dec_str(apr, 4))
    if q is None:
        two = card_minimum_2(B, r)
        pay_c = lambda b: max(rhu(PCT * b), whole_cents(FLOOR))          # noqa: E731
        pay_d = lambda t: max(rnd(PCT * t), FLOOR)                         # noqa: E731
        first = max(PCT * B, FLOOR)
    else:
        two = fixed_payoff(B, r, q)
        pay_c, pay_d = (lambda b: whole_cents(q)), (lambda t: q)
        first = q
    if not edge and two and two['months'] > CARD_MONTHS_CAP:   # redrawn before any stepping (not written)
        return None, [f'min: {two["months"]} months, more than {CARD_MONTHS_CAP}']
    one = R.card_payoff(bs, as_, qs)
    m2 = two['months'] if two else None
    guard.months(where + ' min months', one['months'], m2)
    guard.money(where + ' min interest', one['interest'], two['interest'] if two else None)
    guard.money(where + ' min paid', one['paid'], two['paid'] if two else None)
    two_c, alt_c = schedule_ct(B, r, pay_c), schedule_m2(B, r, pay_d)
    guard.months(where + ' min cents-track months', alt_c['months'], two_c['months'])
    guard.money(where + ' min cents-track interest', alt_c['interest'], two_c['interest'], 'cents')
    guard.money(where + ' min cents-track paid', alt_c['paid'], two_c['paid'], 'cents')
    one_c, emu = R.card_payoff(bs, as_, qs, round_cents=True), schedule_ct(B, r, pay_c, interest_c=dec)
    guard.months(where + ' rules.py cents track (60-digit rate) months', one_c['months'], emu['months'])
    if emu['months'] is not None and fr(one_c['interest']) != emu['interest']:
        guard._stop(where + ' rules.py cents track (60-digit rate) interest', one_c['interest'], emu['interest'])
    guard.rules_cents(where + ' min', where, one_c['interest'], two_c['interest'])
    if q is None:  # Regulation Z appendix M2's SAS loop, copied line by line in rules.py, with a $25 floor.
        # It rounds balance x (1 + APR / 12), where a 60-digit product lands exactly on a half cent, so it
        # must equal the exact cents track to the cent (unlike rules.card_payoff(round_cents=True), see dec_interest).
        m2l = R.regz_m2_single(bs, as_, R.PAGE_MIN_PCT, R.PAGE_MIN_FLOOR)
        emu2 = schedule_ct(B, r, pay_c, interest_c=dec_interest(dec_str(apr, 4), 'one_plus'))
        guard.months(where + ' rules.regz_m2_single months (60-digit 1 + rate)', None if m2l is None else m2l[0],
                     emu2['months'])
        if m2l is not None and (fr(m2l[2]) != emu2['interest'] or fr(m2l[1]) != emu2['paid']):
            guard._stop(where + ' rules.regz_m2_single interest (60-digit 1 + rate)', m2l[2], emu2['interest'])
        guard.rules_cents(where + ' regz_m2_single', where, None if m2l is None else m2l[2], two_c['interest'])
    # the first minimum held level (contrast, default minimum only)
    held = held_c = None
    if q is None:
        held = fixed_payoff(B, r, first)
        held_c = schedule_ct(B, r, lambda b: max(rhu(PCT * whole_cents(B)), whole_cents(FLOOR)))
        h1 = R.card_payoff(bs, as_, None, frozen=True)
        guard.months(where + ' held-minimum months', h1['months'], held['months'] if held else None)
        guard.money(where + ' held-minimum interest', h1['interest'], held['interest'] if held else None)
    # balance transfer
    X, Xf = bt_payment_2(c), bt_payment_2(c, min_floor=True)
    bt = window(B, r, X, P)
    b1 = R.balance_transfer(bs, as_, P, D(dec_str(fee, 4)), required=qs)
    fee_amt, pay_clear = B * fee, B * (1 + fee) / P
    guard.money(where + ' bt interest', b1['interest'], bt['interest'])
    # contrast: the page's usual minimum as a floor when no required payment is set (written, not the answer)
    btf = window(B, r, Xf, P)
    b1f = R.balance_transfer(bs, as_, P, D(dec_str(fee, 4)), required=qs, min_floor=True)
    guard.money(where + ' bt interest with the usual minimum as a floor', b1f['interest'], btf['interest'])
    guard.months(where + ' bt months run with the usual minimum as a floor', b1f['months_run'], btf['months'])
    btf_c = schedule_ct(B, r, lambda b: Xf * 100, stop_after=P)
    guard.money(where + ' bt fee', b1['fee'], fee_amt)
    guard.money(where + ' bt saves', b1['saves'], bt['interest'] - fee_amt)
    guard.money(where + ' bt pay to clear', b1['pay_to_clear'], pay_clear)
    guard.months(where + ' bt months run', b1['months_run'], bt['months'])
    bt_c = schedule_ct(B, r, lambda b: X * 100, stop_after=P)
    bt_m2 = schedule_m2(B, r, lambda t: X, stop_after=P)
    guard.months(where + ' bt cents-track months run', bt_m2['months'], bt_c['months'])
    guard.money(where + ' bt cents-track interest', bt_m2['interest'], bt_c['interest'], 'cents')
    b1c = R.balance_transfer(bs, as_, P, D(dec_str(fee, 4)), required=qs, round_cents=True)
    bt_emu = schedule_ct(B, r, lambda b: X * 100, stop_after=P, interest_c=dec)
    if fr(b1c['interest']) != bt_emu['interest']:
        guard._stop(where + ' rules.py bt cents track (60-digit rate)', b1c['interest'], bt_emu['interest'])
    guard.rules_cents(where + ' bt', where, b1c['interest'], bt_c['interest'])
    # robustness
    for name, e, ec in (('min', two, two_c), ('held min', held, held_c)):
        if name == 'held min' and q is not None:
            continue
        mo = e['months'] if e else None
        if mo != ec['months']:
            issues.append(f'{name}: cents track gives {months_str(ec["months"])} months')
        if e and e['last'] is not None:
            regular = FLOOR if (q is None and name == 'min') else (first if name == 'held min' else q)
            m = max(MARGIN, regular / 100)
            if e['last'] < m:
                issues.append(f'{name}: last payment {money(e["last"])}')
            if e['slack'] < m:
                issues.append(f'{name}: last payment only {money(e["slack"])} short of a full one')
    # the same margins for the answer and for the written contrast (when its payment differs), so a row is kept
    # or redrawn exactly as before the transfer rule changed (a floor that clears the card inside the promotion)
    for name, w, wc in (('transfer', bt, bt_c), ('transfer with the usual minimum', btf, btf_c)):
        if name != 'transfer' and Xf == X:
            continue
        if w['paid_off'] and r > 0:   # at 0% the interest is 0 whichever month the card is cleared
            if w['last'] < MARGIN or w['slack'] < MARGIN:
                issues.append(f'{name}: cleared inside the promotion, last payment {money(w["last"])}, '
                              f'{money(w["slack"])} short of a full one')
            if wc['months'] != w['months']:
                issues.append(f'{name}: cents track clears the card in another month')
    if two and two['months'] > CARD_MONTHS_CAP:
        issues.append(f'min: {two["months"]} months, more than {CARD_MONTHS_CAP}')
    return {'min': two, 'min_c': two_c, 'first': first, 'held': held, 'bt': bt, 'bt_c': bt_c, 'X': X,
            'btf': btf, 'Xf': Xf, 'fee': fee_amt, 'clear': pay_clear}, issues


def card_apr4(rng):
    """Card APR in units of 0.0001: 0 (5%), 12%-29.99% (65%), 30%-36% (10%), 0.01%-11.99% (20%)."""
    u = rng.random()
    if u < 0.05:
        return 0
    if u < 0.70:
        return rng.randint(1200, 2999)
    if u < 0.80:
        return rng.randint(3000, 3600)
    return rng.randint(1, 1199)


def random_card(rng):
    b = log_money(rng, 100, 30000)
    apr = F(card_apr4(rng), 10000)
    r = apr / 12
    q = None
    u = rng.random()
    if u < 0.40:
        q = max(FLOOR, ceil_cent(b * (r + F(rng.randint(50, 400), 10000))))   # interest + 0.5% to 4%
        if q > b:
            q = None
    elif u < 0.46 and b * r > 1:
        q = max(F(1), F(math.floor(b * r * F(rng.randint(30, 95), 100) * 100), 100))  # below the interest
    if q is not None and rng.random() < 0.4:
        q = F(math.ceil(q))
    promo = rng.choices((6, 9, 12, 15, 18, 21, rng.randint(6, 21)), weights=(10, 5, 25, 20, 20, 10, 10))[0]
    if rng.random() < 0.6:
        fee = rng.choice((F(3, 100), F(4, 100), F(5, 100), ZERO))
    else:
        fee = F(rng.randint(0, 20) * 25, 10000)       # 0% to 5% in 0.25% steps
    return {'B': b, 'apr': apr, 'req': q, 'P': promo, 'fee': fee, 'label': 'random'}


def build_cards(rng):
    guard = Guard('cards.csv')
    cases = [card_case(*e[1:], e[0]) for e in CARD_EDGES]
    n_edge = len(cases)
    rows, stats, rejected, drawn, k = [], Counter(), Counter(), 0, 0
    while len(rows) < N_CARDS:
        if k < n_edge:
            c = cases[k]
            k += 1
            res, issues = work_card(c, guard, f'edge {k} ({c["label"]})', edge=True)
        else:
            c = random_card(rng)
            drawn += 1
            res, issues = work_card(c, guard, f'random draw {drawn}')
            if issues:
                rejected[_card_reason(issues[0])] += 1
                continue
        idx = len(rows)
        e = res['min']
        row = {'case_id': f'cc-edge-{idx + 1:03}' if idx < n_edge else f'cc-{idx + 1 - n_edge:04}',
               'label': c['label'], 'balance': dec_str(c['B'], 2), 'apr': dec_str(c['apr'], 4),
               'required': '' if c['req'] is None else dec_str(c['req'], 2), 'promo_months': c['P'],
               'fee_pct': dec_str(c['fee'], 4),
               'min_first_payment': money(res['first']),
               'min_months': months_str(e['months'] if e else None),
               'min_interest': money(e['interest'] if e else None), 'min_paid': money(e['paid'] if e else None),
               'min_interest_cents_track': money(res['min_c']['interest']),
               'held_min_months': '' if c['req'] is not None else months_str(res['held']['months'] if res['held'] else None),
               'held_min_interest': '' if c['req'] is not None else money(res['held']['interest'] if res['held'] else None),
               'bt_payment': money(res['X']), 'bt_interest': money(res['bt']['interest']),
               'bt_interest_cents_track': money(res['bt_c']['interest']), 'bt_fee': money(res['fee']),
               'bt_saves': money(res['bt']['interest'] - res['fee']), 'bt_pay_to_clear': money(res['clear']),
               'bt_interest_with_min_floor': '' if c['req'] is not None else money(res['btf']['interest']),
               'note': '; '.join(issues)}
        for v in (res['first'], e['interest'] if e else None, e['paid'] if e else None, res['X'],
                  res['bt']['interest'], res['fee'], res['bt']['interest'] - res['fee'], res['clear']):
            stats['written amounts exactly on a half cent (before rounding)'] += half_cent(v)
        rows.append(row)
        card_stats(stats, c, res, idx < n_edge)
    stats['random draws'] = drawn
    for why, n in rejected.items():
        stats[f'random draws redrawn: {why}'] = n
    return rows, stats, guard, n_edge


def _card_reason(issue):
    edge = 'a last payment within $1 (or 1%) of a month boundary'
    for key, why in (('more than', f'minimum-only payoff over {CARD_MONTHS_CAP} months'),
                     ('cents track', 'the cents track gives other months'), ('last payment', edge),
                     ('short of', edge)):
        if key in issue:
            return why
    return issue


def card_stats(s, c, res, edge):
    e = res['min']
    s['rows'] += 1
    s['edge rows' if edge else 'random rows'] += 1
    default = c['req'] is None
    s['default 2% / $25 minimum' if default else 'required payment set'] += 1
    s[('default' if default else 'required') + ': never'] += e is None
    if default and e is not None:
        s['default: starts at or above $1,250 (2% months, then $25)'] += e['phase1'] > 0
        s['default: $25 floor from the first month'] += e['phase1'] == 0
    s['APR 0'] += c['apr'] == 0
    s['APR 24% or more'] += c['apr'] >= F(24, 100)
    if e is not None:
        m = e['months']
        bucket = ('1-24' if m <= 24 else '25-120' if m <= 120 else '121-360' if m <= 360 else
                  '361-1200' if m <= 1200 else 'over 1200')
        s[f'minimum-only months {bucket}'] += 1
        s['largest minimum-only months'] = max(s['largest minimum-only months'], m)
        if default:
            s['default: holding the first minimum level is faster'] += res['held']['months'] < m
    X, straight = res['X'], c['B'] / c['P']
    if X == straight:
        s['transfer payment = balance / promo months'] += 1
    else:
        assert c['req'] is not None and X == c['req']
        s['transfer payment = the required payment'] += 1
    if res['Xf'] != X:
        s['transfer: no required payment and balance / promo months under the usual $25 minimum (contrast differs)'] += 1
        s['transfer: ... of which the contrast interest differs by more than a cent'] += (
            abs(res['btf']['interest'] - res['bt']['interest']) > F(1, 100))
    s['transfer: card paid off inside the promotion'] += res['bt']['paid_off']
    s['transfer saves a negative amount (fee above the interest)'] += res['bt']['interest'] < res['fee']
    s[f'promo months {c["P"]}'] += 1
    s['fee 0'] += c['fee'] == 0


# ================================================== mortgage ==================================================

MORTGAGE_COLUMNS = ['case_id', 'label', 'balance', 'rate', 'payment', 'extra', 'lump', 'home_value', 'original_value',
                    'months', 'interest', 'interest_cents_track',
                    'extra_months', 'extra_interest', 'extra_interest_cents_track', 'months_saved', 'interest_saved',
                    'biweekly_payment', 'biweekly_months', 'biweekly_interest', 'biweekly_interest_cents_track',
                    'biweekly_months_saved', 'biweekly_interest_saved',
                    'bw26_half_payments', 'bw26_months', 'bw26_interest',
                    'recast_payment', 'recast_saving', 'recast_payment_fractional',
                    'mi_months', 'hpa_request_months', 'hpa_auto_months', 'hpa_request_actual_months', 'note']


def level_up(B, rate, n, factor=1):
    """The level payment for n months (times factor), rounded UP to the cent."""
    return ceil_cent(level_payment_2(fr(B), fr(rate) / 12, n) * factor)


MORTGAGE_EDGES = [
    # (label, balance, rate, payment, extra, lump, home_value, original_value)
    ('RULES.md example 3', '200000', '0.06', '1250', '200', '20000', '240000', '245000'),
    ('RULES.md HPA example: $216,000 on a $240,000 home, 30 years at 6%', '216000', '0.06', '1295.03', '0', '0',
     '240000', '240000'),
    ('already below 80% of both values (all MI months 0)', '150000', '0.045', '1100', '100', '10000', '300000',
     '250000'),
    ('payment = the 30-year level payment rounded up (last payment a few dollars short of a full one)',
     '350000', '0.065', level_up(350000, '0.065', 360), '0', '25000', '420000', '400000'),
    ('payment = the 15-year level payment rounded up', '275000', '0.05375', level_up(275000, '0.05375', 180), '300',
     '15000', '340000', '330000'),
    ('payment exactly double the 30-year level payment', '500000', '0.07', level_up(500000, '0.07', 360, 2), '0',
     '50000', '600000', '560000'),
    ('lump equals the balance (recast payment 0)', '40000', '0.05', '500', '0', '40000', '300000', '250000'),
    ('lump 0 (the recast formula still re-spreads the balance over the whole months left)', '180000', '0.0425',
     '1100', '150', '0', '226000', '210000'),
    ('extra 0 (extra = base; MI at the payment)', '260000', '0.0575', '1700', '0', '30000', '310000', '300000'),
    ('rate 2%, balance $1,200,000', '1200000', '0.02', '5200', '1000', '100000', '1510000', '1450000'),
    ('rate 9%, balance $20,000, 5-year payment', '20000', '0.09', level_up(20000, '0.09', 60, F(21, 20)), '50',
     '2000', '120000', '110000'),
    ('home value below the original value (prices fell): MI by home value comes later', '320000', '0.0675', '2300',
     '250', '20000', '360000', '405000'),
    ('extra $2,000', '420000', '0.0625', '2900', '2000', '60000', '500000', '480000'),
    ('rate off the 1/8 grid (0.0649)', '233456.78', '0.0649', '1611.11', '111', '12345', '290000', '275000'),
]


def mortgage_case(b, rate, p, x, lump, hv, ov, label):
    return {'B': fr(b), 'rate': fr(rate), 'P': fr(p), 'E': fr(x), 'L': fr(lump), 'HV': fr(hv), 'OV': fr(ov),
            'label': label}


def work_mortgage(c, guard, where):
    B, rate, P, E, L, HV, OV = c['B'], c['rate'], c['P'], c['E'], c['L'], c['HV'], c['OV']
    r = rate / TWELVE
    bs, rs, ps, es, ls = (D(dec_str(B, 2)), D(dec_str(rate, 5)), D(dec_str(P, 2)), D(dec_str(E, 2)),
                          D(dec_str(L, 2)))
    issues = []
    base, ext, bw = fixed_payoff(B, r, P), fixed_payoff(B, r, P + E), fixed_payoff(B, r, P * BIWEEKLY)
    mc = R.mortgage_compare(bs, rs, ps, extra=es, lump=ls, home_value=D(dec_str(HV, 2)))
    for name, two, mo, it in (('base', base, 'base_months', 'base_interest'),
                              ('extra', ext, 'extra_months', 'extra_interest'),
                              ('biweekly', bw, 'biweekly_months', 'biweekly_interest')):
        guard.months(f'{where} {name} months', mc[mo], two['months'])
        guard.money(f'{where} {name} interest', mc[it], two['interest'])
    cts = {}
    dec = dec_interest(dec_str(rate, 5))
    for name, pay in (('base', P), ('extra', P + E), ('biweekly', P * BIWEEKLY)):
        two_c = schedule_ct(B, r, lambda b, _p=pay: _p * 100)
        alt_c = schedule_m2(B, r, lambda t, _p=pay: _p)
        guard.months(f'{where} {name} cents-track months', alt_c['months'], two_c['months'])
        guard.money(f'{where} {name} cents-track interest', alt_c['interest'], two_c['interest'], 'cents')
        one_c = R.amortize(bs, rs, R.biweekly_monthly_payment(ps) if name == 'biweekly' else
                           (ps + es if name == 'extra' else ps), round_cents=True)
        emu = schedule_ct(B, r, lambda b, _p=pay: _p * 100, interest_c=dec)
        guard.months(f'{where} {name} rules.py cents track (60-digit rate) months', one_c['months'], emu['months'])
        if fr(one_c['interest']) != emu['interest']:
            guard._stop(f'{where} {name} rules.py cents track (60-digit rate)', one_c['interest'], emu['interest'])
        guard.rules_cents(f'{where} {name}', where, one_c['interest'], two_c['interest'])
        cts[name] = two_c
    # 26 real half payments a year, interest at rate / 26 per two weeks (contrast). Derivation 1 runs rules.schedule
    # with an "APR" of rate x 12 / 26, so that its APR / 12 is rate / 26 per period.
    bw26 = fixed_payoff(B, rate / TWENTYSIX, P / 2)
    with localcontext(R.CTX):
        apr26 = rs * TWELVE / TWENTYSIX
    s26 = R.schedule(bs, apr26, ps / 2)
    guard.months(f'{where} bw26 half payments', s26['months'], bw26['months'])
    guard.money(f'{where} bw26 interest', s26['interest'], bw26['interest'])
    bw26_months = math.ceil(F(bw26['months'] * TWELVE, TWENTYSIX))
    # recast
    if L >= B:
        rec = ZERO
        rec_frac = ZERO
    else:
        rec = level_payment_2(B - L, r, base['months'])
        rec_frac = P * (B - L) / B
    guard.money(f'{where} recast payment', R.recast_payment(bs, rs, ps, ls), rec)
    guard.money(f'{where} recast payment (fractional months)',
                R.recast_payment(bs, rs, ps, ls, months=R.nper(bs, rs, ps)), rec_frac)
    # mortgage insurance
    mis = {}
    for name, pay, ltv, value, extra_d in (('mi', P + E, CANCEL, HV, es), ('hpa_request', P, CANCEL, OV, D(0)),
                                          ('hpa_auto', P, TERMINATE, OV, D(0)),
                                          ('hpa_request_actual', P + E, CANCEL, OV, es)):
        tgt = months_to_target(B, r, pay, ltv * value)
        one = R.months_to_ltv(bs, rs, ps, D(dec_str(value, 2)), D(dec_str(ltv, 2)), extra=extra_d)
        guard.months(f'{where} {name} months', one, tgt['k'])
        ct = schedule_ct(B, r, lambda b, _p=pay: _p * 100, target=ltv * value)
        ct2 = schedule_m2(B, r, lambda t, _p=pay: _p, target=ltv * value)
        guard.months(f'{where} {name} cents-track months to the limit', ct2['target_month'], ct['target_month'])
        mis[name] = tgt
        if ct['target_month'] != tgt['k']:
            issues.append(f'{name}: cents track reaches the limit in month {ct["target_month"]}')
        T = ltv * value
        if tgt['after'] > T - MARGIN or (tgt['before'] is not None and tgt['before'] < T + MARGIN):
            issues.append(f'{name}: the balance passes within $1 of the limit')
    # robustness
    for name, e in (('base', base), ('extra', ext), ('biweekly', bw)):
        if e['months'] != cts[name]['months']:
            issues.append(f'{name}: cents track gives {cts[name]["months"]} months')
        pay = {'base': P, 'extra': P + E, 'biweekly': P * BIWEEKLY}[name]
        # a scheduled (level, rounded-up) payment's last payment is a few dollars short by design: $1 margin only
        m = MARGIN if (c.get('scheduled') and pay == P) else max(MARGIN, pay / 100)
        if e['last'] < m:
            issues.append(f'{name}: last payment {money(e["last"])}')
        if e['slack'] < m:
            issues.append(f'{name}: last payment only {money(e["slack"])} short of a full one')
    return {'base': base, 'ext': ext, 'bw': bw, 'cts': cts, 'bw26': bw26, 'bw26_months': bw26_months,
            'rec': rec, 'rec_frac': rec_frac, 'mi': mis}, issues


RATE_GRID = [F(1600 + 100 * k, 80000) for k in range(57)]   # 0.02000, 0.02125, ..., 0.09000 (1/8% steps)


def random_mortgage(rng):
    B = log_money(rng, 20000, 1200000)
    rate = rng.choice(RATE_GRID) if rng.random() < 0.7 else F(rng.randint(200, 900), 10000)
    n = rng.choices((rng.randint(60, 179), rng.randint(180, 299), rng.randint(300, 360)), weights=(25, 35, 40))[0]
    scheduled = rng.random() < 0.3
    if scheduled:                                                # the level payment for n months, rounded up
        u = F(1)
    elif rng.random() < 0.4:
        u = F(rng.randint(10001, 11500), 10000)                  # a little over the level payment
    else:
        u = F(rng.randint(10001, 20000), 10000)                  # up to double
    P = level_up(B, rate, n, u)
    v = rng.random()
    E = ZERO if v < 0.2 else F(50 * rng.randint(1, 40)) if v < 0.7 else F(rng.randint(1, 2000))
    hi_lump = min(100000, int(B * F(9, 10)) // 100 * 100)
    L = ZERO if rng.random() < 0.15 or hi_lump < 1000 else F(100 * rng.randint(10, hi_lump // 100))
    ltv0 = F(rng.randint(8200, 9700), 10000) if rng.random() < 0.8 else F(rng.randint(5500, 8199), 10000)
    OV = F(round(B / ltv0 / 100) * 100)                          # today's balance over the original value
    w = rng.random()                                             # today's home value over the original value
    v = (F(rng.randint(9200, 11000), 10000) if w < 0.7 else F(rng.randint(11001, 15000), 10000) if w < 0.9
         else F(rng.randint(8000, 9199), 10000))
    HV = F(round(OV * v / 100) * 100)
    return {'B': B, 'rate': rate, 'P': P, 'E': E, 'L': L, 'HV': HV, 'OV': OV,
            'label': 'random, scheduled payment' if scheduled else 'random', 'n': n, 'u': u,
            'scheduled': scheduled}


def build_mortgage(rng):
    guard = Guard('mortgage.csv')
    cases = [mortgage_case(*e[1:], e[0]) for e in MORTGAGE_EDGES]
    n_edge = len(cases)
    rows, stats, rejected, drawn, k = [], Counter(), Counter(), 0, 0
    while len(rows) < N_MORTGAGE:
        if k < n_edge:
            c = cases[k]
            k += 1
            res, issues = work_mortgage(c, guard, f'edge {k} ({c["label"]})')
        else:
            c = random_mortgage(rng)
            drawn += 1
            res, issues = work_mortgage(c, guard, f'random draw {drawn}')
            if issues:
                rejected[_mortgage_reason(issues[0])] += 1
                continue
        idx = len(rows)
        base, ext, bw = res['base'], res['ext'], res['bw']
        row = {'case_id': f'mo-edge-{idx + 1:03}' if idx < n_edge else f'mo-{idx + 1 - n_edge:04}',
               'label': c['label'], 'balance': dec_str(c['B'], 2), 'rate': dec_str(c['rate'], 5),
               'payment': dec_str(c['P'], 2), 'extra': dec_str(c['E'], 2), 'lump': dec_str(c['L'], 2),
               'home_value': dec_str(c['HV'], 2), 'original_value': dec_str(c['OV'], 2),
               'months': base['months'], 'interest': money(base['interest']),
               'interest_cents_track': money(res['cts']['base']['interest']),
               'extra_months': ext['months'], 'extra_interest': money(ext['interest']),
               'extra_interest_cents_track': money(res['cts']['extra']['interest']),
               'months_saved': base['months'] - ext['months'], 'interest_saved': money(base['interest'] - ext['interest']),
               'biweekly_payment': money(c['P'] * BIWEEKLY), 'biweekly_months': bw['months'],
               'biweekly_interest': money(bw['interest']),
               'biweekly_interest_cents_track': money(res['cts']['biweekly']['interest']),
               'biweekly_months_saved': base['months'] - bw['months'],
               'biweekly_interest_saved': money(base['interest'] - bw['interest']),
               'bw26_half_payments': res['bw26']['months'], 'bw26_months': res['bw26_months'],
               'bw26_interest': money(res['bw26']['interest']),
               'recast_payment': money(res['rec']), 'recast_saving': money(c['P'] - res['rec']),
               'recast_payment_fractional': money(res['rec_frac']),
               'mi_months': res['mi']['mi']['k'], 'hpa_request_months': res['mi']['hpa_request']['k'],
               'hpa_auto_months': res['mi']['hpa_auto']['k'],
               'hpa_request_actual_months': res['mi']['hpa_request_actual']['k'],
               'note': '; '.join(issues)}
        for v in (base['interest'], ext['interest'], base['interest'] - ext['interest'], c['P'] * BIWEEKLY,
                  bw['interest'], base['interest'] - bw['interest'], res['bw26']['interest'], res['rec'],
                  c['P'] - res['rec'], res['rec_frac']):
            stats['written amounts exactly on a half cent (before rounding)'] += half_cent(v)
        rows.append(row)
        mortgage_stats(stats, c, res, idx < n_edge)
    stats['random draws'] = drawn
    for why, n in rejected.items():
        stats[f'random draws redrawn: {why}'] = n
    return rows, stats, guard, n_edge


def _mortgage_reason(issue):
    for key, why in (('cents track', 'the cents track gives another month'),
                     ('within $1 of the limit', 'the balance passes within $1 of an MI limit'),
                     ('last payment', 'a last payment within 1% (or $1) of a month boundary'),
                     ('short of', 'a last payment within 1% (or $1) of a month boundary')):
        if key in issue:
            return why
    return issue


def mortgage_stats(s, c, res, edge):
    s['rows'] += 1
    s['edge rows' if edge else 'random rows'] += 1
    s['rate on the 1/8% grid' if (c['rate'] * 800).denominator == 1 else 'rate off the 1/8% grid'] += 1
    s['payment = a level payment rounded up (scheduled)'] += bool(c.get('scheduled'))
    if c.get('scheduled'):
        s['scheduled rows: whole-month and fractional recast within a cent'] += abs(
            to_cents(res['rec']) - to_cents(res['rec_frac'])) <= 1
    m = res['base']['months']
    bucket = '1-120' if m <= 120 else '121-240' if m <= 240 else '241-360' if m <= 360 else 'over 360'
    s[f'months left {bucket}'] += 1
    s['extra 0'] += c['E'] == 0
    s['lump 0'] += c['L'] == 0
    s['lump at or above the balance'] += c['L'] >= c['B']
    s['home value below the original value'] += c['HV'] < c['OV']
    for name in ('mi', 'hpa_request', 'hpa_auto', 'hpa_request_actual'):
        s[f'{name}: already at the limit (0 months)'] += res['mi'][name]['k'] == 0
    s['mi_months later than hpa_request_actual_months'] += res['mi']['mi']['k'] > res['mi']['hpa_request_actual']['k']
    s['mi_months earlier than hpa_request_actual_months'] += res['mi']['mi']['k'] < res['mi']['hpa_request_actual']['k']
    s['26 half payments: less interest than payment x 13/12'] += res['bw26']['interest'] < res['bw']['interest']
    s['26 half payments: fewer months than payment x 13/12'] += res['bw26_months'] < res['bw']['months']
    s['26 half payments: more months than payment x 13/12'] += res['bw26_months'] > res['bw']['months']
    s['recast: whole-month and fractional readings differ by more than a cent'] += abs(
        to_cents(res['rec']) - to_cents(res['rec_frac'])) > 1
    s['largest months left'] = max(s['largest months left'], m)


# ===================================================== run =====================================================

def write_csv(path, columns, rows):
    with path.open('w', newline='', encoding='utf-8') as fh:
        w = csv.DictWriter(fh, fieldnames=columns, lineterminator='\n')
        w.writeheader()
        w.writerows(rows)


def main(out_dir=OUT_DIR):
    t0 = time.time()
    check_examples()
    rng = random.Random(SEED)
    built = {}
    for name, build, cols, want in (('payoff.csv', build_payoff, PAYOFF_COLUMNS, N_PAYOFF),
                                    ('cards.csv', build_cards, CARD_COLUMNS, N_CARDS),
                                    ('mortgage.csv', build_mortgage, MORTGAGE_COLUMNS, N_MORTGAGE)):
        t1 = time.time()
        rows, stats, guard, n_edge = build(rng)
        assert len(rows) == want, (name, len(rows))
        assert len({r['case_id'] for r in rows}) == want
        built[name] = (cols, rows, stats, guard, n_edge, time.time() - t1)
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    for name, (cols, rows, stats, guard, n_edge, secs) in built.items():   # written only once all three passed
        write_csv(out_dir / name, cols, rows)
    for name, (cols, rows, stats, guard, n_edge, secs) in built.items():
        print(f'wrote {name}: {len(rows)} rows ({n_edge} edge, {len(rows) - n_edge} random), {secs:.0f} s; '
              f'both derivations agree; largest exact-track gap before rounding {float(guard.max_gap):.3g}')
        for key in sorted(guard.n):
            print(f'  check: {key}: {guard.n[key]}')
        print(f'  information: rows where rules.py\'s cents track differs: {len(guard.rules_ct_rows)}, '
              f'largest gap {guard.rules_ct_gap} cent(s)')
        for key in sorted(stats):
            print(f'  {key}: {stats[key]}')
    print(f'total {time.time() - t0:.0f} s')


if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else OUT_DIR)
