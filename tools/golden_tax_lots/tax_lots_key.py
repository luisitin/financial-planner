"""Tax lots and harvesting answer key: the "Tax lots and harvesting" page. Two CSVs.

Run:  python3 -B -I tools/golden_tax_lots/tax_lots_key.py [out_dir] [--mutate NAME] [--skip-examples]

Writes tests/golden/tax-lots/lots.csv (3,000 lots for the holding-period rule alone: purchases dated 2023 to 2026 with
every month end, February 29, December 31 and January 1, seen on the anniversary, the day before and the day after, plus
a few 2027 and 2028 purchases and some undated lots) and households.csv (2,000 invented households, "today" in 2025 or
2026: every lot's value, gain and term, the page's two rates, the harvest candidates with the page's tax saved and the
wash sales, the law's tax saved and the carryover, the order to sell). Standard library only, exact arithmetic
(fractions.Fraction), deterministic (random.Random(20261031); the generator draws only integers). The figures and the
model come from rules.py next to this file; the sources and the reasons are in tests/golden/tax-lots/RULES.md and in
README.md here. Nothing under modules/, core/ or tests/*.test.mjs was opened, and the app is never imported.

Model (the page's documented convention, made exact by rules.py; where the law says otherwise the main columns follow
the law and a contrast column keeps the page's way):
  * term: the law counts from the day after the purchase and is long-term when held MORE than one year (1222; Pub. 550;
    Rev. Rul. 66-7 for month ends); the page uses the day after the calendar anniversary. Undated lots are long.
  * lots: value = shares x price, gain = value - cost; a holding's shares not covered by lots are one undated
    "unassigned" lot at cost max(0, holding cost - lots' cost).
  * rates (page): marginal = change in federal tax (income tax + 3.8% NIIT; each total rounded to the cent, R2) for
    $1,000 more interest / 1,000; gains rate the same for $1,000 more qualified dividends; never below 0.
  * harvest (page): taxable lots losing more than $1, tax saved = loss x marginal (short) or gains rate (long).
    Law: the year's federal tax without selling minus with every candidate sold today (Schedule D netting, the $3,000 /
    $1,500 limit, NIIT with the allowed loss, the carryover worksheet), after wash sales (1091; 1.1091-1; Rev. Rul.
    2008-5).
  * order to sell (page): taxable lots by gain per share, lowest first, input order on ties, first eight. Contrast:
    losses first, then tax per dollar raised.

Two derivations of every value, run on every row (kept or redrawn) before anything is written:
  derivation 1  rules.py: harvest() (make_lots, page_rates, federal_tax = schedule_d + qdcg_tax + niit + carryover,
                is_candidate, page_tax_saved, wash_sales, same_day_sensitive), first_long_day_law / _page, term,
                days_until_long, holding_totals, page_sell_order, contrast_sell_order.
  derivation 2  this file, written separately, from the CSV's own input strings (its own parser): the first long-term
                day as "the start of the holding period (purchase + 1 day) moved one year on" (February 29 -> March 1);
                the page's as month/day one year on + 1 day; the tax from the revenue procedures' printed "The Tax Is"
                base plus the rate on the excess (bisection on the tops); qualified income stacked as the overlap of
                [ordinary, taxable] with the 0/15/20% bands, with the 1(h)(1) cap at the regular tax; net capital gain
                as 1222(11) words it (net long-term gain over net short-term loss); the carryover from the words of
                1212(b) (the allowed loss, up to adjusted taxable income, treated as a short-term gain) instead of the
                worksheet's lines; wash sales as overlaps of cumulative share ranges (sold lots in order of purchase
                against replacement lots in order of purchase) instead of a greedy loop; both orders by insertion
                sorts with cross-multiplied comparisons.
The script refuses to write any CSV if an amount differs by more than a cent, a rate or ratio by more than 1e-6, or
any other value (date, term, day count, flag, lot key, order) differs at all, between the two. Both CSVs are worked
first and written only if both pass. --mutate NAME puts one deliberate mistake into derivation 2 (see MUTATIONS) to show
the guard refuses; --skip-examples turns off the RULES.md examples check so the row guard has to find it alone.
"""
import sys
sys.dont_write_bytecode = True  # before importing rules.py, so no __pycache__ lands in the repo

import csv
import hashlib
import random
import time
from bisect import bisect_left
from collections import Counter
from datetime import date, timedelta
from fractions import Fraction as F
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import rules as R  # noqa: E402  (importing it runs rules.check_tables())

ROOT = HERE.parents[1]
OUT_DIR = ROOT / 'tests' / 'golden' / 'tax-lots'
SEED = 20261031
N_TERMS = 3000
N_HOUSEHOLDS = 2000
ZERO, CENT, MICRO = F(0), F(1, 100), F(1, 10 ** 6)
DAY = timedelta(days=1)
STATUSES = ('single', 'married_joint', 'married_separate', 'head_of_household')
STATUS_CODE = {'single': 'sgl', 'married_joint': 'mfj', 'married_separate': 'mfs', 'head_of_household': 'hoh'}
TICKERS = tuple(R.INVENTED_TICKERS)
assert tuple(R.TAX_YEARS) == (2025, 2026) and tuple(R.STATUSES) == STATUSES

MUTATIONS = {
    'window_29_days': 'a replacement must be bought within 29 days before the sale, not 30',
    'wash_latest_first': 'replacement shares are matched latest purchase first (not 1.1091-1(c), (d))',
    'ira_no_wash': 'a purchase in an IRA is never a replacement (not Rev. Rul. 2008-5)',
    'mfs_limit_3000': 'married filing separately deducts up to $3,000 of net capital loss, not $1,500',
    'no_cross_netting': 'net capital gain ignores a net short-term loss (no cross netting)',
    'niit_full_loss': 'net investment income counts the whole net capital loss, not only the allowed $3,000',
    'carry_ignores_negative_income': 'the carryover treats the whole allowed loss as used even when taxable income is negative',
    'no_worksheet_cap': 'income tax is the stacked 0/15/20% figure without the cap at the regular tax (worksheet line 25)',
    'anniversary_is_long': 'a lot is long-term on its anniversary (held one year, not more than one year)',
    'loss_at_least_1': 'a lot losing exactly $1.00 is a harvest candidate',
    'tie_reverse': 'the order to sell breaks ties in gain per share by reverse input order',
    'unassigned_no_floor': "the unassigned lot's cost is not floored at 0",
}
MUT = None


# ======================================== small helpers ========================================

def fr(x):
    """str / int / Fraction -> exact Fraction (never float)."""
    if isinstance(x, float):
        raise TypeError('no floats')
    if isinstance(x, F):
        return x
    if isinstance(x, int):
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


def dec_str(x, places=3):
    """Shares as written: up to `places` decimals, trailing zeros dropped (the value must be exact at that scale)."""
    n = fr(x) * 10 ** places
    assert n.denominator == 1, x
    n = int(n)
    sign = '-' if n < 0 else ''
    whole, frac = divmod(abs(n), 10 ** places)
    if frac == 0:
        return f'{sign}{whole}'
    return f'{sign}{whole}.' + f'{frac:0{places}d}'.rstrip('0')


def half_cent(x):
    return x is not None and (fr(x) * 100).denominator == 2


def yn(b):
    return 'yes' if b else 'no'


def iso(d):
    return '' if d is None else d.isoformat()


def anniv(d, years=1):
    """Generator helper: same month and day `years` on (February 29 -> February 28). Not used by either derivation."""
    try:
        return d.replace(year=d.year + years)
    except ValueError:
        return d.replace(year=d.year + years, day=28)


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


# ======================================== lots.csv: the two derivations ========================================

def term_1(acq, today):
    """Derivation 1 (rules.py) for one lot: the law's and the page's first long-term day, term, days to go."""
    return {'long_on': R.first_long_day_law(acq), 'term': R.term(acq, today, 'law'),
            'days': R.days_until_long(acq, today, 'law'), 'long_on_page': R.first_long_day_page(acq),
            'term_page': R.term(acq, today, 'page'), 'days_page': R.days_until_long(acq, today, 'page'),
            'differ': acq is not None and R.rules_differ(acq)}


def long_on_law_2(d):
    """Derivation 2: the holding period starts the day after the purchase (Pub. 550); held more than one year from the
    first sale day that is a full year after that start: the start's month and day one year on (a start on February 29
    has no such day: the year ends February 28, so March 1)."""
    if d is None:
        return None
    if MUT == 'anniversary_is_long':
        return date(d.year + 1, d.month, 28 if (d.month, d.day) == (2, 29) else d.day)
    s = d + DAY
    if (s.month, s.day) == (2, 29):
        return date(s.year + 1, 3, 1)
    return date(s.year + 1, s.month, s.day)


def long_on_page_2(d):
    """Derivation 2, page convention: the day after the calendar anniversary; a February 29 purchase: March 1."""
    if d is None:
        return None
    if MUT == 'anniversary_is_long':
        return date(d.year + 1, d.month, 28 if (d.month, d.day) == (2, 29) else d.day)
    if (d.month, d.day) == (2, 29):
        return date(d.year + 1, 3, 1)
    return date(d.year + 1, d.month, d.day) + DAY


def term_2(acq, today):
    out = {}
    for tag, first in (('', long_on_law_2(acq)), ('_page', long_on_page_2(acq))):
        if first is None:
            out['long_on' + tag], out['term' + tag], out['days' + tag] = None, 'long', 0
        else:
            gap = first.toordinal() - today.toordinal()
            out['long_on' + tag] = first
            out['term' + tag] = 'short' if gap > 0 else 'long'
            out['days' + tag] = gap if gap > 0 else 0
    out['differ'] = out['long_on'] != out['long_on_page']
    return out


TERM_KEYS = ('long_on', 'term', 'days', 'long_on_page', 'term_page', 'days_page', 'differ')


def today_is(acq, today):
    """How `today` sits against the purchase (a label of the input, not an output)."""
    if acq is None:
        return 'no_date'
    a = anniv(acq)
    for k, label in ((0, 'anniversary'), (1, 'day_after_anniversary'), (-1, 'day_before_anniversary'),
                     (2, 'two_days_after_anniversary')):
        if today == a + k * DAY:
            return label
    if today == acq:
        return 'purchase_day'
    return 'other'


def month_ends(years):
    out = []
    for y in years:
        for m in range(1, 13):
            nxt = date(y + (m == 12), m % 12 + 1, 1)
            out.append(nxt - DAY)
    return out


def term_cases(rng):
    """lots.csv inputs: (acquired, today, note). A systematic part first, then random rows to N_TERMS."""
    rows, seen = [], set()

    def add(acq, today, note=''):
        if (acq, today) in seen:
            return
        seen.add((acq, today))
        rows.append((acq, today, note))

    special = set(month_ends(range(2023, 2027)))
    special |= {date(y, 1, 1) for y in range(2023, 2027)} | {date(y, 3, 1) for y in range(2023, 2027)}
    special |= {date(y, 2, 28) for y in range(2023, 2027)} | {date(2024, 2, 29)}
    for p in sorted(special):
        a = anniv(p)
        law, page = R.first_long_day_law(p), R.first_long_day_page(p)
        note = ''
        if (p.month, p.day) == (2, 29):
            note = 'February 29 purchase: anniversary February 28, long-term from March 1 (law and page)'
        elif law != page:
            note = f'law and page differ: law long-term from {law}, page from {page} (February 28 before a leap year)'
        for t in sorted({a - DAY, a, a + DAY, a + 2 * DAY, law - DAY, law, page - DAY, page, p + 365 * DAY,
                         p + 366 * DAY, p}):
            add(p, t, note)
    for p in (date(2027, 2, 28), date(2028, 2, 28), date(2028, 2, 29), date(2028, 3, 1), date(2027, 12, 31),
              date(2028, 1, 1)):
        a = anniv(p)
        law, page = R.first_long_day_law(p), R.first_long_day_page(p)
        note = 'outside the 2023-2026 grid'
        if law != page:
            note += f'; law and page differ: law long-term from {law}, page from {page}'
        if (p.month, p.day) == (2, 29):
            note += '; February 29 purchase'
        for t in sorted({a - DAY, a, a + DAY, a + 2 * DAY, law - DAY, law, page}):
            add(p, t, note)
    n_blank = 0
    while n_blank < 20:   # 20 distinct undated rows
        t = date(2025, 1, 1) + rng.randrange(730) * DAY
        if (None, t) not in seen:
            add(None, t, 'no date: long-term, 0 days (page convention)')
            n_blank += 1
    lo = date(2023, 1, 1)
    span = (date(2026, 12, 31) - lo).days + 1
    while len(rows) < N_TERMS:
        p = lo + rng.randrange(span) * DAY
        k = rng.randrange(100)
        a = anniv(p)
        if k < 25:
            t = a
        elif k < 50:
            t = a + DAY
        elif k < 75:
            t = a - DAY
        else:
            t = p + rng.randrange(901) * DAY
        add(p, t, '')
    return rows


TERM_COLUMNS = ['case_id', 'acquired', 'today', 'today_is', 'long_on', 'term', 'days_to_long', 'long_on_page',
                'term_page', 'days_to_long_page', 'law_page_differ', 'note']


def build_terms(rng, guard):
    rows, stats = [], Counter()
    for n, (acq, today, note) in enumerate(term_cases(rng), 1):
        cid = f'term-{n:04d}'
        a, b = term_1(acq, today), term_2(acq, today)
        for k in TERM_KEYS:
            guard.same(cid, k, a[k], b[k])
        kind = today_is(acq, today)
        rows.append({'case_id': cid, 'acquired': iso(acq), 'today': today.isoformat(), 'today_is': kind,
                     'long_on': iso(a['long_on']), 'term': a['term'], 'days_to_long': a['days'],
                     'long_on_page': iso(a['long_on_page']), 'term_page': a['term_page'],
                     'days_to_long_page': a['days_page'], 'law_page_differ': yn(a['differ']), 'note': note})
        stats[f'today is {kind}'] += 1
        stats[f'term {a["term"]}'] += 1
        stats['law and page differ (first long-term day)'] += a['differ']
        stats['law and page differ (term today)'] += a['term'] != a['term_page']
        if acq is not None:
            stats[f'purchase year {acq.year}'] += 1
            stats['purchase on a month end'] += (acq + DAY).month != acq.month
            stats['purchase on February 29'] += (acq.month, acq.day) == (2, 29)
            stats['purchase on December 31'] += (acq.month, acq.day) == (12, 31)
            stats['purchase on January 1'] += (acq.month, acq.day) == (1, 1)
    assert len(rows) == N_TERMS
    return rows, stats


# ======================================== households: inputs ========================================

def lot_key(lid):
    """rules.py lot id ('h0l1', 'h0u') -> the CSV's key ('0|1', '0|u')."""
    return lid[1:].replace('l', '|').replace('u', '|u')


def parse_1(c):
    """The CSV input strings as rules.make_lots wants them."""
    holdings = []
    for part in [p for p in c['holdings'].split(';') if p]:
        sym, kind, price, shares, cost = part.split('|')
        holdings.append({'symbol': sym, 'account': kind, 'price': price, 'total_shares': shares, 'total_cost': cost,
                         'lots': []})
    for part in [p for p in c['lots'].split(';') if p]:
        h, dt, sh, cost = part.split('|')
        holdings[int(h)]['lots'].append((dt or None, sh, cost))
    return holdings


# ======================================== derivation 1: rules.py ========================================

def derive_1(c):
    today = date.fromisoformat(c['today'])
    year, st = today.year, c['filing_status']
    r = R.harvest(year, st, c['other_ordinary'], c['qualified_dividends'], c['st_realized'], c['lt_realized'],
                  parse_1(c), today)
    lots, by_id = r['lots'], {l['id']: l for l in r['lots']}
    out = {'rates': r['rates'], 'lots': [], 'holdings': [], 'harvest': [], 'matches': []}
    for l in lots:
        dt = l['date']
        out['lots'].append({'key': lot_key(l['id']), 'symbol': l['symbol'], 'account': l['account'], 'date': dt,
                            'shares': l['shares'], 'cost': l['cost'], 'value': l['value'], 'gain': l['gain'],
                            'term': R.term(dt, today, 'law'), 'long_on': R.first_long_day_law(dt),
                            'days': R.days_until_long(dt, today, 'law'), 'assigned': not l['unassigned'],
                            'term_page': R.term(dt, today, 'page'), 'long_on_page': R.first_long_day_page(dt),
                            'days_page': R.days_until_long(dt, today, 'page')})
    tot = R.holding_totals(lots)
    for h in sorted(tot):
        out['holdings'].append({'h': h, **tot[h]})
    for lid in r['candidates']:
        l, w = by_id[lid], r['wash'][lid]
        out['harvest'].append({'key': lot_key(lid), 'loss': l['cost'] - l['value'], 'page': r['page_each'][lid],
                               'wash': w['wash_sale'], 'disallowed': w['disallowed'], 'matched': w['matched_shares'],
                               'plain': w['any_other_recent'], 'term': R.term(l['date'], today, 'law')})
        for rid, sh, add, acct, lost in w['chunks']:
            rl = by_id[rid]
            out['matches'].append({'sold': lot_key(lid), 'repl': lot_key(rid), 'shares': sh, 'disallowed': add,
                                   'account': acct, 'repl_date': rl['date'],
                                   'new_basis': None if lost else rl['cost'] * sh / rl['shares'] + add})
    hv = out['harvest']
    out['harvest_total'] = sum((x['loss'] for x in hv), ZERO)
    out['page_total'] = r['page_total']
    out['short_losses'] = sum((x['loss'] for x in hv if x['term'] == 'short'), ZERO)
    out['long_losses'] = sum((x['loss'] for x in hv if x['term'] == 'long'), ZERO)
    out['short_allowed'], out['long_allowed'] = r['st_loss_allowed'], r['lt_loss_allowed']
    out['disallowed_total'] = sum((x['disallowed'] for x in hv), ZERO)
    out['tax_without'], out['tax_with'] = r['without']['total'], r['with']['total']
    out['niit_without'], out['niit_with'] = r['without']['niit'], r['with']['niit']
    out['law_saved'], out['ratio'] = r['law_saved'], r['ratio']
    out['carry_with'], out['carry_without'], out['carry_new'] = r['carry_with'], r['carry_without'], r['carry_new']
    out['same_day'] = r['same_day_sensitive']
    page_order = R.page_sell_order(lots)
    out['sell_first'] = [lot_key(x) for x in page_order]
    out['sell_contrast'] = [lot_key(x) for x in R.contrast_sell_order(lots, today, r['rates'])]
    tl = [l for l in lots if l['account'] == 'taxable']
    gps = Counter(l['gain'] / l['shares'] for l in tl)
    out['tie'] = any(gps[by_id[x]['gain'] / by_id[x]['shares']] > 1 for x in page_order)
    out['_r'] = r  # for the statistics only (never written, never compared)
    return out


# ======================================== derivation 2: this file, separately ========================================

def parse_2(c):
    """Derivation 2's own parser: the CSV strings straight to exact Fractions, the unassigned lot appended per holding."""
    hs = []
    for part in [p for p in c['holdings'].split(';') if p]:
        f = part.split('|')
        hs.append({'sym': f[0], 'acct': f[1], 'price': F(f[2]), 'shares': F(f[3]), 'basis': F(f[4]), 'typed': []})
    for part in [p for p in c['lots'].split(';') if p]:
        f = part.split('|')
        hs[int(f[0])]['typed'].append((date.fromisoformat(f[1]) if f[1] else None, F(f[2]), F(f[3])))
    lots = []
    for h, H in enumerate(hs):
        sh_sum, cost_sum = ZERO, ZERO
        for k, (dt, sh, cost) in enumerate(H['typed']):
            lots.append({'key': f'{h}|{k}', 'h': h, 'sym': H['sym'], 'acct': H['acct'], 'date': dt, 'shares': sh,
                         'cost': cost, 'price': H['price'], 'assigned': True})
            sh_sum += sh
            cost_sum += cost
        if H['shares'] > sh_sum:
            left = H['basis'] - cost_sum
            if MUT != 'unassigned_no_floor' and left < 0:
                left = ZERO
            lots.append({'key': f'{h}|u', 'h': h, 'sym': H['sym'], 'acct': H['acct'], 'date': None,
                         'shares': H['shares'] - sh_sum, 'cost': left, 'price': H['price'], 'assigned': False})
    for i, l in enumerate(lots):
        l['idx'] = i
        l['value'] = l['shares'] * l['price']
        l['gain'] = l['value'] - l['cost']
    return hs, lots


def tax_table_2(year, status, x):
    """The revenue procedure's own form: the "Over $X but not over $Y" row (bisection on the tops), then the printed
    "The Tax Is" base plus the rate on the excess over X."""
    if x <= 0:
        return ZERO
    tops = R.BRACKET_TOPS[year][status]
    k = bisect_left(tops, x)
    lo = 0 if k == 0 else tops[k - 1]
    return F(R.RP_BASE[year][status][k]) + (x - lo) * F(R.RATES[k], 100)


def overlap(a, b, c, d):
    """Length of [a, b] inside [c, d] (d None = no top)."""
    hi = b if d is None else min(b, d)
    return max(ZERO, hi - max(a, c))


def fed_2(year, status, i, q, S, L):
    """The federal total (income tax + NIIT) and the carryover, worked from the statute's words."""
    net = S + L
    limit = F(1500) if status == 'married_separate' and MUT != 'mfs_limit_3000' else F(3000)
    allowed = ZERO if net >= 0 else min(limit, -net)
    line7a = net if net >= 0 else -allowed
    if MUT == 'no_cross_netting':
        ncg = max(ZERO, L) if net > 0 else ZERO
    else:
        ncg = max(ZERO, max(ZERO, L) - max(ZERO, -S))   # 1222(11): net LT gain over net ST loss
    agi = i + q + line7a
    ti_signed = agi - F(R.STANDARD_DEDUCTION[year][status])
    ti = max(ZERO, ti_signed)
    pref = min(ti, q + ncg)
    ordinary = ti - pref
    z, f15 = F(R.CG_ZERO_TOP[year][status]), F(R.CG_15_TOP[year][status])
    stacked = (tax_table_2(year, status, ordinary) + F(15, 100) * overlap(ordinary, ti, z, f15)
               + F(20, 100) * overlap(ordinary, ti, f15, None))
    regular = tax_table_2(year, status, ti)
    income_tax = stacked if MUT == 'no_worksheet_cap' else min(stacked, regular)
    nii = i + q + (net if MUT == 'niit_full_loss' else line7a)
    nii = max(ZERO, nii)
    niit = F(38, 1000) * min(nii, max(ZERO, agi - F(R.NIIT_THRESHOLD[status])))
    if net >= 0:
        cs = cl = ZERO
    else:
        ati = ti_signed + allowed                      # 1212(b)(2)(B); no 151 deduction in the case
        used = allowed if MUT == 'carry_ignores_negative_income' else min(allowed, max(ZERO, ati))
        s2 = S + used                                  # 1212(b)(2)(A): treated as a short-term gain
        cs = max(ZERO, max(ZERO, -s2) - max(ZERO, L))  # (1)(A) net ST loss over net LT gain
        cl = max(ZERO, max(ZERO, -L) - max(ZERO, s2))  # (1)(B) net LT loss over net ST gain
    return {'total': income_tax + niit, 'income_tax': income_tax, 'niit': niit, 'carry': (cs, cl), 'agi': agi,
            'stacked': stacked, 'regular': regular}


def cents_2(x):
    """A total of tax as money: to the cent, halves up (R2: the rates come from totals rounded to the cent)."""
    return F(rhu(fr(x) * 100), 100)


def rates_2(year, status, i, q, S, L):
    base = cents_2(fed_2(year, status, i, q, S, L)['total'])
    mi = (cents_2(fed_2(year, status, i + 1000, q, S, L)['total']) - base) / 1000
    mq = (cents_2(fed_2(year, status, i, q + 1000, S, L)['total']) - base) / 1000
    return {'marginal': max(ZERO, mi), 'gains': max(ZERO, mq)}


def is_cand_2(l):
    loss = l['cost'] - l['value']
    return l['acct'] == 'taxable' and (loss >= 1 if MUT == 'loss_at_least_1' else loss > 1)


def wash_2(lots, today, sold_keys):
    """Wash sales as overlaps of cumulative share ranges. Per symbol: the sold loss lots in order of purchase (undated
    first, then by date, ties in input order) occupy [0, s1), [s1, s1 + s2), ...; the replacement lots (same symbol,
    any account, dated in the window, not sold) in order of purchase occupy [0, r1), [r1, r1 + r2), ...; a sold lot's
    shares are matched with the replacement shares their range overlaps."""
    days = 29 if MUT == 'window_29_days' else 30
    lo, hi = today.toordinal() - days, today.toordinal() + 30
    sold_keys = set(sold_keys)
    res = {}
    for sym in sorted({l['sym'] for l in lots}):
        same = [l for l in lots if l['sym'] == sym]
        sold = [l for l in same if l['key'] in sold_keys]
        sold.sort(key=lambda l: (l['date'] is not None, l['date'].toordinal() if l['date'] else 0, l['idx']))
        repl = [l for l in same if l['key'] not in sold_keys and l['date'] is not None
                and lo <= l['date'].toordinal() <= hi
                and not (MUT == 'ira_no_wash' and l['acct'] == 'ira')]
        if MUT == 'wash_latest_first':
            repl.sort(key=lambda l: (-l['date'].toordinal(), l['idx']))
        else:
            repl.sort(key=lambda l: (l['date'].toordinal(), l['idx']))
        ranges, pos = [], ZERO
        for r in repl:
            ranges.append((pos, pos + r['shares'], r))
            pos += r['shares']
        start = ZERO
        for x in sold:
            a, b = start, start + x['shares']
            start = b
            per_share = (x['cost'] - x['value']) / x['shares']
            chunks = []
            for c0, c1, r in ranges:
                ov = min(b, c1) - max(a, c0)
                if ov > 0:
                    chunks.append({'repl': r['key'], 'shares': ov, 'disallowed': ov * per_share, 'account': r['acct'],
                                   'new_basis': None if r['acct'] == 'ira' else r['cost'] * ov / r['shares'] + ov * per_share})
            matched = sum((ch['shares'] for ch in chunks), ZERO)
            plain = any(o is not x and o['date'] is not None and today.toordinal() - 30 <= o['date'].toordinal()
                        <= today.toordinal() for o in same)
            res[x['key']] = {'matched': matched, 'disallowed': matched * per_share, 'chunks': chunks, 'plain': plain}
    return res


def same_day_2(lots, today, sold_keys):
    """Convention W3 check: a sold lot dated in the window, with another sold lot of its symbol bought before it (or
    undated)."""
    lo = today.toordinal() - 30
    sold = [l for l in lots if l['key'] in set(sold_keys)]
    for r in sold:
        if r['date'] is None or r['date'].toordinal() < lo:
            continue
        if any(x is not r and x['sym'] == r['sym'] and (x['date'] is None or x['date'] < r['date']) for x in sold):
            return True
    return False


def insertion_sort(items, before):
    """Stable insertion sort: `before(a, b)` is True when a must come strictly before b."""
    out = []
    for it in items:
        j = len(out)
        while j > 0 and before(it, out[j - 1]):
            j -= 1
        out.insert(j, it)
    return out


def sell_page_2(lots):
    tl = [l for l in lots if l['acct'] == 'taxable']
    if MUT == 'tie_reverse':
        return [l['key'] for l in insertion_sort(tl, lambda a, b: a['gain'] * b['shares'] <= b['gain'] * a['shares'])][:8]
    return [l['key'] for l in insertion_sort(tl, lambda a, b: a['gain'] * b['shares'] < b['gain'] * a['shares'])][:8]


def sell_contrast_2(lots, rates, terms):
    def cls(l):
        if l['value'] == 0:
            return 2
        return 0 if l['gain'] < 0 else 1

    def measure(l):  # gain per dollar for losses; tax per dollar raised for gains
        if cls(l) == 0:
            return l['gain'] / l['value']
        if cls(l) == 2:
            return ZERO
        r = rates['marginal'] if terms[l['key']] == 'short' else rates['gains']
        return l['gain'] * r / l['value']

    def before(a, b):
        ca, cb = cls(a), cls(b)
        return ca < cb or (ca == cb and measure(a) < measure(b))

    tl = [l for l in lots if l['acct'] == 'taxable']
    return [l['key'] for l in insertion_sort(tl, before)][:8]


def derive_2(c):
    today = date.fromisoformat(c['today'])
    year, st = today.year, c['filing_status']
    i, q, S, L = F(c['other_ordinary']), F(c['qualified_dividends']), F(c['st_realized']), F(c['lt_realized'])
    hs, lots = parse_2(c)
    rates = rates_2(year, st, i, q, S, L)
    out = {'rates': rates, 'lots': [], 'holdings': [], 'harvest': [], 'matches': []}
    terms = {}
    for l in lots:
        t = term_2(l['date'], today)
        terms[l['key']] = t['term']
        out['lots'].append({'key': l['key'], 'value': l['value'], 'gain': l['gain'], 'term': t['term'],
                            'long_on': t['long_on'], 'days': t['days'], 'assigned': l['assigned'],
                            'term_page': t['term_page'], 'long_on_page': t['long_on_page'], 'days_page': t['days_page'],
                            '_page_term': t['term_page']})
    for h in range(len(hs)):
        mine = [l for l in lots if l['h'] == h]
        if mine:
            out['holdings'].append({'h': h, 'shares': sum((l['shares'] for l in mine), ZERO),
                                    'value': sum((l['value'] for l in mine), ZERO),
                                    'cost': sum((l['cost'] for l in mine), ZERO),
                                    'gain': sum((l['gain'] for l in mine), ZERO)})
    cands = [l for l in lots if is_cand_2(l)]
    keys = [l['key'] for l in cands]
    wash = wash_2(lots, today, keys)
    page_terms = {x['key']: x['_page_term'] for x in out['lots']}
    st_allowed = lt_allowed = ZERO
    for l in cands:
        w = wash[l['key']]
        loss = l['cost'] - l['value']
        rate = rates['marginal'] if page_terms[l['key']] == 'short' else rates['gains']
        out['harvest'].append({'key': l['key'], 'loss': loss, 'page': loss * rate, 'wash': w['matched'] > 0,
                               'disallowed': w['disallowed'], 'matched': w['matched'], 'plain': w['plain'],
                               'term': terms[l['key']]})
        if terms[l['key']] == 'short':
            st_allowed += loss - w['disallowed']
        else:
            lt_allowed += loss - w['disallowed']
        for ch in w['chunks']:
            out['matches'].append({'sold': l['key'], 'repl': ch['repl'], 'shares': ch['shares'],
                                   'disallowed': ch['disallowed'], 'account': ch['account'],
                                   'new_basis': ch['new_basis']})
    hv = out['harvest']
    out['harvest_total'] = sum((x['loss'] for x in hv), ZERO)
    out['page_total'] = sum((x['page'] for x in hv), ZERO)
    out['short_losses'] = sum((x['loss'] for x in hv if x['term'] == 'short'), ZERO)
    out['long_losses'] = sum((x['loss'] for x in hv if x['term'] == 'long'), ZERO)
    out['short_allowed'], out['long_allowed'] = st_allowed, lt_allowed
    out['disallowed_total'] = sum((x['disallowed'] for x in hv), ZERO)
    w0 = fed_2(year, st, i, q, S, L)
    w1 = fed_2(year, st, i, q, S - st_allowed, L - lt_allowed)
    out['tax_without'], out['tax_with'] = w0['total'], w1['total']
    out['niit_without'], out['niit_with'] = w0['niit'], w1['niit']
    out['law_saved'] = w0['total'] - w1['total']
    out['ratio'] = None if out['page_total'] == 0 else out['law_saved'] / out['page_total']
    out['carry_with'], out['carry_without'] = w1['carry'], w0['carry']
    out['carry_new'] = (w1['carry'][0] - w0['carry'][0], w1['carry'][1] - w0['carry'][1])
    out['same_day'] = same_day_2(lots, today, keys)
    out['sell_first'] = sell_page_2(lots)
    out['sell_contrast'] = sell_contrast_2(lots, rates, terms)
    by_key = {l['key']: l for l in lots}
    tl = [l for l in lots if l['acct'] == 'taxable']
    out['tie'] = any(any(o is not by_key[k] and o['gain'] * by_key[k]['shares'] == by_key[k]['gain'] * o['shares']
                         for o in tl) for k in out['sell_first'])
    out['_w0'], out['_w1'] = w0, w1
    return out


# ======================================== the guard on one household ========================================

def compare_household(g, cid, a, b):
    g.rate(cid, 'marginal_rate', a['rates']['marginal'], b['rates']['marginal'])
    g.rate(cid, 'gains_rate', a['rates']['gains'], b['rates']['gains'])
    g.same(cid, 'lot count', len(a['lots']), len(b['lots']))
    for x, y in zip(a['lots'], b['lots']):
        w = f'{cid} lot {x["key"]}'
        for k in ('key', 'term', 'long_on', 'days', 'assigned', 'term_page', 'long_on_page', 'days_page'):
            g.same(w, k, x[k], y[k])
        g.money(w, 'value', x['value'], y['value'])
        g.money(w, 'gain', x['gain'], y['gain'])
    g.same(cid, 'holding count', len(a['holdings']), len(b['holdings']))
    for x, y in zip(a['holdings'], b['holdings']):
        g.same(cid, 'holding', x['h'], y['h'])
        g.same(cid, f'holding {x["h"]} shares', x['shares'], y['shares'])
        for k in ('value', 'cost', 'gain'):
            g.money(cid, f'holding {x["h"]} {k}', x[k], y[k])
    g.same(cid, 'harvest keys', [x['key'] for x in a['harvest']], [y['key'] for y in b['harvest']])
    for x, y in zip(a['harvest'], b['harvest']):
        w = f'{cid} candidate {x["key"]}'
        for k in ('wash', 'matched', 'plain', 'term'):
            g.same(w, k, x[k], y[k])
        for k in ('loss', 'page', 'disallowed'):
            g.money(w, k, x[k], y[k])
    g.same(cid, 'wash match count', len(a['matches']), len(b['matches']))
    for x, y in zip(a['matches'], b['matches']):
        w = f'{cid} match {x["sold"]}<-{x["repl"]}'
        for k in ('sold', 'repl', 'shares', 'account'):
            g.same(w, k, x[k], y[k])
        g.money(w, 'disallowed', x['disallowed'], y['disallowed'])
        g.money(w, 'new_basis', x['new_basis'], y['new_basis'])
    for k in ('harvest_total', 'page_total', 'short_losses', 'long_losses', 'short_allowed', 'long_allowed',
              'disallowed_total', 'tax_without', 'tax_with', 'niit_without', 'niit_with', 'law_saved'):
        g.money(cid, k, a[k], b[k])
    g.rate(cid, 'ratio', a['ratio'], b['ratio'])
    for k in ('carry_with', 'carry_without', 'carry_new'):
        g.money(cid, k + ' short', a[k][0], b[k][0])
        g.money(cid, k + ' long', a[k][1], b[k][1])
    for k in ('same_day', 'sell_first', 'sell_contrast', 'tie'):
        g.same(cid, k, a[k], b[k])


# ======================================== households: building inputs ========================================

def make_case(today, status, interest, qd, st, lt, holdings, note='', kind='edge'):
    """holdings: [{'sym', 'kind', 'price', 'lots': [(date str or '' , shares, cost)], 'shares'?, 'basis'?}]. Shares and
    basis default to the lots' sums. Returns the CSV input dict (strings)."""
    hs, ls = [], []
    for h, H in enumerate(holdings):
        sh_sum = sum((fr(s) for _, s, _ in H['lots']), ZERO)
        cost_sum = sum((fr(c) for _, _, c in H['lots']), ZERO)
        shares = fr(H['shares']) if 'shares' in H else sh_sum
        basis = fr(H['basis']) if 'basis' in H else cost_sum
        assert shares >= sh_sum and shares > 0
        hs.append(f'{H["sym"]}|{H["kind"]}|{money(fr(H["price"]))}|{dec_str(shares)}|{money(basis)}')
        for d, s, cst in H['lots']:
            ls.append(f'{h}|{iso(d) if isinstance(d, date) else (d or "")}|{dec_str(fr(s))}|{money(fr(cst))}')
    t = today if isinstance(today, date) else date.fromisoformat(today)
    return {'row_kind': kind, 'tax_year': str(t.year), 'today': t.isoformat(), 'filing_status': status,
            'other_ordinary': money(fr(interest)), 'qualified_dividends': money(fr(qd)),
            'st_realized': money(fr(st)), 'lt_realized': money(fr(lt)), 'holdings': ';'.join(hs), 'lots': ';'.join(ls),
            'edge_note': note}


def Hd(sym, kind, price, lots, **kw):
    return {'sym': sym, 'kind': kind, 'price': price, 'lots': list(lots), **kw}


def d_(s):
    return date.fromisoformat(s)


def edge_cases():
    E = []
    add = E.append
    # RULES.md section 10 (asserted in both derivations)
    add(make_case('2026-11-16', 'single', 240000, 0, 0, 0,
                  [Hd('ZZTOT', 'taxable', '60.00', [('2022-03-14', 1000, 100000)])],
                  'RULES.md 10.1 Ana: $40,000 long-term loss, no gains: law saves $1,074.00 (only $3,000 counts), page '
                  '$7,520.00, ratio 0.142819, carryover $37,000 long'))
    add(make_case('2025-12-15', 'married_joint', 120000, 5000, 0, 25000,
                  [Hd('ZZTEC', 'taxable', '40.00', [('2025-06-02', 400, 24000), ('2021-09-20', 300, 24000)])],
                  'RULES.md 10.2 Ben and Cy: short and long losses against $25,000 long-term gains: law $3,000.00, '
                  'page $3,960.00 (marginal 0.27, gains 0.15), ratio 0.757576'))
    dee = [Hd('ZZSML', 'taxable', '42.00', [('2024-02-29', 100, 5000)])]
    add(make_case('2025-02-28', 'single', 50000, 0, 0, 0, dee,
                  'RULES.md 10.3 Dee on 2025-02-28: February 29, 2024 lot short with 1 day to go: page $96.00 (marginal '
                  '0.12), law $96.00'))
    add(make_case('2025-03-01', 'single', 50000, 0, 0, 0, dee,
                  'RULES.md 10.3 Dee on 2025-03-01: now long-term: page $0.00 (gains rate 0), law still $96.00, ratio '
                  'blank'))
    add(make_case('2025-02-27', 'single', 50000, 0, 0, 0, dee,
                  'Dee on 2025-02-27, the day before the anniversary: short, 2 days to go'))
    add(make_case('2025-03-02', 'single', 50000, 0, 0, 0, dee, 'Dee on 2025-03-02: long, 0 days'))
    eve = [Hd('ZZTOT', 'taxable', '100.00', [('2023-05-10', 200, 24000)]),
           Hd('ZZTOT', 'ira', '100.00', [('2026-11-08', 50, 5100)])]
    add(make_case('2026-11-20', 'head_of_household', 95000, 1500, 0, 2000, eve,
                  'RULES.md 10.4 Eve: same fund bought 12 days ago in her IRA: wash sale, $1,000.00 disallowed for good '
                  '(Rev. Rul. 2008-5); law $520.00, page $600.00, ratio 0.866667'))
    add(make_case('2026-11-20', 'head_of_household', 95000, 1500, 0, 2000, eve[:1],
                  'RULES.md 10.4 Eve without the IRA purchase: no wash sale, law $740.00'))
    # the "more than $1" line
    for loss in ('0.99', '1.00', '1.01'):
        add(make_case('2026-08-14', 'single', 60000, 0, 0, 0,
                      [Hd('ZZBND', 'taxable', '10.00', [('2021-04-06', 100, fr(1000) + fr(loss))])],
                      f'loss exactly ${loss}: ' + ('a candidate (more than $1)' if loss == '1.01' else
                                                    'not a candidate (not more than $1)')))
    # the $3,000 / $1,500 limit, exactly
    for st, base, interest in (('single', 3000, 80000), ('married_separate', 1500, 80000)):
        for d in ('-0.01', '0', '0.01'):
            loss = fr(base) + fr(d)
            add(make_case('2025-10-07', st, interest, 0, 0, 0,
                          [Hd('ZZTOT', 'taxable', '50.00', [('2020-02-03', 100, 5000 + loss)])],
                          f'net loss ${money(loss)} against the ${base:,} limit: carryover '
                          f'${money(max(ZERO, loss - base))} long'))
    add(make_case('2026-12-01', 'single', 5000, 0, 0, 0,
                  [Hd('ZZINT', 'taxable', '30.00', [('2019-07-15', 1000, 40000)])],
                  'K1: interest $5,000 and a $10,000 long loss: taxable income below zero, so the whole $10,000 carries '
                  '(worksheet line 3 = 0)'))
    for year in (2025, 2026):
        for st in STATUSES:
            add(make_case(f'{year}-09-30', st, 0, 0, 0, 0,
                          [Hd('ZZSML', 'taxable', '20.00', [(f'{year}-06-02', 500, 15000)])],
                          'no income at all: both rates 0, page $0, law $0, the $5,000 short loss all carried'))
    # the net investment income tax
    add(make_case('2025-11-03', 'single', 200000, 0, 0, 0,
                  [Hd('ZZTOT', 'taxable', '80.00', [('2025-03-03', 100, 9500)])],
                  'MAGI exactly $200,000: no NIIT now; $1,000 more is all NIIT: marginal 0.278000'))
    add(make_case('2025-11-03', 'single', 199500, 0, 0, 0,
                  [Hd('ZZTOT', 'taxable', '80.00', [('2025-03-03', 100, 9500)])],
                  'MAGI $199,500: $1,000 more crosses the NIIT line halfway: marginal 0.259000, gains 0.169000'))
    add(make_case('2026-06-30', 'married_joint', 250000, 0, 0, 0,
                  [Hd('ZZDIV', 'taxable', '45.00', [('2023-01-17', 200, 11000)])],
                  'married filing jointly at the $250,000 NIIT line'))
    add(make_case('2026-06-30', 'married_separate', 125000, 0, 0, 0,
                  [Hd('ZZDIV', 'taxable', '45.00', [('2023-01-17', 200, 11000)])],
                  'married filing separately at the $125,000 NIIT line'))
    add(make_case('2025-06-30', 'head_of_household', 200000, 0, 0, 0,
                  [Hd('ZZDIV', 'taxable', '45.00', [('2023-01-17', 200, 11000)])],
                  'head of household at the $200,000 NIIT line'))
    add(make_case('2026-12-18', 'single', 201000, 0, 0, 0,
                  [Hd('ZZTEC', 'taxable', '70.00', [('2022-08-08', 100, 10000)])],
                  'MAGI $201,000: selling the $3,000 loss takes the NIIT from $38.00 to $0'))
    add(make_case('2026-12-18', 'single', 0, 0, 300000, 0,
                  [Hd('ZZTEC', 'taxable', '10.00', [('2018-05-21', 10000, 500000)])],
                  'all income a $300,000 short-term gain; a $400,000 long loss wipes it out: net investment income and '
                  'taxable income 0 after; K1: $100,000 long carries'))
    # the 0% band and the worksheet's cap
    add(make_case('2026-09-15', 'single', 30000, 0, 0, 0,
                  [Hd('ZZBND', 'taxable', '9.00', [('2020-01-02', 1000, 11000)])],
                  'taxable income in the 0% band: gains rate 0, page $0, law $230.00 (the loss is used against interest)'))
    add(make_case('2026-09-15', 'single', 65100, 0, 0, 0,
                  [Hd('ZZBND', 'taxable', '9.00', [('2020-01-02', 1000, 11000)])],
                  '$1,000 more of dividends straddles the 0% top: gains rate 0.082500'))
    add(make_case('2026-09-15', 'single', 65600, 500, 0, 0,
                  [Hd('ZZBND', 'taxable', '9.00', [('2020-01-02', 1000, 11000)])],
                  'dividends above the 0% top but inside the 12% bracket: the worksheet takes the regular tax (line 25); '
                  'gains rate 0.165000, marginal 0.145000'))
    add(make_case('2025-09-15', 'single', 64150, 50, 0, 0,
                  [Hd('ZZBND', 'taxable', '9.00', [('2020-01-02', 1000, 11000)])],
                  '2025: dividends between the 0% top ($48,350) and the 12% top ($48,475): the regular tax is lower'))
    add(make_case('2026-12-04', 'single', 700000, 0, 0, 0,
                  [Hd('ZZTEC', 'taxable', '120.00', [('2026-02-10', 100, 15000), ('2017-03-03', 100, 14000)])],
                  'top bracket: marginal 0.408000, gains 0.238000'))
    add(make_case('2026-10-20', 'single', 90000, 0, 20000, 0,
                  [Hd('ZZDIV', 'taxable', '30.00', [('2021-11-11', 1000, 40000)])],
                  'a long loss against short-term gains: the page prices it at the gains rate ($1,500.00), the law at '
                  '22% ($2,200.00), ratio 1.466667'))
    # the unassigned lot
    add(make_case('2026-05-12', 'married_joint', 140000, 2000, 0, 0,
                  [Hd('ZZTOT', 'taxable', '40.00', [('2024-01-09', 100, 5000)], shares=150, basis=8000)],
                  'unassigned 50 shares at the average leftover cost $60.00: a long-term candidate (key 0|u)'))
    add(make_case('2026-05-12', 'married_joint', 140000, 2000, 0, 0,
                  [Hd('ZZDIV', 'taxable', '25.00', [], shares=200, basis=7000)],
                  'a holding with no lots: all 200 shares unassigned, long-term, $2,000 loss'))
    add(make_case('2026-05-12', 'married_joint', 140000, 2000, 0, 0,
                  [Hd('ZZINT', 'taxable', '55.00', [('2025-02-14', 100, 6000)], shares=120, basis=5500)],
                  'holding cost below the lots\' cost: the unassigned 20 shares cost $0 (floored)'))
    add(make_case('2025-12-29', 'single', 85000, 3000, 0, 0,
                  [Hd('ZZTOT', 'ira', '50.00', [('2024-06-03', 100, 8000), ('2025-12-15', 20, 1000)]),
                   Hd('ZZBND', 'ira', '10.00', [('2023-03-01', 300, 2400)])],
                  'IRA only: no candidates, nothing to sell, law $0'))
    # wash sales
    tl = d_('2026-12-15')
    add(make_case(tl, 'single', 70000, 0, 0, 0,
                  [Hd('ZZTEC', 'taxable', '50.00', [('2024-05-01', 100, 8000), (tl - 30 * DAY, 40, 1900)])],
                  'replacement bought today - 30 days (inside): 40 of 100 shares matched, $1,200.00 disallowed, its '
                  'basis $1,900 + $1,200 = $3,100'))
    add(make_case(tl, 'single', 70000, 0, 0, 0,
                  [Hd('ZZTEC', 'taxable', '50.00', [('2024-05-01', 100, 8000), (tl - 31 * DAY, 40, 1900)])],
                  'replacement bought today - 31 days (outside): no wash sale'))
    add(make_case(tl, 'single', 70000, 0, 0, 0,
                  [Hd('ZZTEC', 'taxable', '50.00', [('2024-05-01', 100, 8000), (tl, 40, 1900)])],
                  'replacement bought today: inside the window'))
    add(make_case(tl, 'married_joint', 160000, 0, 0, 0,
                  [Hd('ZZSML', 'taxable', '20.00', [('2022-02-22', 100, 3500)]),
                   Hd('ZZSML', 'ira', '20.00', [(tl - 5 * DAY, 500, 10250)])],
                  'IRA bought 500 shares 5 days ago: all 100 sold shares matched, the $1,500 loss lost for good'))
    add(make_case(tl, 'married_joint', 160000, 0, 0, 0,
                  [Hd('ZZTOT', 'taxable', '40.00', [('2023-06-01', 100, 6000), ('2022-01-10', 100, 7000),
                                                    (tl - 10 * DAY, 150, 5700)])],
                  '1.1091-1(b), (c): the 2022 lot (listed second) is matched first: 100 shares ($3,000.00), then 50 of the '
                  '2023 lot ($1,000.00); new bases $6,800.00 and $2,900.00'))
    add(make_case(tl, 'married_joint', 160000, 0, 0, 0,
                  [Hd('ZZTOT', 'taxable', '40.00', [('2021-03-03', 100, 4500), (tl - 3 * DAY, 60, 2350)],
                      shares=300, basis=13850)],
                  'W4: the undated (unassigned) lot counts as bought first: it takes the 60 replacement shares; the plain '
                  'test calls both losses wash sales'))
    add(make_case(tl, 'single', 98000, 0, 0, 0,
                  [Hd('ZZINT', 'taxable', '25.00', [('2020-09-09', 400, 12000)]),
                   Hd('ZZBND', 'taxable', '11.00', [('2024-04-04', 100, 1000)]),
                   Hd('ZZINT', 'taxable', '25.00', [(tl - 12 * DAY, 100, 2400)])],
                  'same symbol in a second taxable account bought 12 days ago: 100 of 400 matched'))
    add(make_case('2026-09-20', 'single', 120000, 0, 6000, 0,
                  [Hd('ZZDIV', 'taxable', '40.00', [('2023-03-01', 100, 5000), ('2026-09-10', 50, 2250)])],
                  'SAME-DAY (W3, same_day_sensitive): both lots sold; the key treats neither as a replacement (long '
                  '$1,000 + short $250 allowed). Literal 1091: $500 of the old lot disallowed into the new lot, which '
                  'turns long-term: long $1,250, short $0, the same total'))
    add(make_case('2026-04-17', 'head_of_household', 76000, 0, 0, 0,
                  [Hd('ZZSML', 'taxable', '15.00', [('2019-10-10', 300, 6000), ('2026-04-01', 80, 1100)])],
                  'a recent gain lot in the same holding is the replacement: 80 of 300 matched'))
    add(make_case('2026-04-17', 'head_of_household', 76000, 0, 0, 0,
                  [Hd('ZZTOT', 'taxable', '15.00', [('2019-10-10', 300, 6000)]),
                   Hd('ZZINT', 'taxable', '15.00', [('2026-04-01', 80, 1100)])],
                  'W1: a different ticker bought 16 days ago is not substantially identical (convention): no wash sale'))
    add(make_case('2025-07-31', 'married_separate', 90000, 0, 0, 0,
                  [Hd('ZZTEC', 'taxable', '30.00', [('2024-02-14', 100, 4200)]),
                   Hd('ZZTEC', 'ira', '30.00', [('2025-07-25', 25, 760)])],
                  'C3: the IRA (filer or spouse) bought 25 shares 6 days ago: 25 of 100 matched, lost for good'))
    # holding period on the page
    for d, lab in (('2025-06-15', 'today is the anniversary: short, 1 day to go (marginal rate)'),
                   ('2025-06-14', 'today is the day after the anniversary: long (gains rate)'),
                   ('2025-06-16', 'today is the day before the anniversary: short, 2 days to go')):
        add(make_case('2026-06-15', 'single', 95000, 0, 0, 0,
                      [Hd('ZZTOT', 'taxable', '30.00', [(d, 200, 7000)])], lab))
    add(make_case('2025-05-05', 'married_joint', 110000, 0, 0, 0,
                  [Hd('ZZBND', 'taxable', '12.00', [('2023-02-28', 500, 7000)])],
                  'bought February 28, 2023: law long-term from 2024-03-01, page from 2024-02-29 (lot_page_contrast)'))
    add(make_case('2026-03-10', 'single', 72000, 0, 0, 0,
                  [Hd('ZZSML', 'taxable', '18.00', [('2025-03-10', 100, 2000)]),
                   Hd('ZZINT', 'taxable', '18.00', [('2026-03-10', 100, 2000)])],
                  'a lot bought a year ago today (1 day to go) and one bought today (366 days to go), different symbols'))
    add(make_case('2026-12-31', 'single', 72000, 0, 0, 0,
                  [Hd('ZZSML', 'taxable', '18.00', [('2025-12-31', 100, 2000), ('2025-12-30', 100, 2000),
                                                    ('2026-01-01', 100, 2000)])],
                  'December 31: lots of 2025-12-30 (long), 2025-12-31 (short, 1 day), 2026-01-01 (short, 2 days)'))
    add(make_case('2026-01-01', 'married_joint', 130000, 0, 0, 0,
                  [Hd('ZZDIV', 'taxable', '22.00', [('2025-01-01', 100, 2500), ('2024-12-31', 100, 2500)])],
                  'January 1: a 2025-01-01 lot short (1 day), a 2024-12-31 lot long'))
    add(make_case('2025-08-08', 'single', 66000, 0, 0, 0,
                  [Hd('ZZTEC', 'taxable', '33.00', [('', 50, 2000), ('', 30, 900), ('2025-05-05', 10, 400)])],
                  'lots without dates: long-term, 0 days (page convention); never replacements (W4)'))
    # the order to sell
    add(make_case('2026-07-07', 'single', 88000, 0, 0, 0,
                  [Hd('ZZTOT', 'taxable', '20.00', [('2023-07-07', 10, 250), ('2024-07-07', 10, 150)]),
                   Hd('ZZBND', 'taxable', '30.00', [('2023-08-08', 4, 140), ('2022-01-01', 5, 100)]),
                   Hd('ZZTEC', 'taxable', '60.00', [('2021-01-01', 2, 130)])],
                  'ties in gain per share (-5.00 for 0|0, 1|0 and 2|0): input order decides (O1)'))
    big = []
    for h, sym in enumerate(('ZZTOT', 'ZZINT', 'ZZTEC', 'ZZDIV')):
        price = ('41.10', '18.35', '77.25', '29.90')[h]
        lots = []
        for k in range(4):
            dt = date(2019 + k, 1 + 3 * h, 10 + k)
            sh = 50 + 25 * k + 10 * h
            cost = fr(price) * sh * F(70 + 17 * k + 9 * h, 100)
            lots.append((dt.isoformat(), sh, F(rhu(cost * 100), 100)))
        big.append(Hd(sym, 'taxable', price, lots, shares=sum(x[1] for x in lots) + 15,
                      basis=sum((x[2] for x in lots), ZERO) + fr(price) * 15))
    add(make_case('2026-11-02', 'married_joint', 180000, 9000, 0, 12000, big,
                  '16 taxable lots and 4 unassigned: only the first eight are listed'))
    add(make_case('2026-12-08', 'single', 150000, 0, 0, 0,
                  [Hd('ZZTEC', 'taxable', '100.00', [('2026-03-02', 10, 600), ('2020-05-05', 20, 1500)]),
                   Hd('ZZTOT', 'taxable', '10.00', [('2026-06-01', 500, 4200), ('2019-01-07', 400, 4300)])],
                  'the page orders by gain per share (1|1, 1|0, 0|1, 0|0); the contrast puts the long lot 0|1 before the '
                  'short lot 1|0 (less tax per dollar raised)'))
    # large realized gains, both kinds; realized losses
    add(make_case('2026-10-30', 'married_joint', 160000, 12000, 150000, 0,
                  [Hd('ZZTEC', 'taxable', '55.00', [('2026-02-02', 1000, 70000), ('2018-04-04', 800, 60000)])],
                  'large short-term gains this year ($150,000): the harvest cancels gains taxed at ordinary rates'))
    add(make_case('2025-11-21', 'single', 180000, 8000, 0, 200000,
                  [Hd('ZZTOT', 'taxable', '75.00', [('2025-05-05', 600, 60000), ('2017-09-09', 1000, 110000)])],
                  'large long-term gains this year ($200,000) and NIIT on both sides'))
    add(make_case('2025-11-21', 'head_of_household', 70000, 1000, -8000, 15000,
                  [Hd('ZZINT', 'taxable', '12.00', [('2025-08-01', 500, 7000)])],
                  'a realized short-term loss and long-term gain, then a short harvest'))
    add(make_case('2026-11-23', 'married_separate', 60000, 0, -2000, -4000,
                  [Hd('ZZDIV', 'taxable', '14.00', [('2024-11-01', 300, 6000)])],
                  'realized losses already over the $1,500 limit: the harvest only adds carryover (law $0)'))
    return E


# ======================================== households: the random generator ========================================

def pick(rng, weighted):
    total = sum(w for _, w in weighted)
    x = rng.randrange(total)
    for v, w in weighted:
        if x < w:
            return v
        x -= w
    raise AssertionError


def cents(rng, lo, hi, p_whole=70):
    """A whole-cent Fraction from lo to hi dollars (ints); whole dollars p_whole% of the time."""
    if rng.randrange(100) < p_whole:
        return F(rng.randrange(lo, hi + 1))
    return F(rng.randrange(lo * 100, hi * 100 + 1), 100)


def random_income(rng, year, st):
    sd = R.STANDARD_DEDUCTION[year][st]
    z = R.CG_ZERO_TOP[year][st]
    thr = R.NIIT_THRESHOLD[st]
    band = pick(rng, (('zero', 6), ('zero_band', 20), ('zero_top', 5), ('mid', 29), ('niit_edge', 17), ('high', 17),
                      ('top', 6)))
    if band == 'zero':
        i = cents(rng, 0, sd)
    elif band == 'zero_band':
        i = cents(rng, sd, sd + z)
    elif band == 'zero_top':   # taxable income within about $1,000 of the 0% top
        i = cents(rng, sd + z - 1500, sd + z + 300)
    elif band == 'mid':
        i = cents(rng, sd + z, sd + z + 150000)
    elif band == 'niit_edge':
        i = cents(rng, thr - 8000, thr + 4000)
    elif band == 'high':
        i = cents(rng, thr + 4000, thr + 400000)
    else:
        i = cents(rng, 600000, 1500000)
    q = pick(rng, (('none', 40), ('small', 35), ('large', 25)))
    q = ZERO if q == 'none' else cents(rng, 1, 5000) if q == 'small' else cents(rng, 5000, 60000)
    if band == 'zero_top':
        q = ZERO if rng.randrange(2) else cents(rng, 1, 400)
    if band == 'niit_edge' and q > 3000 and rng.randrange(2):
        q = cents(rng, 0, 3000)
    return i, q, band


def random_realized(rng):
    k = pick(rng, (('zero', 45), ('small_gain', 15), ('large_gain', 10), ('small_loss', 20), ('large_loss', 10)))
    if k == 'zero':
        return ZERO
    if k == 'small_gain':
        return cents(rng, 1, 10000)
    if k == 'large_gain':
        return cents(rng, 20000, 250000)
    if k == 'small_loss':
        return -cents(rng, 1, 10000)
    return -cents(rng, 10000, 80000)


def random_today(rng, year, scenario):
    if scenario == 'feb29':
        return date(2025, 2, 25) + rng.randrange(8) * DAY
    k = rng.randrange(100)
    if k < 5:
        return date(year, 12, 31)
    if k < 8:
        return date(year, 1, 1)
    return date(year, 1, 1) + rng.randrange((date(year, 12, 31) - date(year, 1, 1)).days + 1) * DAY


def random_lot_date(rng, today, kind=None):
    k = kind or pick(rng, (('blank', 6), ('on', 4), ('after', 4), ('before', 4), ('window', 7), ('edge30', 3),
                           ('feb29', 1), ('feb28', 1), ('short', 28), ('long', 42)))
    if k == 'blank':
        return None
    if k in ('on', 'after', 'before'):
        a = today - {'on': 0, 'after': 1, 'before': -1}[k] * DAY   # the purchase's anniversary
        return date(a.year - 1, a.month, a.day)
    if k == 'window':
        return today - rng.randrange(31) * DAY
    if k == 'edge30':
        return today - (30, 31, 0)[rng.randrange(3)] * DAY
    if k == 'feb29':
        return date(2024, 2, 29)
    if k == 'feb28':
        return (date(2023, 2, 28), date(2019, 2, 28))[rng.randrange(2)]
    if k == 'short':
        return today - rng.randrange(31, 365) * DAY
    lo = date(2012, 1, 1)
    hi = today - 367 * DAY
    return lo + rng.randrange((hi - lo).days + 1) * DAY


def random_shares(rng):
    if rng.randrange(100) < 80:
        return F(rng.randrange(1, 1501))
    return F(rng.randrange(1, 1000000), 1000)


def cost_for(rng, shares, price, kind=None):
    k = kind or pick(rng, (('gain', 45), ('loss', 42), ('flat', 13)))
    if k == 'gain':
        f = rng.randrange(300, 995)
    elif k == 'loss':
        f = rng.randrange(1005, 1800)
    else:
        f = rng.randrange(985, 1016)
    return F(rhu(shares * price * f / 1000 * 100), 100)


def random_case(rng, scenario):
    year = 2025 if scenario == 'feb29' else (2025, 2026)[rng.randrange(2)]
    st = pick(rng, (('single', 30), ('married_joint', 35), ('married_separate', 15), ('head_of_household', 20)))
    today = random_today(rng, year, scenario)
    i, q, band = random_income(rng, year, st)
    s, l = random_realized(rng), random_realized(rng)
    if band == 'zero_top' and rng.randrange(100) < 70:
        s = l = ZERO
    n_h = pick(rng, ((1, 20), (2, 30), (3, 25), (4, 25)))
    if scenario in ('ira_wash', 'taxable_wash'):
        n_h = max(n_h, 2)
    holdings = []
    for h in range(n_h):
        if scenario == 'ira_only':
            kind = 'ira'
        else:
            kind = 'taxable' if rng.randrange(100) < 75 else 'ira'
        sym = TICKERS[rng.randrange(len(TICKERS))]
        price = F(rng.randrange(500, 50001), 100)
        if h > 0 and rng.randrange(100) < 25:
            other = holdings[rng.randrange(h)]
            sym, price = other['sym'], other['price']   # the same security has one price today
            if scenario != 'ira_only':
                kind = ('ira' if other['kind'] == 'taxable' else 'taxable') if rng.randrange(100) < 85 else other['kind']
        for other in holdings:   # a ticker drawn twice by chance is still one security with one price
            if other['sym'] == sym:
                price = other['price']
                break
        holdings.append({'sym': sym, 'kind': kind, 'price': price, 'lots': []})
    if scenario in ('ira_wash', 'taxable_wash'):
        holdings[0]['kind'] = 'taxable'
        holdings[1]['sym'] = holdings[0]['sym']
        holdings[1]['price'] = holdings[0]['price']
        holdings[1]['kind'] = 'ira' if scenario == 'ira_wash' else 'taxable'
    for h, H in enumerate(holdings):
        n_l = pick(rng, ((0, 7), (1, 25), (2, 25), (3, 20), (4, 23)))
        forced = []
        if scenario in ('ira_wash', 'taxable_wash') and h == 0:
            forced = [('long', 'loss')]
            n_l = max(n_l, 1)
        if scenario in ('ira_wash', 'taxable_wash') and h == 1:
            forced = [('window', 'gain' if scenario == 'taxable_wash' else None)]
            n_l = max(n_l, 1)
        if scenario == 'feb29' and h == 0:
            forced = [('feb29', None)]
            n_l = max(n_l, 1)
        for k in range(n_l):
            dk, ck = forced[k] if k < len(forced) else (None, None)
            dt = random_lot_date(rng, today, dk)
            sh = random_shares(rng)
            H['lots'].append((dt, sh, cost_for(rng, sh, H['price'], ck)))
        sh_sum = sum((x[1] for x in H['lots']), ZERO)
        cost_sum = sum((x[2] for x in H['lots']), ZERO)
        if n_l == 0 or rng.randrange(100) < 22:
            extra = random_shares(rng)
            extra_cost = cost_for(rng, extra, H['price'])
            basis = cost_sum + extra_cost
            if n_l > 0 and rng.randrange(100) < 5:
                basis = F(rhu(cost_sum * F(rng.randrange(80, 100), 100) * 100), 100)   # below the lots' cost
            H['shares'], H['basis'] = sh_sum + extra, basis
    case = make_case(today, st, i, q, s, l,
                     [{k: v for k, v in H.items() if k in ('sym', 'kind', 'price', 'lots', 'shares', 'basis')}
                      for H in holdings], kind='random')
    return case, band


def one_price_per_ticker(c):
    seen = {}
    for part in c['holdings'].split(';'):
        sym, _, price = part.split('|')[:3]
        if seen.setdefault(sym, price) != price:
            return False
    return True


def tolerance_sensitive(d1):
    """A taxable lot whose loss sits within a cent of the $1 line: only labelled edge rows may do that."""
    return any(l['account'] == 'taxable' and F(99, 100) <= l['cost'] - l['value'] <= F(101, 100) for l in d1['lots'])


# ======================================== RULES.md examples, worked by derivation 2 ========================================

def check_examples():
    """RULES.md section 10 and the sources' own examples, through derivation 2 only."""
    n = 0
    edges = edge_cases()

    def d2(prefix):
        hits = [c for c in edges if c['edge_note'].startswith(prefix)]
        assert len(hits) == 1, ('edge note prefix', prefix, len(hits))
        return derive_2(hits[0])

    a = d2('RULES.md 10.1')
    assert a['_w0']['income_tax'] == 48104 and a['_w0']['niit'] == 1520, ('10.1 without', a['_w0'])
    assert a['_w1']['income_tax'] == 47144 and a['_w1']['niit'] == 1406, ('10.1 with', a['_w1'])
    assert a['law_saved'] == 1074 and a['page_total'] == 7520 and rate6(a['ratio']) == '0.142819', '10.1'
    assert a['rates'] == {'marginal': F('0.358'), 'gains': F('0.188')} and a['carry_with'] == (0, 37000), '10.1 rates'
    n += 4
    b = d2('RULES.md 10.2')
    assert b['tax_without'] == 13413 and b['tax_with'] == 10413 and b['law_saved'] == 3000, '10.2'
    assert b['rates'] == {'marginal': F('0.27'), 'gains': F('0.15')} and b['page_total'] == 3960, '10.2 page'
    assert rate6(b['ratio']) == '0.757576' and b['carry_with'] == (0, 0), '10.2 ratio'
    n += 3
    for prefix, term, days, page in (('RULES.md 10.3 Dee on 2025-02-28', 'short', 1, 96),
                                     ('RULES.md 10.3 Dee on 2025-03-01', 'long', 0, 0)):
        x = d2(prefix)
        assert x['lots'][0]['term'] == term and x['lots'][0]['days'] == days, prefix
        assert x['lots'][0]['long_on'] == date(2025, 3, 1) == x['lots'][0]['long_on_page'], prefix
        assert x['page_total'] == page and x['law_saved'] == 96, prefix
        assert x['tax_without'] == F('3871.50') and x['tax_with'] == F('3775.50'), prefix
        n += 4
    e = d2('RULES.md 10.4 Eve:')
    h = e['harvest'][0]
    assert h['wash'] and h['matched'] == 50 and h['disallowed'] == 1000, '10.4 wash'
    assert e['matches'] == [{'sold': '0|0', 'repl': '1|0', 'shares': 50, 'disallowed': 1000, 'account': 'ira',
                             'new_basis': None}], '10.4 match'
    assert e['tax_without'] == 9013 and e['tax_with'] == 8493 and e['law_saved'] == 520, '10.4'
    assert e['page_total'] == 600 and rate6(e['ratio']) == '0.866667', '10.4 page'
    assert d2('RULES.md 10.4 Eve without')['law_saved'] == 740, '10.4 without'
    n += 5
    # hand figures of the edge notes
    assert d2('K1')['carry_with'] == (0, 10000), 'K1'
    x = d2('net loss $3000.00 against the $3,000')
    assert x['carry_with'] == (0, 0), '3000.00'
    assert d2('net loss $3000.01 against the $3,000')['carry_with'] == (0, F('0.01')), '3000.01'
    assert d2('net loss $1500.01 against the $1,500')['carry_with'] == (0, F('0.01')), '1500.01'
    assert d2('net loss $1500.00 against the $1,500')['carry_with'] == (0, 0), '1500.00'
    n += 5
    assert d2('MAGI exactly $200,000')['rates']['marginal'] == F('0.278'), 'NIIT 200,000'
    x = d2('MAGI $199,500')
    assert x['rates'] == {'marginal': F('0.259'), 'gains': F('0.169')} and x['law_saved'] == 360, 'NIIT 199,500'
    assert x['page_total'] == F('388.5'), 'NIIT 199,500 page'
    x = d2('MAGI $201,000')
    assert x['niit_without'] == 38 and x['niit_with'] == 0, 'NIIT 201,000'
    x = d2('all income a $300,000')
    assert x['niit_without'] == 3800 and x['tax_with'] == 0 and x['carry_with'] == (0, 100000), 'NII 0'
    n += 5
    x = d2('taxable income in the 0% band')
    assert x['rates']['gains'] == 0 and x['page_total'] == 0 and x['law_saved'] == 230 and x['ratio'] is None, '0% band'
    assert d2('$1,000 more of dividends straddles')['rates']['gains'] == F('0.0825'), 'straddle'
    x = d2('dividends above the 0% top but inside the 12%')
    assert x['rates'] == {'marginal': F('0.145'), 'gains': F('0.165')}, ('worksheet cap', x['rates'])
    assert x['_w0']['regular'] < x['_w0']['stacked'] and x['tax_without'] == 5752, 'worksheet cap 2'
    x = d2('top bracket')
    assert x['rates'] == {'marginal': F('0.408'), 'gains': F('0.238')}, 'top'
    x = d2('a long loss against short-term gains')
    assert x['page_total'] == 1500 and x['law_saved'] == 2200 and rate6(x['ratio']) == '1.466667', 'cross'
    n += 6
    x = d2('replacement bought today - 30 days')
    assert x['matches'] == [{'sold': '0|0', 'repl': '0|1', 'shares': 40, 'disallowed': 1200, 'account': 'taxable',
                             'new_basis': 3100}], 'today-30'
    assert not d2('replacement bought today - 31 days')['harvest'][0]['wash'], 'today-31'
    x = d2('1.1091-1(b), (c)')
    assert [(m['sold'], m['shares'], m['disallowed'], m['new_basis']) for m in x['matches']] == \
        [('0|0', 50, 1000, 2900), ('0|1', 100, 3000, 6800)], ('1.1091-1(b)', x['matches'])
    x = d2('W4: the undated')
    assert [(m['sold'], m['shares']) for m in x['matches']] == [('0|u', 60)], ('W4', x['matches'])
    assert [(h['key'], h['wash'], h['plain']) for h in x['harvest']] == [('0|0', False, True), ('0|u', True, True)], 'W4b'
    n += 5
    # the sources' own wash-sale examples (CFR10911 (h) Example 2 = P550 Example 1; CFR10912 Examples 1-2; RR0805)
    lots = [{'key': k, 'idx': n_, 'sym': 'M', 'acct': 'taxable', 'date': d_(dt), 'shares': F(s), 'cost': F(c),
             'value': F(s) * 40} for n_, (k, dt, s, c) in enumerate((('a', '1954-09-21', 100, 5000),
                                                                     ('b', '1954-12-21', 50, 2750),
                                                                     ('c', '1954-12-27', 25, 1125)))]
    w = wash_2(lots, d_('1955-01-03'), ['a'])['a']
    assert w['disallowed'] == 750 and w['matched'] == 75, 'CFR Example 2'
    assert [ch['new_basis'] for ch in w['chunks']] == [3250, 1375], 'CFR Example 2 bases'
    for new, basis in ((90, 110), (70, 90)):
        lots = [{'key': 'o', 'idx': 0, 'sym': 'Y', 'acct': 'taxable', 'date': d_('1935-06-01'), 'shares': F(1),
                 'cost': F(100), 'value': F(80)},
                {'key': 'n', 'idx': 1, 'sym': 'Y', 'acct': 'taxable', 'date': d_('1955-01-01'), 'shares': F(1),
                 'cost': F(new), 'value': F(80)}]
        assert wash_2(lots, d_('1955-01-15'), ['o'])['o']['chunks'][0]['new_basis'] == basis, 'CFR 1.1091-2'
    lots = [{'key': 's', 'idx': 0, 'sym': 'X', 'acct': 'taxable', 'date': d_('2007-01-02'), 'shares': F(100),
             'cost': F(1000), 'value': F(600)},
            {'key': 'i', 'idx': 1, 'sym': 'X', 'acct': 'ira', 'date': d_('2007-12-21'), 'shares': F(100),
             'cost': F(600), 'value': F(600)}]
    w = wash_2(lots, d_('2007-12-20'), ['s'])['s']
    assert w['disallowed'] == 400 and w['chunks'][0]['new_basis'] is None, 'Rev. Rul. 2008-5'
    n += 5
    # P550 carryover example (Bob and Shelly): $7,000 loss, taxable income $26,000 -> carry $4,000
    assert sum(fed_2(2025, 'married_joint', F(60500), ZERO, F(-7000), ZERO)['carry']) == 4000, 'P550 carryover'
    # P550 holding-period example: bought January 31, 2024: short on January 29, 2025, long on February 6, 2025
    assert term_2(d_('2024-01-31'), d_('2025-01-29'))['term'] == 'short', 'P550 holding'
    assert term_2(d_('2024-01-31'), d_('2025-02-06'))['term'] == 'long', 'P550 holding'
    assert long_on_law_2(d_('2023-02-28')) == date(2024, 3, 1) and long_on_page_2(d_('2023-02-28')) == date(2024, 2, 29)
    n += 4
    return n


# ======================================== households: rows, notes, statistics ========================================

INPUT_KEYS = ('case_id', 'row_kind', 'tax_year', 'today', 'filing_status', 'other_ordinary', 'qualified_dividends',
              'st_realized', 'lt_realized', 'holdings', 'lots')
HOUSEHOLD_COLUMNS = list(INPUT_KEYS) + [
    'lot_results', 'lot_page_contrast', 'holding_results', 'marginal_rate', 'gains_rate', 'harvest', 'harvest_count',
    'harvest_total', 'page_tax_saved_total', 'short_losses', 'long_losses', 'disallowed_total', 'short_losses_allowed',
    'long_losses_allowed', 'tax_without', 'tax_with', 'niit_without', 'niit_with', 'harvest_tax_saved_law',
    'ratio_law_to_page', 'harvest_carryover_short', 'harvest_carryover_long', 'carryover_without_short',
    'carryover_without_long', 'carryover_added_short', 'carryover_added_long', 'wash_matches', 'wash_plain_test',
    'wash_basis_note', 'same_day_sensitive', 'sell_first', 'sell_first_tie', 'sell_first_tax_per_dollar', 'note']


def basis_note(c, d1):
    """Plain words for each wash sale (rendered from derivation 1's compared values)."""
    today = date.fromisoformat(c['today'])
    terms = {l['key']: l['term'] for l in d1['lots']}
    parts = []
    for m in d1['matches']:
        if m['account'] == 'ira':
            parts.append(f'{m["sold"]} matched {dec_str(m["shares"])} sh of {m["repl"]} (IRA, bought '
                         f'{iso(m["repl_date"])}): {money(m["disallowed"])} lost for good, IRA basis not increased '
                         f'(Rev. Rul. 2008-5)')
        else:
            hp = ('long-term at once' if terms[m['sold']] == 'long' else 'holding period includes the sold lot\'s')
            parts.append(f'{m["sold"]} matched {dec_str(m["shares"])} sh of {m["repl"]} (taxable, bought '
                         f'{iso(m["repl_date"])}): basis {money(m["new_basis"] - m["disallowed"])} + '
                         f'{money(m["disallowed"])} = {money(m["new_basis"])}, {hp} (1091(d), 1223(3))')
    if d1['harvest']:
        syms = sorted({l['symbol'] for l in d1['lots'] if l['key'] in {h['key'] for h in d1['harvest']}})
        parts.append(f'not knowable today: buying {", ".join(syms)} by {iso(today + 30 * DAY)} would also make a wash '
                     'sale')
    return ' / '.join(parts)


def worksheet_cap_binds(c, fed):
    """True when the Qualified Dividends and Capital Gain Tax Worksheet's line 24 (regular tax) is below line 23."""
    year, st, q = int(c['tax_year']), c['filing_status'], fr(c['qualified_dividends'])
    ncg = fed['schedule_d']['net_capital_gain']
    if q + ncg <= 0:
        return False
    ws = R.qdcg_tax(year, st, fed['taxable_income'], q, ncg)
    stacked = R.regular_tax(year, st, ws['line5']) + F(15, 100) * ws['line17'] + F(20, 100) * ws['line20']
    return R.regular_tax(year, st, fed['taxable_income']) < stacked


def auto_note(c, d1):
    r = d1['_r']
    notes = []
    if d1['same_day']:
        notes.append('same-day sensitive (W3)')
    if any(m['account'] == 'ira' for m in d1['matches']):
        notes.append('wash sale with an IRA purchase: loss lost for good')
    if any(m['account'] == 'taxable' for m in d1['matches']):
        notes.append('wash sale with a taxable purchase: basis moves to the new lot')
    if any(h['plain'] != h['wash'] for h in d1['harvest']):
        notes.append('the plain 30-day test and the share-for-share match differ')
    hs = parse_1(c)
    for h, H in enumerate(hs):
        lot_cost = sum((fr(x[2]) for x in H['lots']), ZERO)
        if fr(H['total_shares']) > sum((fr(x[1]) for x in H['lots']), ZERO) and fr(H['total_cost']) < lot_cost:
            notes.append(f'holding {h}: unassigned cost floored at 0')
    if any(l['long_on'] != l['long_on_page'] for l in d1['lots']):
        notes.append('first long-term day differs (law / page)')
    if d1['tie']:
        notes.append('a tie in gain per share decides the order to sell')
    if worksheet_cap_binds(c, r['without']):
        notes.append('worksheet line 25 takes the regular tax')
    if d1['carry_with'][0] + d1['carry_with'][1] > 0:
        notes.append('harvest leaves a carryover')
    return '; '.join(notes)


def household_row(cid, c, d1):
    lot_results = ';'.join(f'{l["key"]}|{money(l["value"])}|{money(l["gain"])}|{l["term"]}|{iso(l["long_on"])}|'
                           f'{l["days"]}|{yn(l["assigned"])}' for l in d1['lots'])
    contrast = ';'.join(f'{l["key"]}|{iso(l["long_on_page"])}|{l["term_page"]}|{l["days_page"]}' for l in d1['lots']
                        if (l['long_on'], l['term'], l['days']) != (l['long_on_page'], l['term_page'], l['days_page']))
    holding_results = ';'.join(f'{x["h"]}|{dec_str(x["shares"])}|{money(x["value"])}|{money(x["cost"])}|'
                               f'{money(x["gain"])}' for x in d1['holdings'])
    harvest = ';'.join(f'{x["key"]}|{money(x["loss"])}|{money(x["page"])}|{yn(x["wash"])}|{money(x["disallowed"])}'
                       for x in d1['harvest'])
    matches = ';'.join(f'{m["sold"]}|{m["repl"]}|{dec_str(m["shares"])}|{money(m["disallowed"])}|{m["account"]}|'
                       f'{money(m["new_basis"])}' for m in d1['matches'])
    note = c['edge_note'] if c['row_kind'] == 'edge' else auto_note(c, d1)
    row = {k: c[k] for k in INPUT_KEYS if k != 'case_id'}
    row.update({'case_id': cid, 'lot_results': lot_results, 'lot_page_contrast': contrast,
                'holding_results': holding_results, 'marginal_rate': rate6(d1['rates']['marginal']),
                'gains_rate': rate6(d1['rates']['gains']), 'harvest': harvest, 'harvest_count': len(d1['harvest']),
                'harvest_total': money(d1['harvest_total']), 'page_tax_saved_total': money(d1['page_total']),
                'short_losses': money(d1['short_losses']), 'long_losses': money(d1['long_losses']),
                'disallowed_total': money(d1['disallowed_total']), 'short_losses_allowed': money(d1['short_allowed']),
                'long_losses_allowed': money(d1['long_allowed']), 'tax_without': money(d1['tax_without']),
                'tax_with': money(d1['tax_with']), 'niit_without': money(d1['niit_without']),
                'niit_with': money(d1['niit_with']), 'harvest_tax_saved_law': money(d1['law_saved']),
                'ratio_law_to_page': rate6(d1['ratio']),
                'harvest_carryover_short': money(d1['carry_with'][0]),
                'harvest_carryover_long': money(d1['carry_with'][1]),
                'carryover_without_short': money(d1['carry_without'][0]),
                'carryover_without_long': money(d1['carry_without'][1]),
                'carryover_added_short': money(d1['carry_new'][0]), 'carryover_added_long': money(d1['carry_new'][1]),
                'wash_matches': matches,
                'wash_plain_test': ';'.join(x['key'] for x in d1['harvest'] if x['plain']),
                'wash_basis_note': basis_note(c, d1), 'same_day_sensitive': yn(d1['same_day']),
                'sell_first': ';'.join(d1['sell_first']), 'sell_first_tie': yn(d1['tie']),
                'sell_first_tax_per_dollar': ';'.join(d1['sell_contrast']), 'note': note})
    return row


def written_amounts(d1):
    out = [d1[k] for k in ('harvest_total', 'page_total', 'short_losses', 'long_losses', 'disallowed_total',
                           'short_allowed', 'long_allowed', 'tax_without', 'tax_with', 'niit_without', 'niit_with',
                           'law_saved')]
    out += list(d1['carry_with']) + list(d1['carry_without']) + list(d1['carry_new'])
    for l in d1['lots']:
        out += [l['value'], l['gain']]
    for x in d1['holdings']:
        out += [x['value'], x['cost'], x['gain']]
    for x in d1['harvest']:
        out += [x['loss'], x['page'], x['disallowed']]
    for m in d1['matches']:
        out += [m['disallowed'], m['new_basis']]
    return [v for v in out if v is not None]


def stats_row(s, c, d1, edge, band):
    r = d1['_r']
    year, st = int(c['tax_year']), c['filing_status']
    today = date.fromisoformat(c['today'])
    S, L = fr(c['st_realized']), fr(c['lt_realized'])
    s[f'year {year}'] += 1
    s[f'status {st}'] += 1
    if band:
        s[f'income band {band}'] += 1
    s['realized: no gains or losses (st 0, lt 0)'] += S == 0 and L == 0
    s['realized: short-term gain 20,000 or more'] += S >= 20000
    s['realized: long-term gain 20,000 or more'] += L >= 20000
    s['realized: short-term negative'] += S < 0
    s['realized: long-term negative'] += L < 0
    s['realized: both kinds gains'] += S > 0 and L > 0
    sd = r['with']['schedule_d']
    lim = R.loss_limit(st)
    if sd['line16'] < 0:
        s['after harvest: net loss up to the limit'] += -sd['line16'] <= lim
        s['after harvest: net loss above the limit (carryover)'] += -sd['line16'] > lim
    else:
        s['after harvest: net gain or 0'] += 1
    s['harvest moves the net from gain to loss'] += r['without']['schedule_d']['line16'] >= 0 > sd['line16']
    thr = R.NIIT_THRESHOLD[st]
    s['NIIT without: MAGI above the line'] += r['without']['agi'] > thr
    s['NIIT without: MAGI at or below the line'] += r['without']['agi'] <= thr
    s['NIIT paid without harvest'] += d1['niit_without'] > 0
    s['NIIT changes with the harvest'] += d1['niit_without'] != d1['niit_with']
    s['NIIT crossed (paid without, 0 with)'] += d1['niit_without'] > 0 == d1['niit_with']
    g, m = d1['rates']['gains'], d1['rates']['marginal']
    i, q = fr(c['other_ordinary']), fr(c['qualified_dividends'])
    w0 = r['without']
    up_i, up_q = R.federal_tax(year, st, i + 1000, q, S, L), R.federal_tax(year, st, i, q + 1000, S, L)
    s['gains rate 0 (0% band)'] += g == 0
    s['gains rate between 0 and 0.15'] += 0 < g < F(15, 100)
    s['gains rate 0.15'] += g == F(15, 100)
    s['gains rate 0.20 or more'] += g >= F(20, 100)
    s['gains rate includes NIIT'] += up_q['niit'] > w0['niit']
    s['marginal rate includes NIIT'] += up_i['niit'] > w0['niit']
    s['rate includes part of the NIIT (the $1,000 crosses the line)'] += 0 < up_i['niit'] - w0['niit'] < 38
    s['gains rate above the marginal rate'] += g > m
    s['marginal rate 0'] += m == 0
    s['rate with more than six decimals'] += (m * 10 ** 6).denominator != 1 or (g * 10 ** 6).denominator != 1
    lots = d1['lots']
    s['lots'] += len(lots)
    s['lots taxable'] += sum(l['account'] == 'taxable' for l in lots)
    s['lots unassigned'] += sum(not l['assigned'] for l in lots)
    s['rows with an unassigned lot'] += any(not l['assigned'] for l in lots)
    with_lots = {x.split('|')[0] for x in c['lots'].split(';') if x}
    s['rows with a holding with no lots'] += any(str(h) not in with_lots for h in range(len(c['holdings'].split(';'))))
    s['lots undated (typed)'] += sum(l['assigned'] and l['date'] is None for l in lots)
    s['rows with an undated typed lot'] += any(l['assigned'] and l['date'] is None for l in lots)
    s['lots short-term'] += sum(l['term'] == 'short' for l in lots)
    s['lots long-term'] += sum(l['term'] == 'long' for l in lots)
    s['lots bought 2024-02-29'] += sum(l['date'] == date(2024, 2, 29) for l in lots)
    s['lots whose law and page first long-term day differ'] += sum(l['long_on'] != l['long_on_page'] for l in lots)
    s['lots whose law and page term today differ (never in 2025-2026)'] += sum(l['term'] != l['term_page'] for l in lots)
    for l in lots:
        if l['date'] is not None:
            a = anniv(l['date'])
            s['lots seen on their anniversary (short, 1 day)'] += today == a
            s['lots seen the day after their anniversary (long)'] += today == a + DAY
            s['lots seen the day before their anniversary (short, 2 days)'] += today == a - DAY
            s['lots bought in the 30-day window'] += 0 <= (today - l['date']).days <= 30
            s['lots bought exactly today - 30 / today - 31'] += (today - l['date']).days in (30, 31)
            s['lots bought today'] += l['date'] == today
    syms = [(x.split('|')[0], x.split('|')[1]) for x in c['holdings'].split(';')]
    s['rows with a symbol in two holdings'] += len({x[0] for x in syms}) < len(syms)
    s['rows with a symbol in taxable and IRA'] += any(a[0] == b[0] and a[1] != b[1] for a in syms for b in syms)
    s['rows IRA only'] += all(k == 'ira' for _, k in syms)
    s['rows with more than eight taxable lots'] += sum(l['account'] == 'taxable' for l in lots) > 8
    hv = d1['harvest']
    s['candidates'] += len(hv)
    s['rows with no candidate'] += not hv
    s['candidates short-term'] += sum(x['term'] == 'short' for x in hv)
    s['candidates long-term'] += sum(x['term'] == 'long' for x in hv)
    s['candidates that are unassigned lots'] += sum(x['key'].endswith('|u') for x in hv)
    s['wash sales (candidates)'] += sum(x['wash'] for x in hv)
    s['wash sales partly matched'] += sum(x['wash'] and x['disallowed'] < x['loss'] for x in hv)
    s['rows with a wash sale against an IRA purchase'] += any(m['account'] == 'ira' for m in d1['matches'])
    s['rows with a wash sale against a taxable purchase'] += any(m['account'] == 'taxable' for m in d1['matches'])
    s['candidates where the plain test and the match differ'] += sum(x['plain'] != x['wash'] for x in hv)
    s['rows same-day sensitive'] += d1['same_day']
    s['rows with a tie that decides the order to sell'] += d1['tie']
    s['rows where the contrast order differs'] += d1['sell_first'] != d1['sell_contrast']
    s['rows page total 0 with candidates'] += bool(hv) and d1['page_total'] == 0
    if d1['ratio'] is not None:
        s['law saves less than the page'] += d1['law_saved'] < d1['page_total']
        s['law saves more than the page'] += d1['law_saved'] > d1['page_total']
        s['law saves the same as the page'] += d1['law_saved'] == d1['page_total']
    s['law saved negative (never expected)'] += d1['law_saved'] < 0
    s['carryover after harvest > 0'] += sum(d1['carry_with']) > 0
    s['carryover without harvest > 0'] += sum(d1['carry_without']) > 0
    s['carryover with a short part'] += d1['carry_with'][0] > 0
    s['carryover with a long part'] += d1['carry_with'][1] > 0
    s['taxable income negative after harvest (K1 rows)'] += r['with']['taxable_income_signed'] < 0 and \
        sum(d1['carry_with']) > 0
    s['written amounts'] += len(written_amounts(d1))
    s['written amounts exactly on a half cent'] += sum(half_cent(v) for v in written_amounts(d1))
    if 'largest harvest' not in s or d1['harvest_total'] > s['largest harvest']:
        s['largest harvest'] = d1['harvest_total']
    if 'largest law saved' not in s or d1['law_saved'] > s['largest law saved']:
        s['largest law saved'] = d1['law_saved']
    for x in hv:
        s['candidate loss of exactly 1.01'] += x['loss'] == F('1.01')
    s['lots losing exactly 1.00 (not candidates)'] += sum(l['account'] == 'taxable' and l['cost'] - l['value'] == 1
                                                         for l in lots)
    s['worksheet line 25 takes the regular tax (without harvest)'] += worksheet_cap_binds(c, w0)
    s['rows edge'] += edge
    s['rows random'] += not edge


def build_households(rng, guard):
    rows, s = [], Counter()
    redrawn = Counter()
    edges = edge_cases()
    pending = [(c, None, True) for c in edges]
    n = 0

    def run(c):
        d1 = derive_1(c)
        d2 = derive_2(c)
        return d1, d2

    for c, band, edge in pending:
        n += 1
        cid = f'lots-{c["tax_year"]}-{STATUS_CODE[c["filing_status"]]}-{n:04d}'
        assert one_price_per_ticker(c), cid
        d1, d2 = run(c)
        compare_household(guard, cid, d1, d2)
        rows.append(household_row(cid, c, d1))
        stats_row(s, c, d1, True, None)
    n_edge = len(rows)
    draws = 0
    while len(rows) < N_HOUSEHOLDS:
        scenario = pick(rng, (('plain', 77), ('ira_wash', 7), ('taxable_wash', 7), ('ira_only', 6), ('feb29', 3)))
        c, band = random_case(rng, scenario)
        draws += 1
        assert one_price_per_ticker(c)
        n_try = len(rows) + 1
        cid = f'lots-{c["tax_year"]}-{STATUS_CODE[c["filing_status"]]}-{n_try:04d}'
        d1, d2 = run(c)
        compare_household(guard, cid, d1, d2)   # every draw is checked, kept or not
        if d1['same_day']:
            redrawn['same-day sensitive (W3)'] += 1
            continue
        if tolerance_sensitive(d1):
            redrawn['a taxable lot losing between $0.99 and $1.01'] += 1
            continue
        rows.append(household_row(cid, c, d1))
        s[f'scenario {scenario}'] += 1
        stats_row(s, c, d1, False, band)
    for k, v in redrawn.items():
        s[f'redrawn: {k}'] = v
    s['random draws'] = draws
    return rows, s, n_edge


COVERAGE = {  # brief: "Cover: ..." -> the run's statistic and its minimum
    'year 2025': 600, 'year 2026': 600,
    'status single': 300, 'status married_joint': 300, 'status married_separate': 150, 'status head_of_household': 200,
    'realized: no gains or losses (st 0, lt 0)': 200, 'realized: short-term gain 20,000 or more': 100,
    'realized: long-term gain 20,000 or more': 100, 'realized: short-term negative': 300,
    'realized: long-term negative': 300,
    'after harvest: net loss up to the limit': 100, 'after harvest: net loss above the limit (carryover)': 300,
    'NIIT without: MAGI above the line': 300, 'NIIT without: MAGI at or below the line': 300,
    'NIIT changes with the harvest': 100, 'NIIT crossed (paid without, 0 with)': 10,
    'gains rate 0 (0% band)': 200, 'gains rate between 0 and 0.15': 20,
    'gains rate includes NIIT': 200, 'marginal rate includes NIIT': 200,
    'rate includes part of the NIIT (the $1,000 crosses the line)': 5, 'gains rate 0.20 or more': 30,
    'rows with an unassigned lot': 300, 'candidates that are unassigned lots': 100,
    'rows with a holding with no lots': 100, 'rows IRA only': 100,
    'rows with a wash sale against an IRA purchase': 100, 'rows with a wash sale against a taxable purchase': 100,
    'wash sales partly matched': 50, 'candidates where the plain test and the match differ': 2,
    'lots undated (typed)': 200, 'rows with an undated typed lot': 150,
    'lots bought 2024-02-29': 40, 'lots whose law and page first long-term day differ': 10,
    'lots seen on their anniversary (short, 1 day)': 100, 'lots seen the day after their anniversary (long)': 100,
    'lots seen the day before their anniversary (short, 2 days)': 100, 'lots bought exactly today - 30 / today - 31': 50,
    'rows with more than eight taxable lots': 50, 'rows with a tie that decides the order to sell': 1,
    'rows with a symbol in taxable and IRA': 200, 'carryover with a short part': 100, 'carryover with a long part': 100,
    'taxable income negative after harvest (K1 rows)': 20, 'rows page total 0 with candidates': 20,
    'worksheet line 25 takes the regular tax (without harvest)': 2, 'rows same-day sensitive': 1,
    'candidate loss of exactly 1.01': 1, 'lots losing exactly 1.00 (not candidates)': 1,
}


def check_coverage(s):
    short = {k: (s.get(k, 0), v) for k, v in COVERAGE.items() if s.get(k, 0) < v}
    if short:
        raise SystemExit(f'coverage short of the brief: {short}; no CSV written')
    if s.get('law saved negative (never expected)', 0):
        raise SystemExit('a harvest raised the tax; no CSV written')
    return len(COVERAGE)


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
    print(f'rules.py: {R.CHECKS} self-checks passed on import')
    if not skip_examples:
        try:
            n_ex = check_examples()
        except AssertionError as e:
            raise SystemExit(f'RULES.md examples check failed in derivation 2: {e.args}; no CSV written')
        print(f'RULES.md worked examples and source examples reproduced by derivation 2: {n_ex} assertions')
    rng = random.Random(SEED)
    g_terms, g_house = Guard('lots.csv'), Guard('households.csv')
    term_rows, term_stats = build_terms(rng, g_terms)
    house_rows, house_stats, n_edge = build_households(rng, g_house)
    assert len(house_rows) == N_HOUSEHOLDS and len({r['case_id'] for r in house_rows}) == N_HOUSEHOLDS
    assert len({r['case_id'] for r in term_rows}) == N_TERMS
    try:
        n_cov = check_coverage(house_stats)
    except SystemExit:
        for key in sorted(house_stats):
            print(f'  {key}: {show_stat(house_stats[key])}')
        raise
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    write_csv(out_dir / 'lots.csv', TERM_COLUMNS, term_rows)            # written only once both have passed
    write_csv(out_dir / 'households.csv', HOUSEHOLD_COLUMNS, house_rows)
    print(f'wrote lots.csv: {len(term_rows)} rows; both derivations agree')
    for key in sorted(g_terms.n):
        print(f'  check: {key}: {g_terms.n[key]}')
    for key in sorted(term_stats):
        print(f'  {key}: {term_stats[key]}')
    print(f'wrote households.csv: {len(house_rows)} rows ({n_edge} edge, {len(house_rows) - n_edge} random); both '
          f'derivations agree; largest gap before rounding {money(g_house.max_gap)} (rates {g_house.max_rate_gap}); '
          f'{n_cov} coverage minimums met')
    for key in sorted(g_house.n):
        print(f'  check: {key}: {g_house.n[key]}')
    for key in sorted(house_stats):
        print(f'  {key}: {show_stat(house_stats[key])}')
    for name in ('lots.csv', 'households.csv'):
        print(f'  sha256 {name}: {hashlib.sha256((out_dir / name).read_bytes()).hexdigest()}')
    print(f'total {time.time() - t0:.1f} s')


if __name__ == '__main__':
    main(sys.argv[1:])
