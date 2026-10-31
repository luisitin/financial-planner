"""Estimated tax and withholding answer key: the "Estimated payments" and "Withholding check" pages. Two CSVs.

Run:  python3 -B -I tools/golden_estimated/estimated_key.py [out_dir] [--mutate NAME] [--skip-examples]
Writes tests/golden/estimated/dates.csv (80 rows: every installment due date of tax years 2024 to 2027, the January
2028 one included, for no state, DC, MA, ME and CA, by the law and by the page) and households.csv (3,000 invented
households, tax years 2025 and 2026). Standard library only, exact arithmetic (fractions.Fraction in derivation 1,
integers in derivation 2), deterministic (random.Random(20261031)). The figures and the model come from rules.py next
to this file; the sources and the reasons are in tests/golden/estimated/RULES.md and in README.md here. Nothing under
modules/, core/ or tests/*.test.mjs was opened, and the app is never imported.

Model (the pages' documented conventions, made exact by rules.py; where the law differs the main columns follow the
law and a contrast column, or dates.csv, gives the page's way):
  * tax = regular income tax on max(0, interest - standard deduction), exact bracket formula (Tax Table contrast).
    2027 rows test due dates only (dates.csv), no tax.
  * required = lesser of 90% of this year's tax and 100% (110% when last year's AGI is over $150,000, or $75,000 for
    married filing separately this year) of last year's tax; no last-year figure: 90% of this year's.
  * withholding = withheld so far + per-paycheck x floor(days to Dec 31 / 365.25 x paychecks a year), per person;
    nothing typed so far: a full year at the per-paycheck rate.
  * to pay by estimates = max(0, required - withholding), cumulative 25/50/75/100%; where you stand on 'today' (past
    due, behind, next payment, status per quarter) as the page documents it; balance, verdict, W-4 suggestion; the
    pages' two penalty flags beside the law's exposure (6654(e)(1), (e)(2), (b)).
  * due dates: April 15, June 15, September 15, January 15, moved past Saturdays, Sundays and D.C. legal holidays
    (7503); the page also moves the April payment past Patriots' Day for MA and ME filers, which the law does not
    (Rev. Rul. 2015-13): dates.csv due_page.

Two derivations of every value, run on every row (kept or redrawn) before anything is written:
  derivation 1  rules.py: evaluate (case_tax, required_annual_payment, projected_withholding, where_you_stand,
                law_underpaid, verdict, w4_suggestion, the flags), due_date, jan31_option_date.
  derivation 2  this file, written separately in integers of 1e-8 dollar: the tax from the revenue procedures'
                printed "The Tax Is" base of the bracket plus the rate on the excess (bisection on the bracket tops);
                the shares as a quarter times 1..4; paychecks left as days x n x 4 // 1461; past-due quarters as a
                prefix of the year; the law's test as "boxes 1..j < j/4 of (required - withholding)" instead of
                dating each payment; the D.C. holidays by testing each day against weekday-and-day-of-month rules
                (third Monday = a Monday on the 15th to 21st, a Friday before a Saturday holiday, ...).
The script refuses to write any CSV if an amount differs by more than a cent, or any other value (date, status,
verdict, flag, count) differs at all, between the two. Both CSVs are worked first and written only if both pass.
--mutate NAME puts one deliberate mistake into derivation 2 (see MUTATIONS) to show the guard refuses;
--skip-examples turns off the RULES.md examples check so the row guard has to find it alone.
"""
import sys
sys.dont_write_bytecode = True  # before importing rules.py, so no __pycache__ lands in the repo

import csv
import random
import time
from bisect import bisect_left
from collections import Counter
from datetime import date, timedelta
from decimal import Decimal as D
from fractions import Fraction as F
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import rules as R  # noqa: E402  (importing it runs rules.check_tables())

ROOT = HERE.parents[1]
OUT_DIR = ROOT / 'tests' / 'golden' / 'estimated'
SEED = 20261031
N_HOUSEHOLDS = 3000
HOUSEHOLD_YEARS = tuple(R.TAX_YEARS)          # 2025, 2026: the years with published brackets
DATE_YEARS = (2024, 2025, 2026, 2027)         # dates.csv (2027's fourth installment is due in January 2028)
DATE_STATES = ('', 'DC', 'MA', 'ME', 'CA')    # '' = no state given
assert HOUSEHOLD_YEARS == (2025, 2026)
ZERO, CENT = F(0), F(1, 100)
WEEKDAYS = ('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday')
STATUSES = ('single', 'married_joint', 'married_separate', 'head_of_household')
PERIODS = ('weekly', 'biweekly', 'semimonthly', 'monthly')
STATE_CODES = ('AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'DC', 'FL', 'GA', 'HI', 'ID', 'IL', 'IN', 'IA', 'KS',
               'KY', 'LA', 'ME', 'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ', 'NM', 'NY', 'NC',
               'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY')
OTHER_STATES = tuple(s for s in STATE_CODES if s not in ('MA', 'ME', 'DC', 'CA'))

MUTATIONS = {
    'agi_line_inclusive': 'last-year AGI of exactly $150,000 / $75,000 takes 110%',
    'mfs_line_150k': 'married filing separately uses the $150,000 line, not $75,000',
    'blank_prior_is_zero': 'a blank last-year tax is read as 0',
    'no_tolerance': "'paid' and 'covered' need the full cumulative share (no $1 tolerance)",
    'catchup_cures_law': "the law's test counts every typed payment on every due date (the page's way)",
    'small_tax_counts_estimates': 'the $1,000 test subtracts estimated payments as well as withholding',
    'patriots_in_law': "the law's April date moves past Patriots' Day for MA and ME",
    'king_not_holiday': "Martin Luther King Jr.'s Birthday is not a legal holiday",
    'paychecks_365': 'paychecks left = floor(days / 365 x n)',
    'zero_so_far_is_blank': "a typed 0 'withheld so far' is read as blank (a full year)",
    'about_right_inclusive': "'about right' when |balance| <= 500",
    'due_status_30_days': "'due' whenever the due date is 30 days away or less",
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
    """Round an exact value to an integer, halves away from zero."""
    x = fr(x)
    n = abs(x)
    k = (2 * n.numerator + n.denominator) // (2 * n.denominator)
    return -k if x < 0 else k


def money(x):
    """Dollars with two decimals, half up (away from zero); '' for None. The only rounding the key does."""
    if x is None:
        return ''
    c = rhu(fr(x) * 100)
    sign = '-' if c < 0 else ''
    c = abs(c)
    return f'{sign}{c // 100}.{c % 100:02d}'


def money_in(x):
    """An input amount, which must already be whole cents; '' for None."""
    if x is None or x == '':
        return ''
    v = fr(x)
    assert (v * 100).denominator == 1, x
    return money(v)


def half_cent(x):
    return x is not None and (fr(x) * 100).denominator == 2


def yn(b):
    return 'yes' if b else 'no'


def iso(d):
    return '' if d is None else d.isoformat()


def ceil_cents(x):
    x = fr(x) * 100
    return F(-((-x.numerator) // x.denominator), 100)


def ceil_dollars(x):
    x = fr(x)
    return F(-((-x.numerator) // x.denominator))


def round_cents(x):
    return F(rhu(fr(x) * 100), 100)


class Guard:
    """Compares derivation 1 with derivation 2. An amount more than a cent apart, or any other value that differs at
    all, stops the run before a CSV is written."""

    def __init__(self, name):
        self.name = name
        self.n = Counter()
        self.max_gap = ZERO

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
        self.n['amounts whose written cents differ'] += rhu(fa * 100) != rhu(fb * 100)


# ======================================== derivation 1: rules.py ========================================

def rules_case(c):
    """A households.csv input row (strings, '' = blank) as rules.evaluate wants it."""
    rc = {'year': int(c['year']), 'today': c['today'], 'state': c['state'], 'filing_status': c['filing_status'],
          'births': c['adults'].split('|'), 'other_income': c['other_income'],
          'prior_tax': c['prior_tax'] or None, 'prior_agi': c['prior_agi'] or None,
          'withheld_so_far': c['withheld_so_far'] or None,
          'per_check_self': c['self_per_paycheck'] or None, 'period_self': c['self_period'] or None,
          'per_check_partner': c['partner_per_paycheck'] or None, 'period_partner': c['partner_period'] or None}
    for k in range(1, 5):
        rc[f'paid_q{k}'] = c[f'paid_q{k}'] or None
    return rc


def derive_1(c):
    rc = rules_case(c)
    r = R.evaluate(rc)
    year, status, today = rc['year'], rc['filing_status'], date.fromisoformat(rc['today'])
    tax = r['tax']
    # the generator keeps these equal; the README explains why there is no column for them
    assert r['law_tax_with_niit'] == tax, c['case_id']          # interest at or under the 1411 thresholds
    assert r['withholding_law'] == r['withholding'], c['case_id']  # partner paychecks only on joint returns
    assert r['due_page'] == r['due_law'], c['case_id']          # Patriots' Day never reaches April 15 in 2025-2026
    req = R.required_annual_payment(year, status, tax, rc['prior_tax'], rc['prior_agi'])
    assert req['required'] == r['required']
    names = [who for who in ('self', 'partner') if c[who + '_per_paycheck']]
    left = dict(zip(names, r['paychecks_left']))
    paid = [rc[f'paid_q{k}'] for k in range(1, 5)]
    stand = R.where_you_stand(today, r['due_page'], r['amount_by_estimates'], paid)
    lp = stand['last_past_due']
    kind, idx, dollars, ambiguous = r['w4']
    out = {
        'total_tax': tax, 'required': r['required'], 'ninety': R.CURRENT_YEAR_SHARE * tax,
        'prior_share': None if req['prior_share'] is None else req['prior_share'] * R._F(rc['prior_tax']),
        'prior_pct': None if req['prior_share'] is None else int(req['prior_share'] * 100),
        'basis': 'last year' if req['basis'].endswith('last year') else 'this year',
        'withholding': r['withholding'], 'has_figures': r['has_withholding'],
        'left_self': left.get('self'), 'left_partner': left.get('partner'),
        'needs': r['estimates_needed'], 'needs_amount_only': r['estimates_needed_amount_only'],
        'amount': r['amount_by_estimates'], 'per_quarter': r['shares'][0],
        'paid': r['total_paid'], 'remaining': r['remaining'], 'behind': r['behind'], 'last_past': lp,
        'overdue_due': r['due_law'][lp - 1] if lp and r['behind'] > 0 else None,
        'next_quarter': r['next_quarter'], 'next_due': r['next_due'],
        'next_amount': r['next_amount'] if r['next_quarter'] else None,
        'balance': r['balance'], 'verdict': r['verdict'],
        'sugg_kind': kind, 'sugg_person': None if idx is None else names[idx], 'sugg_amount': dollars,
        'sugg_ambiguous': ambiguous,
        'flag_wh': r['page_flag_withholding'], 'flag_est': r['page_flag_estimates'], 'law': r['law_flag'],
        'small': r['small_tax_exemption'], 'zero': r['zero_prior_exemption'],
        'law_quarters': tuple(j for j, _ in r['law_underpaid']),
        'law_short': tuple(a for _, a in r['law_underpaid']),
        'tolerance_sensitive': r['tolerance_sensitive'], 'tax_table_tax': r['tax_table_tax'],
    }
    for k in range(4):
        out[f'due{k + 1}'] = r['due_law'][k]
        out[f'cum{k + 1}'] = r['shares'][k]
        out[f'status{k + 1}'] = r['status'][k]
    return out


# ======================================== derivation 2: integers ========================================
# Money is an int of 1e-8 dollar. Inputs have at most cents, the tax at most 1e-4 (cents x a whole percent), 90% of it
# 1e-5, a quarter of that 2.5e-6: every value below is a whole number of units, and exact_div() proves it.
U = 10 ** 8
PER_YEAR_2 = {'weekly': 52, 'biweekly': 26, 'semimonthly': 24, 'monthly': 12}   # the page: "52/26/24/12 a year"


def un(s):
    """'1234.56' -> int units; '' -> None."""
    if s is None or s == '':
        return None
    v = fr(s) * U
    assert v.denominator == 1, s
    return int(v)


def exact_div(n, d):
    q, r = divmod(n, d)
    assert r == 0, (n, d)
    return q


def as_dollars(x):
    return None if x is None else F(x, U)


def tax_on_taxable_2(year, status, ti):
    """The procedure's own form: 'Over $X but not over $Y: $Z plus N% of the excess over $X'."""
    tops = [t * U for t in R.BRACKET_TOPS[year][status]]
    k = bisect_left(tops, ti)                    # ti <= tops[k]: the 'not over' row
    bottom = tops[k - 1] if k else 0
    return un(R.RP_BASE[year][status][k]) + exact_div(R.RATES[k] * (ti - bottom), 100)


def tax_table_2(year, status, ti):
    """Under $100,000 the Form 1040 Tax Table: the formula at the middle of the row, to the whole dollar, half up."""
    if ti >= 100000 * U:
        return tax_on_taxable_2(year, status, ti)
    if ti < 5 * U:
        return 0
    if ti < 15 * U:
        mid = 10 * U
    elif ti < 25 * U:
        mid = 20 * U
    elif ti < 3000 * U:
        mid = ti // (25 * U) * (25 * U) + 25 * U // 2
    else:
        mid = ti // (50 * U) * (50 * U) + 25 * U
    t = tax_on_taxable_2(year, status, mid)
    return (t + U // 2) // U * U


FIXED_2 = {(1, 1): "New Year's Day", (4, 16): 'Emancipation Day', (6, 19): 'Juneteenth', (7, 4): 'Independence Day',
           (11, 11): 'Veterans Day', (12, 25): 'Christmas Day'}


def holiday_2(d):
    """Name of the D.C. legal holiday on weekday d, or None; tested against the day itself (D.C. Code 28-2701 read as
    predicates)."""
    wd, m, day = d.weekday(), d.month, d.day
    if wd >= 5:
        return None
    if (m, day) in FIXED_2:
        return FIXED_2[(m, day)]
    if wd == 4:                                   # Friday before a fixed holiday on Saturday
        n = d + timedelta(days=1)
        if (n.month, n.day) in FIXED_2:
            return FIXED_2[(n.month, n.day)] + ' (observed)'
    if wd == 0:                                   # Monday after a fixed holiday on Sunday
        p = d - timedelta(days=1)
        if (p.month, p.day) in FIXED_2:
            return FIXED_2[(p.month, p.day)] + ' (observed)'
        if m == 1 and 15 <= day <= 21 and MUT != 'king_not_holiday':
            return 'King'
        if m == 2 and 15 <= day <= 21:
            return 'Washington'
        if m == 5 and day >= 25:
            return 'Memorial Day'
        if m == 9 and day <= 7:
            return 'Labor Day'
        if m == 10 and 8 <= day <= 14:
            return "Indigenous Peoples' Day"
    if wd == 3 and m == 11 and 22 <= day <= 28:
        return 'Thanksgiving'
    if d.year % 4 == 1 and m == 1 and (day == 20 or (day == 21 and wd == 0)):   # 1965 + 4k; Sunday -> Monday
        return 'Inauguration Day'
    return None


def patriots_2(d):
    return d.month == 4 and d.weekday() == 0 and 15 <= d.day <= 21


def nominal_2(year, q):
    return date(year + 1, 1, 15) if q == 4 else date(year, (4, 6, 9)[q - 1], 15)


def roll_2(d, patriots=False):
    """First day on or after d that is not a weekend day, a D.C. holiday or (patriots) Patriots' Day. Returns the
    day and the list of (day skipped, kind) with kind Saturday / Sunday / holiday / patriots."""
    skipped = []
    while True:
        wd = d.weekday()
        if wd == 5:
            skipped.append((d, 'Saturday'))
        elif wd == 6:
            skipped.append((d, 'Sunday'))
        elif holiday_2(d):
            skipped.append((d, 'holiday'))
        elif patriots and patriots_2(d):
            skipped.append((d, 'patriots'))
        else:
            return d, skipped
        d += timedelta(days=1)


def due_2(year, q, state, page):
    pat = q == 1 and state in ('MA', 'ME') and (page or MUT == 'patriots_in_law')
    return roll_2(nominal_2(year, q), pat)


def jan31_2(year):
    return roll_2(date(year + 1, 1, 31))[0]


def left_2(today, year, period):
    n = PER_YEAR_2[period]
    days = date(year, 12, 31).toordinal() - today.toordinal()
    if days <= 0:
        return 0
    if MUT == 'paychecks_365':
        return min(n, days * n // 365)
    return min(n, days * n * 4 // 1461)


def derive_2(c):
    year, status, state = int(c['year']), c['filing_status'], c['state']
    today = date.fromisoformat(c['today'])
    sd = R.STANDARD_DEDUCTION[year][status] * U
    income = un(c['other_income'])
    returns = 2 if status == 'married_separate' and len(c['adults'].split('|')) == 2 else 1   # separate: two returns, half the interest each
    ti = max(0, exact_div(income, returns) - sd)
    tax = tax_on_taxable_2(year, status, ti)
    if returns == 2:                             # each spouse's return to the cent, then the two added
        tax = 2 * rhu(F(tax, U // 100)) * (U // 100)
    ninety = exact_div(9 * tax, 10)
    pt, pa = un(c['prior_tax']), un(c['prior_agi'])
    if pt is None and MUT == 'blank_prior_is_zero':
        pt = 0
    if pt is None:
        req, basis, pct, prior_amt = ninety, 'this year', None, None
    else:
        line = (150000 if (status != 'married_separate' or MUT == 'mfs_line_150k') else 75000) * U
        over = pa is not None and (pa >= line if MUT == 'agi_line_inclusive' else pa > line)
        pct = 110 if over else 100
        prior_amt = exact_div(pt * pct, 100)
        req, basis = (prior_amt, 'last year') if prior_amt <= ninety else (ninety, 'this year')

    # withholding (one household 'so far' figure; per person paychecks)
    sofar = un(c['withheld_so_far'])
    if sofar == 0 and MUT == 'zero_so_far_is_blank':
        sofar = None
    people = [(who, un(c[who + '_per_paycheck']), c[who + '_period']) for who in ('self', 'partner')
              if c[who + '_per_paycheck']]
    lefts = {who: left_2(today, year, period) for who, _, period in people}
    if sofar is None:
        w = sum(per * PER_YEAR_2[period] for _, per, period in people)
    else:
        w = sofar + sum(per * lefts[who] for who, per, _ in people)
    has = sofar is not None or bool(people)

    # the schedule
    amount = max(0, req - w)
    quarter = exact_div(amount, 4)
    cum = [quarter * k for k in (1, 2, 3, 4)]
    page_dues = [due_2(year, q, state, True)[0] for q in (1, 2, 3, 4)]
    law_dues = [due_2(year, q, state, False)[0] for q in (1, 2, 3, 4)]
    pays = [un(c[f'paid_q{k}']) or 0 for k in (1, 2, 3, 4)]
    P = sum(pays)
    remaining = max(0, amount - P)
    npast = sum(1 for d in page_dues if d < today)          # the due dates rise, so past due is a prefix
    behind = min(remaining, max(0, cum[npast - 1] - P)) if npast else 0
    tol = 0 if MUT == 'no_tolerance' else U
    covered = [P + tol >= s for s in cum]
    nxt = next((k for k in range(npast, 4) if not covered[k]), None)
    status_q = []
    for k, d in enumerate(page_dues):
        if covered[k]:
            status_q.append('paid')
        elif k < npast:
            status_q.append('short')
        elif (MUT == 'due_status_30_days' and (d - today).days <= 30) or \
                (MUT != 'due_status_30_days' and d.year == today.year and d.month == today.month):
            status_q.append('due')
        else:
            status_q.append('upcoming')
    sensitive = any(s > 0 and s - U <= P < s for s in cum)
    late = any(sum(pays[:k + 1]) + tol < cum[k] for k in range(npast))   # a past-due quarter short on its own date

    # balance, verdict, W-4
    balance = tax - w - P
    if not has:
        verdict = 'unknown'
    elif (abs(balance) <= 500 * U) if MUT == 'about_right_inclusive' else (abs(balance) < 500 * U):
        verdict = 'about right'
    else:
        verdict = 'owe' if balance > 0 else 'refund'
    first = next(((who, lefts[who]) for who, _, _ in people if lefts[who] > 0), None)
    sugg = (None, None, None, False)
    if verdict == 'owe':
        if first is None:
            sugg = ('use estimates', None, None, bool(people))
        else:
            sugg = ('more', first[0], -((-balance) // (first[1] * U)), False)
    elif verdict == 'refund' and first is not None:
        sugg = ('less', first[0], (-balance) // (first[1] * U), False)

    # the law and the flags
    credit = w + (P if MUT == 'small_tax_counts_estimates' else 0)
    small = tax - credit < 1000 * U
    zero = pt is not None and pt == 0
    needs = amount > 0 and not small
    law_q, law_s = [], []
    gap = req - w
    for j in (1, 2, 3, 4):
        if not today > law_dues[j - 1]:
            continue
        boxes = P if MUT == 'catchup_cures_law' else sum(pays[:j])
        need = exact_div(gap * j, 4)
        if boxes < need:
            law_q.append(j)
            law_s.append(need - boxes)
    out = {
        'total_tax': tax, 'required': req, 'ninety': ninety, 'prior_share': prior_amt, 'prior_pct': pct,
        'basis': basis, 'withholding': w, 'has_figures': has,
        'left_self': lefts.get('self'), 'left_partner': lefts.get('partner'),
        'needs': needs, 'needs_amount_only': amount > 0, 'amount': amount, 'per_quarter': quarter,
        'paid': P, 'remaining': remaining, 'behind': behind, 'last_past': npast,
        'overdue_due': law_dues[npast - 1] if npast and behind > 0 else None,
        'next_quarter': None if nxt is None else nxt + 1, 'next_due': None if nxt is None else page_dues[nxt],
        'next_amount': None if nxt is None else min(remaining, max(0, cum[nxt] - P - behind)),
        'balance': balance, 'verdict': verdict,
        'sugg_kind': sugg[0], 'sugg_person': sugg[1], 'sugg_amount': sugg[2], 'sugg_ambiguous': sugg[3],
        'flag_wh': has and tax - w >= 1000 * U and w + P < req,   # the $1,000 test on tax less withholding only (6654(e)(1))
        'flag_est': needs and P + U < amount and late,
        'law': (not small) and (not zero) and bool(law_q),
        'small': small, 'zero': zero, 'law_quarters': tuple(law_q), 'law_short': tuple(law_s),
        'tolerance_sensitive': sensitive, 'tax_table_tax': returns * tax_table_2(year, status, ti),
        'page_dues': page_dues,
    }
    for k in range(4):
        out[f'due{k + 1}'] = law_dues[k]
        out[f'cum{k + 1}'] = cum[k]
        out[f'status{k + 1}'] = status_q[k]
    return out


MONEY_KEYS = ('total_tax', 'required', 'ninety', 'prior_share', 'withholding', 'amount', 'per_quarter', 'cum1',
              'cum2', 'cum3', 'cum4', 'paid', 'remaining', 'behind', 'next_amount', 'balance', 'tax_table_tax')
EXACT_KEYS = ('prior_pct', 'basis', 'has_figures', 'left_self', 'left_partner', 'needs', 'needs_amount_only',
              'due1', 'due2', 'due3', 'due4', 'status1', 'status2', 'status3', 'status4', 'last_past', 'overdue_due',
              'next_quarter', 'next_due', 'verdict', 'sugg_kind', 'sugg_person', 'sugg_amount', 'sugg_ambiguous',
              'flag_wh', 'flag_est', 'law', 'small', 'zero', 'law_quarters', 'tolerance_sensitive')


def compare_household(guard, c, d1, d2):
    where = c['case_id']
    d2m = {k: as_dollars(d2[k]) for k in MONEY_KEYS}
    for k in EXACT_KEYS:
        guard.same(where, k, d1[k], d2[k])
    for k in MONEY_KEYS:
        guard.money(where, k, d1[k], d2m[k])
    for j, a, b in zip(d1['law_quarters'], d1['law_short'], d2['law_short']):
        guard.money(where, f'law shortfall q{j}', a, as_dollars(b))
    guard.same(where, 'page dues = law dues', tuple(d2['page_dues']), tuple(d1[f'due{k}'] for k in (1, 2, 3, 4)))


# ======================================== cases ========================================

INPUT_KEYS = ('case_id', 'year', 'today', 'state', 'filing_status', 'adults', 'other_income', 'prior_tax', 'prior_agi',
              'withheld_so_far', 'self_per_paycheck', 'self_period', 'partner_per_paycheck', 'partner_period',
              'paid_q1', 'paid_q2', 'paid_q3', 'paid_q4')


def make(year, today, state, status, births, income, prior_tax=None, prior_agi=None, so_far=None, self_per=None,
         self_period='', partner_per=None, partner_period='', paid=(None, None, None, None), note=''):
    if isinstance(births, str):
        births = [births]
    assert status in STATUSES and state in STATE_CODES
    assert (self_per is None) == (self_period == '') and (partner_per is None) == (partner_period == '')
    assert partner_per is None or status == 'married_joint'   # the law credits a separate return with its own only
    c = {'case_id': '', 'year': str(year), 'today': iso(today) if isinstance(today, date) else today, 'state': state,
         'filing_status': status, 'adults': '|'.join(births), 'other_income': money_in(income),
         'prior_tax': money_in(prior_tax), 'prior_agi': money_in(prior_agi), 'withheld_so_far': money_in(so_far),
         'self_per_paycheck': money_in(self_per), 'self_period': self_period,
         'partner_per_paycheck': money_in(partner_per), 'partner_period': partner_period, 'note': note}
    for k in range(4):
        c[f'paid_q{k + 1}'] = money_in(paid[k])
    return c


def d(s):
    return date.fromisoformat(s)


def tax_of(year, status, income):
    return R.case_tax(year, status, fr(income))


def left_of(today, year, period):
    return R.paychecks_left(d(today) if isinstance(today, str) else today, year, period)


def edge_cases():
    E = []
    add = E.append
    # ---- RULES.md section 9, worked by hand (rows est-edge-001 to -011) ----
    c1 = dict(year=2026, today='2026-10-31', state='OR', status='married_joint', births=['1964-05-10', '1966-02-03'],
              income='250000', prior_tax='30000', prior_agi='210000')
    add(make(**c1, paid=('8250', '8250', '8250', None), note='RULES.md 9.1 retired couple: 110% of last year; next $8,250 by Jan 15, 2027'))
    add(make(**c1, paid=('7500', '7500', '7500', None), note='RULES.md 9.1 paying 100% instead: page Q3 short, law Q1-Q3 short'))
    add(make(**dict(c1, prior_agi='150000'), paid=('8250', '8250', '8250', None), note='RULES.md 9.1 with last-year AGI exactly $150,000: 100% ($30,000)'))
    c2 = dict(year=2026, today='2026-07-20', state='TX', status='single', births='1985-09-14', income='90000',
              prior_tax='12000', prior_agi='85000')
    add(make(**c2, note='RULES.md 9.2 skipped Q1 and Q2, seen July 20: behind $4,936.50, next $2,468.25 by Sep 15'))
    add(make(**c2, paid=(None, None, '4936.50', None), note='RULES.md 9.2 catch-up typed in the Q3 box: page Q1 and Q2 paid, behind 0; page flag and law still on'))
    c3 = dict(year=2026, state='MA', status='single', births='1975-11-30', income='52000', prior_tax='4200',
              prior_agi='50000', self_period='monthly')
    add(make(**c3, today='2026-10-01', so_far='1350', self_per='150', paid=('700', '760', None, None),
             note='RULES.md 9.3 $950 balance: W-4 +$475; withholding flag off; Q3 short $43 (page and law)'))
    add(make(**c3, today='2026-10-01', so_far='1350', self_per='625', paid=('700', '760', None, None),
             note='RULES.md 9.3 after the W-4 advice: balance 0, nothing underpaid'))
    add(make(**c3, today='2026-08-01', so_far='1050', self_per='150', paid=('700', '760', None, None),
             note='RULES.md 9.3 seen August 1: 4 paychecks left, W-4 +$238, no flag yet'))
    c4 = dict(year=2026, today='2026-06-20', state='ME', status='head_of_household', births='1990-04-04', income='60000')
    add(make(**c4, prior_tax='0', prior_agi='20000', note='RULES.md 9.4 last year tax 0: nothing required (6654(e)(2))'))
    add(make(**c4, note='RULES.md 9.4 last year left blank: 90% = $3,553.20 required'))
    add(make(**dict(c1, prior_agi='150000.01'), paid=('8250', '8250', '8250', None), note='RULES.md 9.1 with last-year AGI $150,000.01: 110%'))

    # ---- last-year AGI on both sides of $150,000 and $75,000 ----
    for year in HOUSEHOLD_YEARS:
        for status, income, agis, births in (
                ('single', '125000', ('150000', '150000.01', '75000.01'), ['1971-03-03']),
                ('married_joint', '200000', ('150000', '150000.01'), ['1968-07-07', '1970-01-30']),
                ('head_of_household', '150000', ('150000', '150000.01'), ['1983-12-12']),
                ('married_separate', '125000', ('75000', '75000.01', '150000'), ['1979-05-05', '1980-06-06'])):
            for agi in agis:
                line = '$75,000' if status == 'married_separate' else '$150,000'
                pct = 110 if fr(agi) > (75000 if status == 'married_separate' else 150000) else 100
                add(make(year, date(year, 4, 16), 'NY', status, births, income, prior_tax='15000', prior_agi=agi,
                         note=f'last-year AGI {money(fr(agi))} for {status} (line {line}): {pct}% of last year'))

    # ---- last-year tax: zero, blank, tie and tiny ----
    s26 = dict(year=2026, state='WA', status='single', births='1988-08-08', income='52000')   # tax 4,060; 90% 3,654
    add(make(**s26, today='2026-07-01', prior_tax='0', note='last-year tax 0 with AGI blank: zero-tax exemption, nothing required'))
    add(make(**s26, today='2026-07-01', prior_agi='500000', note='last-year tax blank, AGI typed: AGI ignored, 90% of this year'))
    add(make(**s26, today='2026-07-01', prior_tax='3000', note='last-year tax typed, AGI blank: 100% of last year'))
    add(make(**s26, today='2026-07-01', prior_tax='3654', prior_agi='40000', note='tie: 100% of last year = 90% of this year; basis last year (the same amount either way)'))
    add(make(**s26, today='2026-07-01', prior_tax='3654.01', prior_agi='40000', note='last year a cent above 90% of this year: basis this year'))
    add(make(**s26, today='2026-07-01', prior_tax='3653.99', prior_agi='40000', note='last year a cent under: basis last year'))
    add(make(**s26, today='2026-07-01', prior_tax='4', prior_agi='40000',
             note='last-year tax $4: installments of $1; page Q1 paid (within the $1 tolerance), Q2 short, behind $2; '
                  'the law: Q1 $1 and Q2 $2 short; tolerance-sensitive'))
    add(make(2026, '2026-10-01', 'NJ', 'married_joint', ['1966-02-02', '1967-03-03'], '120000', prior_tax='0',
             prior_agi='30000', so_far='3000', self_per='250', self_period='biweekly',
             note='last-year tax 0, owing at filing: no estimates, no exposure, W-4 more'))

    # ---- the $1,000 test (6654(e)(1)): tax - withholding 999.99 / 1,000.00 ----
    for target, label in (('3060.01', '999.99: under $1,000, no exposure, no estimates needed'),
                          ('3060.00', '1,000.00: not under $1,000, exposure on')):
        so_far = fr(target) - 200 * left_of('2026-10-01', 2026, 'monthly')
        add(make(**s26, today='2026-10-01', so_far=so_far, self_per='200', self_period='monthly',
                 note=f'tax 4,060 - withholding {target} = {label}'))
    # ---- the withholding page's flag: balance 999.99 / 1,000.00 with withholding + estimates under the safe amount ----
    for q2, label in (('705.01', '999.99: withholding flag off'), ('705.00', '1,000.00: withholding flag on')):
        add(make(**s26, today='2026-10-01', so_far='1350', self_per='150', self_period='monthly',
                 paid=('705', q2, None, None), note=f'balance at filing {label}'))
    # ---- verdict lines: 500.00 / 499.99 / -499.99 / -500.00 ----
    for w, label in (('3560', '500.00: owe'), ('3560.01', '499.99: about right'), ('4559.99', '-499.99: about right'),
                     ('4560', '-500.00: refund')):
        so_far = fr(w) - 200 * left_of('2026-10-01', 2026, 'monthly')
        add(make(**s26, today='2026-10-01', so_far=so_far, self_per='200', self_period='monthly',
                 note=f'balance {label}'))

    # ---- the $1 tolerance (shares 913.50 / 1,827.00 / 2,740.50 / 3,654.00; Q1, Q2 past due on July 1) ----
    add(make(**s26, today='2026-07-01', paid=('913.50', '912.50', None, None),
             note='paid $1.00 under the Q2 share: Q2 paid (tolerance) yet $1.00 behind; tolerance-sensitive'))
    add(make(**s26, today='2026-07-01', paid=('913.50', '912.49', None, None),
             note='paid $1.01 under the Q2 share (just outside the tolerance): Q2 short, behind $1.01'))
    add(make(**s26, today='2026-07-01', paid=('913.50', '913.50', '913', None),
             note='paid $0.50 under the Q3 share before Sep 15: Q3 counts as covered, next is Q4 $914; tolerance-sensitive'))
    add(make(**s26, today='2026-07-01', paid=('913.50', '913.50', None, None), note='paid exactly the Q2 share'))

    # ---- 'today' on and around every due date (2025: Jun 15 is a Sunday, due Jun 16) ----
    s25 = dict(year=2025, state='FL', status='single', births='1979-10-10', income='80000')   # tax 9,049; 90% 8,144.10
    dues25 = R.due_dates(2025)
    for t in ('2025-01-01', '2025-04-14', '2025-04-15', '2025-04-16', '2025-05-31', '2025-06-01', '2025-06-15',
              '2025-06-16', '2025-06-17', '2025-09-15', '2025-09-16', '2025-12-31', '2026-01-01', '2026-01-14',
              '2026-01-15', '2026-01-16', '2026-01-31'):
        add(make(**s25, today=t, note=f'today {t}, nothing paid; shares 2,036.025 / 4,072.05 / 6,108.075 / 8,144.10 (half cents)'))
        paid = tuple('2036.03' if dq <= d(t) else None for dq in dues25)
        add(make(**s25, today=t, paid=paid, note=f'today {t}, $2,036.03 paid by each due date reached'))
    s26j = dict(year=2026, state='CO', status='single', births='1984-04-04', income='70000')
    for t, sf in (('2026-01-01', None), ('2026-01-01', '0'), ('2026-12-31', '3900'), ('2026-12-31', None),
                  ('2027-01-01', '3900'), ('2027-01-15', '3900'), ('2027-01-16', None), ('2027-01-31', '3900')):
        add(make(**s26j, today=t, so_far=sf, self_per='150', self_period='weekly',
                 note=f'today {t}, weekly $150, withheld so far {"blank (a full year)" if sf is None else sf}'))

    # ---- withholding shapes ----
    add(make(**s26, today='2026-10-01', so_far='0', self_per='150', self_period='monthly',
             note="withheld so far typed 0: 0 + 150 x 2, not a full year"))
    add(make(**s26, today='2026-10-01', self_per='150', self_period='monthly',
             note='withheld so far blank: a full year, 150 x 12'))
    add(make(**s26, today='2026-10-01', so_far='1500', note="withheld so far only, nothing from pay: owe -> use estimates"))
    mj = dict(year=2026, state='DC', status='married_joint', births=['1980-01-15', '1982-11-20'], income='120000')
    add(make(**mj, today='2026-08-15', so_far='4000', partner_per='300', partner_period='biweekly',
             note="only the partner's pay: the W-4 change goes to the partner"))
    add(make(**mj, today='2026-06-30', so_far='3000', self_per='120', self_period='weekly', partner_per='180',
             partner_period='semimonthly', note='both paychecks, different periods'))
    add(make(**mj, today='2026-06-30', self_per='120', self_period='weekly', partner_per='180',
             partner_period='semimonthly', note='both paychecks, nothing so far: a full year for each'))
    add(make(**s26, today='2026-09-01', so_far='4000', self_per='200', self_period='monthly',
             note='refund $540: W-4 floor(540 / 3) = $180 less'))
    add(make(**s26, today='2026-10-01', so_far='860', self_per='100', self_period='monthly',
             note='owe exactly $3,000 over 2 paychecks: +$1,500'))
    add(make(**s26, today='2026-12-31', so_far='2000', self_per='100', self_period='monthly',
             note='December 31: no paycheck left; owe -> use estimates (suggestion ambiguous)'))
    add(make(**s26, today='2027-01-10', self_per='100', self_period='monthly',
             note='January after the year, so far blank: a full year at the per-paycheck rate'))
    add(make(**s26, today='2026-10-01', so_far='3500', self_per='200', self_period='monthly',
             note='withholding above the safe amount: nothing to pay by estimates'))
    add(make(**s26, today='2026-01-01', so_far='1000', self_per='50', self_period='weekly',
             note='January 1: 51 weekly paychecks left (364 x 52 / 365.25 = 51.8)'))

    # ---- estimated payments: early, over, all on time, lump, zero typed, late ----
    add(make(**s26, today='2026-03-01', paid=(None, '1000', None, None),
             note='a Q2 payment typed in March counts now: Q1 covered, next Q2 $827'))
    add(make(**s26, today='2026-07-01', paid=('2000', '2000', None, None), note='overpaid: nothing remaining, no next payment'))
    add(make(**s26, today='2027-01-20', paid=('913.50', '913.50', '913.50', '913.50'), note='all four on time'))
    add(make(**s26, today='2027-01-20', paid=(None, None, None, '3654'),
             note='everything in the January box: page all paid, the law Q1-Q3 underpaid'))
    add(make(**s26, today='2026-07-01', paid=('0', '1827', None, None), note='Q1 typed 0, Q2 catch-up: page paid, law Q1 short'))
    add(make(**s26, today='2026-06-20', paid=(None, '1827', None, None), note='Q1 skipped, caught up on Q2: law Q1 short'))

    # ---- income edges ----
    add(make(**dict(s26, income='0'), today='2026-07-01', note='no income: tax 0'))
    add(make(**dict(s26, income='16100'), today='2026-07-01', note='income = standard deduction: tax 0'))
    add(make(**dict(s26, income='16100.01'), today='2026-07-01', note='a cent over the standard deduction: tax $0.001, written 0.00; every later figure is a fraction of a '
                  'cent (behind $0.00045 is written 0.00 but still has an overdue date); tolerance-sensitive'))
    add(make(**dict(s26, income='66500'), today='2026-07-01', note='taxable income exactly at the 12% top ($50,400): tax $5,800'))
    for year, status, inc, births in ((2025, 'single', '200000', ['1970-02-02']),
                                      (2026, 'married_joint', '250000', ['1969-03-03', '1971-04-04']),
                                      (2025, 'married_separate', '125000', ['1975-05-05']),
                                      (2026, 'head_of_household', '200000', ['1981-06-06'])):
        add(make(year, date(year, 9, 16), 'IL', status, births, inc, note=f'interest exactly at the investment income tax line ({inc}): no NIIT'))

    # ---- births at the edges ----
    add(make(2025, '2025-05-01', 'AZ', 'single', '1961-01-02', '40000', note='born Jan 2, 1961: 64 at the end of 2025 (not 65)'))
    add(make(2026, '2026-05-01', 'AZ', 'married_joint', ['1962-01-02', '1995-12-31'], '90000', note='born Jan 2, 1962 and Dec 31, 1995'))

    # ---- holidays in April (no effect in 2025-2026) ----
    for year, t, state, note in ((2026, '2026-04-15', 'MA', 'MA, today Apr 15, 2026: Q1 due today'),
                                 (2026, '2026-04-16', 'MA', 'MA, today Apr 16, 2026 (Emancipation Day): Q1 past due'),
                                 (2026, '2026-04-20', 'ME', "ME, today Apr 20, 2026 (Patriots' Day): Q1 past due"),
                                 (2025, '2025-04-21', 'ME', "ME, today Apr 21, 2025 (Patriots' Day): Q1 past due"),
                                 (2025, '2025-04-16', 'DC', 'DC, today Apr 16, 2025 (Emancipation Day): Q1 past due')):
        add(make(year, t, state, 'single', '1977-07-07', '65000', prior_tax='5000', prior_agi='60000', note=note))
    return E


# ---- random rows ----

def pick(rng, weighted):
    total = sum(w for _, w in weighted)
    x = rng.randrange(total)
    for v, w in weighted:
        if x < w:
            return v
        x -= w
    raise AssertionError


def draw_cents(rng, lo_cents, hi_cents, p_whole=0.7):
    """Uniform in [lo, hi] (integer cents): whole dollars with probability p_whole, else cents."""
    if rng.random() < p_whole:
        lo, hi = -((-lo_cents) // 100), hi_cents // 100
        if lo <= hi:
            return F(rng.randint(lo, hi))
    return F(rng.randint(lo_cents, hi_cents), 100)


def random_state(rng):
    r = rng.random()
    if r < 0.12:
        return 'MA'
    if r < 0.24:
        return 'ME'
    if r < 0.34:
        return 'DC'
    if r < 0.44:
        return 'CA'
    return rng.choice(OTHER_STATES)


def random_birth(rng, year):
    lo = max(date(1960, 1, 1), date(year - 64, 1, 2))     # nobody 65 or older at the end of the year
    hi = date(1995, 12, 31)
    if rng.random() < 0.08:
        return lo + timedelta(days=rng.randint(0, 30))
    return lo + timedelta(days=rng.randint(0, (hi - lo).days))


def random_today(rng, year):
    dues = R.due_dates(year)
    r = rng.random()
    q = rng.randrange(4)
    if r < 0.22:
        return dues[q]
    if r < 0.34:
        return dues[q] + timedelta(days=1)
    if r < 0.39:
        return dues[q] - timedelta(days=1)
    if r < 0.48:
        return date(year + 1, 1, rng.randint(1, 14))
    if r < 0.52:
        return date(year + 1, 1, rng.randint(16, 31))
    if r < 0.56:
        return date(year, 1, 1)
    if r < 0.60:
        return date(year, 12, 31)
    return date(year, 1, 1) + timedelta(days=rng.randint(0, 364))


def random_income(rng, year, status):
    sd = R.STANDARD_DEDUCTION[year][status] * 100
    cap = R.NIIT_THRESHOLD[status] * 100            # at or under the 1411 line: the case's tax is the law's
    r = rng.random()
    if r < 0.03:
        return F(0)
    if r < 0.08:
        return draw_cents(rng, 0, sd)
    if r < 0.55:
        return draw_cents(rng, sd, min(cap, sd + 6000000))
    return draw_cents(rng, sd, cap)


def random_prior(rng, tax):
    r = rng.random()
    if r < 0.20:
        agi = draw_cents(rng, 1000000, 40000000) if rng.random() < 0.10 else None
        return None, agi, 'blank'
    if r < 0.30:
        pt, kind = F(0), 'zero'
    elif r < 0.45:
        pt, kind = draw_cents(rng, 100, 199999, 0.5), 'small'
    elif r < 0.85:
        pt, kind = round_cents(tax * F(rng.randint(600, 1400), 1000)), 'near this year'
        if rng.random() < 0.7:
            pt = F(rhu(pt))
    else:
        pt, kind = round_cents(tax * F(rng.randint(1500, 3000), 1000)) + draw_cents(rng, 0, 2000000), 'large'
    a = rng.random()
    if a < 0.08:
        agi = None
    elif a < 0.22:
        agi = fr(rng.choice(('75000', '75000.01', '150000', '150000.01')))
    else:
        b = rng.random()
        if b < 0.35:
            agi = draw_cents(rng, 500000, 7499999)
        elif b < 0.65:
            agi = draw_cents(rng, 7500002, 14999999)
        else:
            agi = draw_cents(rng, 15000002, 40000000)
    return pt, agi, kind


def random_withholding(rng, year, status, today, tax):
    """None, or dict(so_far, self=(per, period)|None, partner=(per, period)|None)."""
    if rng.random() < 0.40:
        return None
    who = ['self']
    if status == 'married_joint':
        r = rng.random()
        who = ['self'] if r < 0.5 else (['self', 'partner'] if r < 0.85 else ['partner'])
    target = tax * F(rng.randint(0, 1300), 1000)
    split = F(rng.randint(20, 80), 100) if len(who) == 2 else F(1)
    out = {'self': None, 'partner': None}
    elapsed = F(0)
    for i, w in enumerate(who):
        period = pick(rng, (('weekly', 20), ('biweekly', 40), ('semimonthly', 20), ('monthly', 20)))
        n = R.PAYCHECKS_PER_YEAR[period]
        part = target * (split if i == 0 else 1 - split)
        per = part / n
        per = ceil_cents(per) if rng.random() < 0.5 else ceil_dollars(per)
        per = max(per, F(1))
        out[w] = (per, period)
        elapsed += per * (n - R.paychecks_left(today, year, period))
    r = rng.random()
    if r < 0.65:
        out['so_far'] = F(0) if rng.random() < 0.07 else round_cents(elapsed * F(rng.randint(85, 115), 100))
    else:
        out['so_far'] = None
    return out


def random_payments(rng, today, dues, amount):
    q = amount / 4
    npast = sum(1 for x in dues if x < today)
    soon = npast if npast < 4 and (dues[npast] - today).days <= 45 else None
    paid = [None] * 4

    def up(x):
        v = ceil_cents(x) if rng.random() < 0.6 else ceil_dollars(x)
        return v if v > 0 else None
    r = rng.random()
    if r < 0.18 or (amount == 0 and r < 0.7):
        pattern = 'none'
        if amount == 0 and r >= 0.18 and rng.random() < 0.4:
            k = rng.randrange(4)
            paid[k] = draw_cents(rng, 10000, 300000)
            pattern = 'paid with nothing required'
    elif r < 0.40:
        pattern = 'on time'
        for k in range(npast):
            paid[k] = up(q)
        if soon is not None and rng.random() < 0.5:
            paid[soon] = up(q)
    elif r < 0.55:
        pattern = 'late'
        if npast:
            m = rng.randint(1, npast)
            for k in range(m, npast):
                paid[k] = up(q)
            if npast < 4 and rng.random() < 0.5:
                paid[npast] = up(q * (m + rng.choice((0, 1))))
    elif r < 0.70:
        pattern = 'short'
        for k in range(max(npast, 1)):
            v = round_cents(q * F(rng.randint(30, 97), 100))
            paid[k] = v if v > 0 else None
    elif r < 0.82:
        pattern = 'over'
        for k in range(max(npast, 1)):
            paid[k] = up(q * F(rng.randint(103, 200), 100)) if amount else draw_cents(rng, 10000, 300000)
    elif r < 0.90:
        pattern = 'lump'
        k = rng.randrange(4)
        paid[k] = up(amount * F(rng.randint(50, 120), 100)) if amount else draw_cents(rng, 50000, 500000)
    else:
        pattern = 'random'
        for k in range(4):
            if rng.random() < 0.5:
                paid[k] = draw_cents(rng, 0, rhu((2 * q + 500) * 100), 0.5)
    return paid, pattern


def random_case(rng):
    year = HOUSEHOLD_YEARS[rng.randrange(2)]
    status = pick(rng, (('single', 30), ('married_joint', 35), ('married_separate', 15), ('head_of_household', 20)))
    state = random_state(rng)
    n_adults = 2 if status == 'married_joint' else (2 if status == 'married_separate' and rng.random() < 0.4 else 1)
    births = [iso(random_birth(rng, year)) for _ in range(n_adults)]
    today = random_today(rng, year)
    income = random_income(rng, year, status)
    tax = R.case_tax(year, status, income, births)
    prior_tax, prior_agi, _ = random_prior(rng, tax)
    wh = random_withholding(rng, year, status, today, tax)
    kw = {}
    if wh:
        kw['so_far'] = wh['so_far']
        if wh['self']:
            kw['self_per'], kw['self_period'] = wh['self']
        if wh['partner']:
            kw['partner_per'], kw['partner_period'] = wh['partner']
    c0 = make(year, today, state, status, births, income, prior_tax=prior_tax, prior_agi=prior_agi, **kw)
    r0 = R.evaluate(rules_case(dict(c0, case_id='draft')))
    paid, pattern = random_payments(rng, today, list(r0['due_page']), r0['amount_by_estimates'])
    c = make(year, today, state, status, births, income, prior_tax=prior_tax, prior_agi=prior_agi, paid=paid, **kw)
    return c, pattern


def less_than_cut(c, d1):
    return d1['sugg_kind'] == 'less' and d1['sugg_amount'] > fr(c[d1['sugg_person'] + '_per_paycheck'])


def auto_note(c, d1):
    notes = []
    if less_than_cut(c, d1):
        notes.append("W-4 'less' is more than the per-paycheck amount (the page's formula has no cap)")
    if d1['sugg_ambiguous']:
        notes.append('suggestion ambiguous: a per-paycheck amount but no paycheck left; key says use estimates')
    if d1['needs_amount_only'] and not d1['needs']:
        notes.append('estimates not needed by the $1,000 test although the amount is above 0')
    if d1['law'] and not d1['flag_est']:
        notes.append("law exposure the estimates page does not flag")
    if d1['flag_est'] and not d1['law']:
        notes.append("estimates page flag the law does not share")
    return '; '.join(notes)


# ======================================== examples check (derivation 2) ========================================

def check_examples():
    """RULES.md section 9's hand-worked figures (and the 5.4 date table), reproduced by derivation 2 alone."""
    n = 0
    E = edge_cases()

    def run(i):
        return derive_2(dict(E[i], case_id=f'example-{i + 1}'))

    def eq(a, b, what):
        nonlocal n
        n += 1
        assert a == b, (what, a, b)

    def m(x):
        return un(str(x))

    def sts(r):
        return tuple(r[f'status{k}'] for k in (1, 2, 3, 4))

    r = run(0)                                                     # 9.1
    for k, v in (('total_tax', 37468), ('required', 33000), ('amount', 33000), ('behind', 0), ('next_amount', 8250),
                 ('balance', 12718), ('cum1', 8250), ('cum2', 16500), ('cum3', 24750), ('cum4', 33000)):
        eq(r[k], m(v), '9.1 ' + k)
    eq((r['basis'], r['prior_pct']), ('last year', 110), '9.1 basis')
    eq(sts(r), ('paid', 'paid', 'paid', 'upcoming'), '9.1 status')
    eq((r['next_quarter'], r['next_due']), (4, date(2027, 1, 15)), '9.1 next')
    eq(r['verdict'], 'unknown', '9.1 verdict')
    eq((r['flag_est'], r['flag_wh'], r['law'], r['law_quarters']), (False, False, False, ()), '9.1 flags')
    r = run(1)                                                     # 9.1 at 7,500 a quarter
    eq(sts(r), ('paid', 'paid', 'short', 'upcoming'), '9.1b status')
    eq((r['behind'], r['next_amount']), (m(2250), m(8250)), '9.1b behind, next')
    eq((r['law_quarters'], r['law_short']), ((1, 2, 3), (m(750), m(1500), m(2250))), '9.1b law')
    eq((r['flag_est'], r['law']), (True, True), '9.1b flags')
    r = run(2)                                                     # 9.1 with AGI exactly 150,000
    eq((r['required'], r['prior_pct']), (m(30000), 100), '9.1c required')
    r = run(10)                                                    # 9.1 with AGI 150,000.01
    eq((r['required'], r['prior_pct']), (m(33000), 110), '9.1d required')
    r = run(3)                                                     # 9.2
    eq((r['total_tax'], r['required'], r['basis']), (m(10970), m(9873), 'this year'), '9.2 tax')
    eq(tuple(r[f'cum{k}'] for k in (1, 2, 3, 4)), (m('2468.25'), m('4936.50'), m('7404.75'), m(9873)), '9.2 cum')
    eq(sts(r), ('short', 'short', 'upcoming', 'upcoming'), '9.2 status')
    eq((r['behind'], r['next_amount'], r['next_due']), (m('4936.50'), m('2468.25'), date(2026, 9, 15)), '9.2 next')
    eq((r['flag_est'], r['law'], r['law_quarters']), (True, True, (1, 2)), '9.2 flags')
    eq(r['tax_table_tax'], m(10976), '9.2 Tax Table')
    r = run(4)                                                     # 9.2 catch-up
    eq(sts(r), ('paid', 'paid', 'upcoming', 'upcoming'), '9.2b status')
    eq((r['behind'], r['next_quarter'], r['next_amount']), (0, 3, m('2468.25')), '9.2b next')
    eq((r['flag_est'], r['law'], r['law_quarters']), (True, True, (1, 2)), '9.2b flags')
    r = run(5)                                                     # 9.3
    eq((r['total_tax'], r['required'], r['left_self'], r['withholding']), (m(4060), m(3654), 2, m(1650)), '9.3 w')
    eq((r['balance'], r['verdict']), (m(950), 'owe'), '9.3 balance')
    eq((r['sugg_kind'], r['sugg_person'], r['sugg_amount']), ('more', 'self', 475), '9.3 W-4')
    eq((r['flag_wh'], r['amount']), (True, m(2004)), '9.3 amount')
    eq(sts(r), ('paid', 'paid', 'short', 'upcoming'), '9.3 status')
    eq((r['behind'], r['next_amount'], r['next_due']), (m(43), m(501), date(2027, 1, 15)), '9.3 next')
    eq((r['flag_est'], r['law'], r['law_quarters'], r['law_short'], r['small']), (True, True, (3,), (m(43),), False),
       '9.3 law')
    r = run(6)                                                     # 9.3 after the W-4 advice
    eq((r['withholding'], r['balance'], r['verdict']), (m(2600), 0, 'about right'), '9.3b')
    eq((r['law_quarters'], r['amount'], sts(r)), ((), m(1054), ('paid',) * 4), '9.3b schedule')
    r = run(7)                                                     # 9.3 seen August 1
    eq((r['left_self'], r['withholding'], r['balance'], r['sugg_amount']), (4, m(1650), m(950), 238), '9.3c')
    eq((r['law'], r['flag_est'], r['law_quarters']), (False, False, ()), '9.3c flags')
    r = run(8)                                                     # 9.4
    eq((r['total_tax'], r['required'], r['amount'], r['balance']), (m(3948), 0, 0, m(3948)), '9.4')
    eq((r['needs'], r['zero'], r['law'], r['flag_est'], sts(r)), (False, True, False, False, ('paid',) * 4), '9.4 flags')
    r = run(9)                                                     # 9.4 with a blank last year
    eq((r['required'], r['behind'], r['next_amount']), (m('3553.20'), m('1776.60'), m('888.30')), '9.4b')
    eq(sts(r), ('short', 'short', 'upcoming', 'upcoming'), '9.4b status')
    eq((r['flag_est'], r['law']), (True, True), '9.4b flags')
    # RULES.md 5.4: the due-date table, the January 31 option, and where page and law part (5.3)
    for y, ds in ((2025, ('2025-04-15', '2025-06-16', '2025-09-15', '2026-01-15')),
                  (2026, ('2026-04-15', '2026-06-15', '2026-09-15', '2027-01-15')),
                  (2027, ('2027-04-15', '2027-06-15', '2027-09-15', '2028-01-18'))):
        for q in (1, 2, 3, 4):
            for st in DATE_STATES:
                for page in (False, True):
                    eq(due_2(y, q, st, page)[0].isoformat(), ds[q - 1], f'5.4 {y} q{q} {st} page={page}')
    for y, ds in ((2025, '2026-02-02'), (2026, '2027-02-01'), (2027, '2028-01-31')):
        eq(jan31_2(y).isoformat(), ds, f'5.4 January 31 option {y}')
    eq(due_2(2024, 1, 'MA', True)[0].isoformat(), '2024-04-17', '5.3 page 2024 MA')
    eq(due_2(2024, 1, 'MA', False)[0].isoformat(), '2024-04-15', '5.3 law 2024 MA')
    eq([x[0].isoformat() for x in due_2(2027, 4, '', False)[1]], ['2028-01-15', '2028-01-16', '2028-01-17'], '5.4 skipped')
    # RULES.md 7: paychecks left
    for t, p, want in (('2026-07-01', 'biweekly', 13), ('2026-08-01', 'monthly', 4), ('2026-10-01', 'monthly', 2),
                       ('2026-01-01', 'weekly', 51)):
        eq(left_2(d(t), 2026, p), want, f'7 paychecks left {t} {p}')
    return n


# ======================================== dates.csv ========================================

DATES_COLUMNS = ['tax_year', 'state', 'quarter', 'statutory_date', 'statutory_weekday', 'due_law', 'due_law_weekday',
                 'law_moved_because', 'due_page', 'due_page_weekday', 'page_moved_because', 'page_differs',
                 'irs_printed', 'irs_source', 'jan31_option', 'jan31_option_weekday', 'jan31_irs_printed', 'note']
IRS_SOURCE = {   # (year, quarter 4?) -> where rules.IRS_DUE_DATES has the printed date from
    (2024, False): 'Form 1040-ES (2024); Instructions for Form 2210 (2024)',
    (2024, True): 'Form 1040-ES (2024); Instructions for Form 2210 (2024)',
    (2025, False): 'Form 1040-ES (2025)',
    (2025, True): 'Form 1040-ES (2025); Pub. 509 (2026)',
    (2026, False): 'Form 1040-ES (2026); Pub. 509 (2026)',
    (2026, True): 'Form 1040-ES (2026); Pub. 509 (2027) DRAFT',
    (2027, False): 'Pub. 509 (2027) DRAFT',
}
JAN31_SOURCE = {2025: 'Form 1040-ES (2025); Pub. 509 (2026)', 2026: 'Form 1040-ES (2026); Pub. 509 (2027) DRAFT'}


def kinds_1(why):
    """rules.py reasons ('2025-06-15 Sunday', '2028-01-17 Birthday of ...') -> [(date, kind)]."""
    out = []
    for w in why:
        day, text = w.split(' ', 1)
        kind = text if text in ('Saturday', 'Sunday') else ('patriots' if 'Patriots' in text else 'holiday')
        out.append((date.fromisoformat(day), kind))
    return out


def build_dates(guard):
    rows, stats = [], Counter()
    for y in DATE_YEARS:
        for st in DATE_STATES:
            for q in (1, 2, 3, 4):
                where = f'{y} {st or "-"} q{q}'
                law, law_why = R.due_date(y, q, st or None, 'law')
                page, page_why = R.due_date(y, q, st or None, 'page')
                law2, law2_why = due_2(y, q, st, False)
                page2, page2_why = due_2(y, q, st, True)
                guard.same(where, 'due_law', law, law2)
                guard.same(where, 'due_page', page, page2)
                guard.same(where, 'law skipped days', kinds_1(law_why), law2_why)
                guard.same(where, 'page skipped days', kinds_1(page_why), page2_why)
                nominal = R.nominal_due_date(y, q)
                guard.same(where, 'statutory date', nominal, nominal_2(y, q))
                printed = R.IRS_DUE_DATES.get(y, (None,) * 4)[q - 1]
                if printed is not None:
                    guard.same(where, 'IRS printed', law.isoformat(), printed)
                row = {'tax_year': y, 'state': st, 'quarter': q, 'statutory_date': iso(nominal),
                       'statutory_weekday': WEEKDAYS[nominal.weekday()], 'due_law': iso(law),
                       'due_law_weekday': WEEKDAYS[law.weekday()], 'law_moved_because': '; '.join(law_why),
                       'due_page': iso(page), 'due_page_weekday': WEEKDAYS[page.weekday()],
                       'page_moved_because': '; '.join(page_why), 'page_differs': yn(page != law),
                       'irs_printed': printed or '', 'irs_source': IRS_SOURCE[(y, q == 4)] if printed else 'not yet published',
                       'jan31_option': '', 'jan31_option_weekday': '', 'jan31_irs_printed': '', 'note': ''}
                notes = []
                if q == 4:
                    j1, j2 = R.jan31_option_date(y), jan31_2(y)
                    guard.same(where, 'jan31 option', j1, j2)
                    jp = R.IRS_JAN31_OPTION.get(y)
                    if jp:
                        guard.same(where, 'jan31 IRS printed', j1.isoformat(), jp)
                    row.update(jan31_option=iso(j1), jan31_option_weekday=WEEKDAYS[j1.weekday()],
                               jan31_irs_printed=f'{jp} ({JAN31_SOURCE[y]})' if jp else '')
                    if not jp:
                        notes.append('January 31 option computed (6654(h) moved by 7503), '
                                     + ('not checked against an IRS print' if y == 2024 else 'not yet published'))
                if page != law:
                    notes.append("page moves the April payment past Patriots' Day; the law does not (Rev. Rul. "
                                 "2015-13; Form 1040-ES (2024) printed April 15, 2024 for everyone)")
                    stats['page differs from law'] += 1
                if y == 2027 and q == 4:
                    notes.append("installment date computed: Jan 15, 2028 is a Saturday and Monday Jan 17 is King's "
                                 "Birthday; no IRS print yet")
                if y == 2027 and q < 4:
                    notes.append('rests on the Pub. 509 (2027) draft')
                if st in ('MA', 'ME') and q == 1 and page == law:
                    pd = R.patriots_day(y)
                    notes.append(f"Patriots' Day is {pd.isoformat()}, after the date: no effect")
                row['note'] = '; '.join(notes)
                stats['moved (law)'] += law != nominal
                rows.append(row)
    stats['rows'] = len(rows)
    return rows, stats


# ======================================== households.csv ========================================

HOUSEHOLD_COLUMNS = list(INPUT_KEYS) + [
    'total_tax', 'required', 'ninety', 'prior_share', 'basis', 'withholding_projected', 'paychecks_left_self',
    'paychecks_left_partner', 'needs_estimates', 'to_pay_by_estimates', 'per_quarter',
    'q1_due', 'q1_cumulative', 'q1_status', 'q2_due', 'q2_cumulative', 'q2_status',
    'q3_due', 'q3_cumulative', 'q3_status', 'q4_due', 'q4_cumulative', 'q4_status',
    'paid', 'remaining', 'behind', 'overdue_due', 'next_due', 'next_amount', 'balance_at_filing', 'verdict',
    'suggestion_kind', 'suggestion_per_paycheck', 'page_penalty_flag_withholding', 'page_penalty_flag_estimates',
    'law_penalty_exposure',
    # detail and contrast columns
    'prior_pct', 'last_past_due_quarter', 'next_quarter', 'suggestion_person', 'suggestion_ambiguous',
    'needs_estimates_amount_only', 'small_tax_exemption', 'zero_prior_exemption', 'law_underpaid',
    'tolerance_sensitive', 'tax_table_tax', 'note']


def household_row(c, d1):
    row = {k: c[k] for k in INPUT_KEYS}
    row.update({
        'total_tax': money(d1['total_tax']), 'required': money(d1['required']), 'ninety': money(d1['ninety']),
        'prior_share': money(d1['prior_share']), 'basis': d1['basis'],
        'withholding_projected': money(d1['withholding']) if d1['has_figures'] else '',
        'paychecks_left_self': '' if d1['left_self'] is None else d1['left_self'],
        'paychecks_left_partner': '' if d1['left_partner'] is None else d1['left_partner'],
        'needs_estimates': yn(d1['needs']), 'to_pay_by_estimates': money(d1['amount']),
        'per_quarter': money(d1['per_quarter']),
        'paid': money(d1['paid']), 'remaining': money(d1['remaining']), 'behind': money(d1['behind']),
        'overdue_due': iso(d1['overdue_due']), 'next_due': iso(d1['next_due']), 'next_amount': money(d1['next_amount']),
        'balance_at_filing': money(d1['balance']), 'verdict': d1['verdict'],
        'suggestion_kind': d1['sugg_kind'] or '',
        'suggestion_per_paycheck': '' if d1['sugg_amount'] is None else d1['sugg_amount'],
        'page_penalty_flag_withholding': yn(d1['flag_wh']), 'page_penalty_flag_estimates': yn(d1['flag_est']),
        'law_penalty_exposure': yn(d1['law']),
        'prior_pct': '' if d1['prior_pct'] is None else d1['prior_pct'], 'last_past_due_quarter': d1['last_past'],
        'next_quarter': d1['next_quarter'] or '', 'suggestion_person': d1['sugg_person'] or '',
        'suggestion_ambiguous': yn(d1['sugg_ambiguous']), 'needs_estimates_amount_only': yn(d1['needs_amount_only']),
        'small_tax_exemption': yn(d1['small']), 'zero_prior_exemption': yn(d1['zero']),
        'law_underpaid': '|'.join(f'{j}:{money(a)}' for j, a in zip(d1['law_quarters'], d1['law_short'])),
        'tolerance_sensitive': yn(d1['tolerance_sensitive']), 'tax_table_tax': money(d1['tax_table_tax']),
        'note': c['note'] if c['note'] else auto_note(c, d1),
    })
    for k in (1, 2, 3, 4):
        row[f'q{k}_due'] = iso(d1[f'due{k}'])
        row[f'q{k}_cumulative'] = money(d1[f'cum{k}'])
        row[f'q{k}_status'] = d1[f'status{k}']
    return row


def today_kinds(c):
    year, t = int(c['year']), date.fromisoformat(c['today'])
    dues = R.due_dates(year)
    out = []
    if t in dues:
        out.append(f'on the Q{dues.index(t) + 1} due date')
    if t - timedelta(days=1) in dues:
        out.append(f'the day after the Q{dues.index(t - timedelta(days=1)) + 1} due date')
    if t == date(year, 1, 1):
        out.append('January 1')
    if t == date(year, 12, 31):
        out.append('December 31')
    if t.year == year + 1 and t.day < 15:
        out.append('early January next year (1st-14th)')
    if t.year == year + 1 and t.day > 15:
        out.append('late January next year (16th-31st)')
    return out


def stats_row(s, c, d1, edge, pattern):
    s[f'year {c["year"]}'] += 1
    s[f'filing status {c["filing_status"]}'] += 1
    s[f'adults {len(c["adults"].split("|"))}'] += 1
    st = c['state']
    s['state ' + (st if st in ('MA', 'ME', 'DC', 'CA') else 'other')] += 1
    t = date.fromisoformat(c['today'])
    month = f'{t.month:02d}' if t.year == int(c['year']) else '13 (January next year)'
    s[f'today month {month}'] += 1
    for k in today_kinds(c):
        s['today ' + k] += 1
        s[f'today {c["year"]} {k}'] += 1
    pt = c['prior_tax']
    if pt == '':
        kind = 'blank'
    elif fr(pt) == 0:
        kind = 'zero'
    elif fr(pt) < 2000:
        kind = 'small (under 2,000)'
    elif fr(pt) > d1['total_tax'] * F(3, 2):
        kind = 'large (over 1.5 x this year)'
    else:
        kind = 'other'
    s['prior tax ' + kind] += 1
    agi = c['prior_agi']
    if pt != '':
        if agi == '':
            s['prior AGI blank (prior tax typed)'] += 1
        else:
            line = 75000 if c['filing_status'] == 'married_separate' else 150000
            a = fr(agi)
            s['prior AGI over the line' if a > line else 'prior AGI at or under the line'] += 1
            if agi in ('150000.00', '150000.01', '75000.00', '75000.01'):
                s[f'prior AGI exactly {agi} ({"separate" if line == 75000 else "other"})'] += 1
    s[f'basis {d1["basis"]}' + (' (110%)' if d1['prior_pct'] == 110 and d1['basis'] == 'last year' else '')] += 1
    if c['withheld_so_far'] == '' and not c['self_per_paycheck'] and not c['partner_per_paycheck']:
        s['withholding nothing typed'] += 1
    else:
        s['withholding typed'] += 1
        s['withheld so far ' + ('blank' if c['withheld_so_far'] == '' else
                                ('typed 0' if fr(c['withheld_so_far']) == 0 else 'typed'))] += 1
        who = tuple(w for w in ('self', 'partner') if c[w + '_per_paycheck'])
        s['paychecks ' + ('+'.join(who) if who else 'none')] += 1
        for w in who:
            s['period ' + c[w + '_period']] += 1
    if pattern:
        s['estimates pattern ' + pattern] += 1
    typed = [c[f'paid_q{k}'] for k in (1, 2, 3, 4)]
    npast = d1['last_past']
    if all(x == '' for x in typed):
        s['estimates none typed'] += 1
    else:
        q = d1['per_quarter']
        if npast and all(typed[k] != '' and q <= fr(typed[k]) <= q + 1 for k in range(npast)):
            s['estimates every past-due box typed with its quarter, to $1 over (on time)'] += 1
        if any(typed[k] == '' for k in range(npast)):
            s['estimates a past-due box blank (late / not typed)'] += 1
        if any(typed[k] != '' and fr(typed[k]) < q for k in range(npast)):
            s['estimates a past-due box under its quarter (short)'] += 1
        if any(x != '' and fr(x) > q + 1 for x in typed):
            s['estimates a box more than $1 above its quarter (over)'] += 1
        if any(typed[k] != '' for k in range(npast, 4)):
            s['estimates a box typed before its due date (counts now)'] += 1
        if d1['paid'] >= d1['amount']:
            s['estimates total at or above the amount'] += 1
    for k in (1, 2, 3, 4):
        s[f'status q{k} {d1[f"status{k}"]}'] += 1
    s['verdict ' + d1['verdict']] += 1
    s['suggestion ' + (d1['sugg_kind'] or 'none') + (' (ambiguous)' if d1['sugg_ambiguous'] else '')] += 1
    if d1['sugg_person'] == 'partner':
        s['suggestion for the partner'] += 1
    if less_than_cut(c, d1):
        s["suggestion 'less' larger than that person's per-paycheck amount"] += 1
    s[f'needs estimates {yn(d1["needs"])}'] += 1
    s['needs estimates: the two readings differ'] += d1['needs'] != d1['needs_amount_only']
    s[f'page flag withholding {yn(d1["flag_wh"])}'] += 1
    s[f'page flag estimates {yn(d1["flag_est"])}'] += 1
    s[f'law exposure {yn(d1["law"])}'] += 1
    s['law exposure on, estimates page flag off'] += d1['law'] and not d1['flag_est']
    # the estimates page's flag implies the law's exposure: it needs a past-due quarter k with boxes 1..k < S_k - 1
    assert d1['law'] or not d1['flag_est'], c['case_id']
    s['law exposure on, withholding page flag off'] += d1['law'] and not d1['flag_wh']
    s['withholding page flag on, law exposure off'] += d1['flag_wh'] and not d1['law']
    s['small-tax exemption (tax - withholding < 1,000)'] += d1['small']
    s['zero-tax exemption'] += d1['zero']
    tw = d1['total_tax'] - d1['withholding']
    if tw in (fr('999.99'), fr('1000')):
        s[f'tax - withholding exactly {money(tw)}'] += 1
    b = d1['balance']
    if d1['has_figures']:
        s['balance (with withholding figures) under 1,000' if b < 1000 else 'balance (with withholding figures) 1,000 or more'] += 1
    if b in (fr('999.99'), fr('1000'), fr('500'), fr('499.99'), fr('-499.99'), fr('-500')):
        s[f'balance exactly {money(b)}'] += 1
    s['behind above 0'] += d1['behind'] > 0
    s['no next payment'] += d1['next_quarter'] is None
    s['tolerance-sensitive (labelled edge rows only)'] += d1['tolerance_sensitive']
    s['Tax Table differs from the formula by a cent or more'] += abs(d1['tax_table_tax'] - d1['total_tax']) >= CENT
    s['tax 0'] += d1['total_tax'] == 0
    s['income with cents'] += fr(c['other_income']).denominator != 1
    for k in ('total_tax', 'required', 'ninety', 'prior_share', 'withholding', 'amount', 'per_quarter', 'cum1', 'cum2',
              'cum3', 'cum4', 'paid', 'remaining', 'behind', 'next_amount', 'balance'):
        s['written amounts exactly on a half cent before rounding'] += half_cent(d1[k])
    s['negative balance exactly on a half cent (written away from zero)'] += b < 0 and half_cent(b)
    s['tax exactly on a half cent'] += half_cent(d1['total_tax'])
    s['largest tax'] = max(s.get('largest tax', ZERO), d1['total_tax'])


def build_households(rng, guard):
    s = Counter()
    cases = edge_cases()
    n_edge = len(cases)
    for i, c in enumerate(cases, 1):
        c['case_id'] = f'est-edge-{i:03d}'
    rows = []
    for c in cases:
        d1, d2 = derive_1(c), derive_2(c)
        compare_household(guard, c, d1, d2)
        rows.append(household_row(c, d1))
        stats_row(s, c, d1, True, None)
    draws = redrawn = 0
    k = 0
    while len(rows) < N_HOUSEHOLDS:
        c, pattern = random_case(rng)
        draws += 1
        c['case_id'] = f'est-{k + 1:04d}'
        d1, d2 = derive_1(c), derive_2(c)
        compare_household(guard, c, d1, d2)      # every draw, kept or not
        if d1['tolerance_sensitive']:
            redrawn += 1
            continue
        k += 1
        rows.append(household_row(c, d1))
        stats_row(s, c, d1, False, pattern)
    s['random draws'] = draws
    s['random draws redrawn (paid within $1 under a share)'] = redrawn
    return rows, s, n_edge


def check_coverage(s, n_edge):
    """The brief's coverage list, as hard minimums: a generator change that loses one stops the run."""
    need = {'year 2025': 1300, 'year 2026': 1300}
    for st in STATUSES:
        need[f'filing status {st}'] = 300
    for m in range(1, 13):
        need[f'today month {m:02d}'] = 60
    need['today month 13 (January next year)'] = 100
    for y in HOUSEHOLD_YEARS:
        for q in (1, 2, 3, 4):
            need[f'today {y} on the Q{q} due date'] = 30
            need[f'today {y} the day after the Q{q} due date'] = 15
        need[f'today {y} January 1'] = 20
        need[f'today {y} December 31'] = 20
        need[f'today {y} early January next year (1st-14th)'] = 40
    for key in ('prior tax blank', 'prior tax zero', 'prior tax small (under 2,000)', 'prior tax large (over 1.5 x this year)',
                'prior AGI over the line', 'prior AGI at or under the line', 'basis last year (110%)', 'basis last year',
                'basis this year', 'withholding nothing typed', 'withholding typed', 'withheld so far blank',
                'withheld so far typed 0', 'paychecks self+partner', 'paychecks partner',
                'estimates none typed', 'estimates a past-due box blank (late / not typed)',
                'estimates every past-due box typed with its quarter, to $1 over (on time)',
                'estimates a past-due box under its quarter (short)', 'estimates a box more than $1 above its quarter (over)',
                'estimates a box typed before its due date (counts now)', 'status q1 due', 'status q4 due',
                'status q1 short', 'status q3 short', 'verdict unknown', 'verdict owe', 'verdict refund',
                'verdict about right', 'suggestion more', 'suggestion less', 'suggestion use estimates (ambiguous)',
                'suggestion for the partner', 'page flag withholding yes', 'page flag estimates yes', 'law exposure yes',
                'law exposure on, estimates page flag off',
                'small-tax exemption (tax - withholding < 1,000)', 'zero-tax exemption',
                'balance (with withholding figures) under 1,000', 'balance (with withholding figures) 1,000 or more'):
        need[key] = 10
    for agi in ('150000.00', '150000.01'):
        need[f'prior AGI exactly {agi} (other)'] = 10
    for agi in ('75000.00', '75000.01'):
        need[f'prior AGI exactly {agi} (separate)'] = 3
    need['suggestion use estimates'] = 1
    for key in ('tax - withholding exactly 999.99', 'tax - withholding exactly 1000.00', 'balance exactly 999.99',
                'balance exactly 1000.00', 'balance exactly 500.00', 'balance exactly 499.99', 'balance exactly -499.99',
                'balance exactly -500.00'):
        need[key] = 1
    short = {k: (s.get(k, 0), v) for k, v in need.items() if s.get(k, 0) < v}
    if short:
        raise SystemExit(f'coverage short of the brief: {short}; no CSV written')
    return len(need)


# ======================================== run ========================================

def write_csv(path, columns, rows):
    with path.open('w', newline='', encoding='utf-8') as fh:
        w = csv.DictWriter(fh, fieldnames=columns, lineterminator='\n')
        w.writeheader()
        w.writerows(rows)


def show_stat(v):
    return money(v) if isinstance(v, F) else v


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
    rng = random.Random(SEED)
    g_dates, g_house = Guard('dates.csv'), Guard('households.csv')
    date_rows, date_stats = build_dates(g_dates)
    assert len(date_rows) == len(DATE_YEARS) * len(DATE_STATES) * 4 == 80
    house_rows, house_stats, n_edge = build_households(rng, g_house)
    assert len(house_rows) == N_HOUSEHOLDS and len({r['case_id'] for r in house_rows}) == N_HOUSEHOLDS
    n_cov = check_coverage(house_stats, n_edge)
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    write_csv(out_dir / 'dates.csv', DATES_COLUMNS, date_rows)          # written only once both have passed
    write_csv(out_dir / 'households.csv', HOUSEHOLD_COLUMNS, house_rows)
    print(f'wrote dates.csv: {len(date_rows)} rows; both derivations agree')
    for key in sorted(g_dates.n):
        print(f'  check: {key}: {g_dates.n[key]}')
    for key in sorted(date_stats):
        print(f'  {key}: {date_stats[key]}')
    print(f'wrote households.csv: {len(house_rows)} rows ({n_edge} edge, {len(house_rows) - n_edge} random); '
          f'both derivations agree; largest gap before rounding {money(g_house.max_gap)}; '
          f'{n_cov} coverage minimums met')
    for key in sorted(g_house.n):
        print(f'  check: {key}: {g_house.n[key]}')
    for key in sorted(house_stats):
        print(f'  {key}: {show_stat(house_stats[key])}')
    print(f'total {time.time() - t0:.1f} s')


if __name__ == '__main__':
    main(sys.argv[1:])
