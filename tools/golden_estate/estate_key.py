"""Estate and gift answer key: the federal estate tax for one person or a married couple, and gift plans (the yearly
allowance per recipient, the lifetime exemption, gifts from both spouses, 529 front-loading, the gift tax return).
Three CSVs of invented rows.

Run:  python3 tools/golden_estate/estate_key.py [out_dir] [--mutate NAME] [--skip-examples]
Writes tests/golden/estate/schedule.csv (1,000 rows), estate.csv (1,500) and gifts.csv (1,000). Standard library only,
exact arithmetic (fractions.Fraction), deterministic (random.Random(20261031)). The figures and the model come from
rules.py next to this file; the sources and the reasons are in tests/golden/estate/RULES.md and in README.md here.
Nothing under modules/, core/ or tests/*.test.mjs was opened, and the app is never imported.

Model (the page READMEs, made exact by rules.py). The main columns follow the pages' model; where the law says
otherwise a law_* contrast column gives the law (RULES.md section 10):
  * schedule: the tentative tax of 26 U.S.C. 2001(c) on amount = taxable + gifts; estate tax = max(0, tentative
    tax(amount) - tentative tax(exemption)); exemption = the basic exclusion amount of the year (2027: the 2026 figure
    carried forward, marked unpublished), alone, doubled, or with a DSUE added.
  * estate: one person: taxable estate = estate (shares + life cover) - charity; tax as above with the person's
    lifetime taxable gifts. A couple: nothing at the first death; DSUE of each = exemption - that person's gifts, not
    below 0; second death with portability against exemption + the smaller DSUE, adding back the larger gifts, and
    without portability against the exemption alone. Contrasts: the law for each order of death, and the law with
    the gift tax payable on gifts over the exemption subtracted (2001(b)(2)).
  * gifts: per year, giver and recipient, counted = the gifts (a gift from both halved) + 529 fifths landing that
    year; over = counted - the year's allowance when positive; used = sum of over per giver; left = the 2026
    exemption - used, never below 0; Form 709 years = a year with anything over, a gift from both, or a 529
    election starting.
    Contrasts: the law's reading (a gift from both makes the whole year a split year, so every gift either spouse
    made that year is halved; a 529 election only when the contribution exceeds the allowance) and who files.

Two derivations of every value, run on every row before anything is written:
  derivation 1  rules.py: tentative_tax, basic_exclusion, estate_tax, single_estate_tax, couple_estate_tax, dsue,
                gift_tax_by_year, gift_ledger, annual_exclusion, exemption_left.
  derivation 2  this file, written separately in integer cents: the tentative tax as a sum of marginal slices (rate
                x the part of the amount inside each row; the "tax on over" column of the table is never read), the
                row by bisection on the upper lines; the estate tax and every couple and law figure in closed form
                (40% of the excess, valid because every exemption is above $1,000,000, the start of the 40% row);
                the exemption and allowance by scanning the tables for the newest year not after the one asked;
                the gift ledger as a timeline per giver with a queue of 529 fifths still to land, and the filers
                rule of 26 CFR 25.6019-2 rewritten from its text.
The script refuses to write any CSV if an amount differs by more than a cent, or any other value (row, rate, years,
keys, filers) differs at all, between the two. All three CSVs are worked first and written only if all three pass.
--mutate NAME puts one deliberate mistake into derivation 2 (see MUTATIONS) to show the guard refuses; --skip-examples
turns off the RULES.md examples check so the row guard has to find it alone.
"""
import sys
sys.dont_write_bytecode = True  # before importing rules.py, so no __pycache__ lands in the repo

import csv
import math
import random
import time
from bisect import bisect_left, bisect_right
from collections import Counter, defaultdict
from decimal import Decimal as D
from fractions import Fraction as F
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import rules as R  # noqa: E402  (importing it runs rules.check_tables())

ROOT = HERE.parents[1]
OUT_DIR = ROOT / 'tests' / 'golden' / 'estate'
SEED = 20261031
N_SCHEDULE, N_ESTATE, N_GIFTS = 1000, 1500, 1000
ZERO, HALF, CENT = F(0), F(1, 2), F(1, 100)
TWO_FIFTHS = F(2, 5)        # the 40% row of 2001(c)
TOP_LINE = 1000000          # the 40% row starts over $1,000,000

# Years. schedule.csv covers 2024-2027 (2027 = the 2026 figure carried forward, as the page does, marked unpublished).
# estate.csv covers only years with a published figure: 2027 joins once rules.BASIC_EXCLUSION has it.
SCHEDULE_YEARS = (2024, 2025, 2026, 2027)
ESTATE_YEARS = tuple(y for y in SCHEDULE_YEARS if y in R.BASIC_EXCLUSION)
GIFT_YEARS = (2024, 2025, 2026, 2027, 2028)   # gifts planned in 2027-2028 use the carried-forward allowance
TODAY = 2026                                  # "left" = the exemption of today's year (2026) - used, not below 0
assert (2027 in ESTATE_YEARS) == R.FIGURES_2027_PUBLISHED and ESTATE_YEARS[:3] == (2024, 2025, 2026)
ESTATE_YEAR_WEIGHTS = [(y, w) for y, w in ((2024, 25), (2025, 25), (2026, 50), (2027, 50)) if y in ESTATE_YEARS]
assert all(v >= TOP_LINE for v in R.BASIC_EXCLUSION.values())   # every exemption sits in the 40% row
KINDS = ('basic', 'doubled', 'plus_dsue')
RECIPIENTS = ('son', 'daughter', 'niece', 'nephew', 'grandson', 'granddaughter', 'friend', 'godchild')
GIVER_ORDER = {'A': 0, 'B': 1, 'both': 2}

MUTATIONS = {
    'top_rate_39': "the top row's rate taken as 39 percent",
    'line_in_upper_row': 'an amount exactly on a bracket line put in the upper row',
    'exemption_2026_stale': 'the 2026 exemption left at the 2025 figure, $13,990,000',
    'exemption_2027_guessed': 'the 2027 exemption guessed at $15,480,000 instead of carried forward',
    'couple_larger_dsue': 'couple, page: the larger DSUE carried instead of the smaller',
    'law_first_gifts': "couple, law: the first to die's gifts added back instead of the survivor's",
    'no_gift_tax_subtracted': 'law: the gift tax payable on lifetime gifts not subtracted (2001(b)(2))',
    'split_marked_only': "gifts, law: only the gift from both halved, not the year's other gifts",
    'qtp_no_cap': '529 election with no cap at 5 x the allowance',
    'qtp_law_at_or_under': 'gifts, law: a 529 contribution at or under the allowance spread anyway',
    'allowance_per_gift': 'the allowance applied to each gift, not to the year total per recipient',
    'form709_split_needs_over': 'a year with a gift from both needs no return unless something is over',
    'filers_both_always': 'gifts, law: both spouses file in every split year',
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


def int_cents(x):
    c = fr(x) * 100
    assert c.denominator == 1, x
    return int(c)


def half_cent(x):
    return x is not None and (fr(x) * 100).denominator == 2


def chance(rng, pct):
    return rng.randrange(100) < pct


def pick(rng, weighted):
    total = sum(w for _, w in weighted)
    r = rng.randrange(total)
    for v, w in weighted:
        if r < w:
            return v
        r -= w
    raise AssertionError('unreachable')


STEP = {'cent': 1, 'dollar': 100, 'hundred': 10000, 'thousand': 100000}


def draw_cents(rng, lo_dollars, hi_dollars, grain):
    """A uniform amount in integer cents between lo and hi dollars, on the grain (cent, dollar, hundred, thousand)."""
    s = STEP[grain]
    lo, hi = -(-lo_dollars * 100 // s), hi_dollars * 100 // s
    return rng.randint(lo, hi) * s


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

def bracket_1(x):
    """(over, rate) of the 2001(c) row: "Over lo but not over hi"; zero and below in the first row."""
    for lo, hi, _base, pct in R.RATE_SCHEDULE:
        if hi is None or x <= hi:
            return lo, pct
    raise AssertionError('unreachable')


def schedule_1(c):
    tt = R.tentative_tax(c['amount'])
    lo, pct = bracket_1(c['amount'])
    e, pub = R.basic_exclusion(c['year'])
    dsue = {'basic': ZERO, 'doubled': e, 'plus_dsue': c['dsue']}[c['kind']]
    excl = e + dsue
    r = R.estate_tax(c['taxable'], c['gifts'], excl)
    assert r['base'] == c['amount'] and r['tentative_tax'] == tt
    return {'tt': tt, 'lo': lo, 'pct': pct, 'basic': e, 'published': pub, 'dsue': dsue, 'exemption': excl,
            'credit': R.tentative_tax(excl), 'tax': r['tax']}


def estate_total(c):
    return sum((c[k] for k in ('estate_a', 'life_a', 'estate_b', 'life_b') if c[k] is not None), ZERO)


def estate_1(c):
    y = c['year']
    e, pub = R.basic_exclusion(y)
    assert pub
    total = estate_total(c)
    out = {'total': total, 'exemption': e}
    if c['household'] == 'single':
        r = R.single_estate_tax(total, c['charity'], c['gifts_a'], y)
        gt = R.gift_tax_by_year({y: c['gifts_a']})[y]   # gifts taken as made under this year's exemption (key's convention)
        law = R.single_estate_tax(total, c['charity'], c['gifts_a'], y, gift_tax_payable=gt)
        out.update(taxable=r['taxable_estate'], tax=r['tax'], law_tax=law['tax'])
        return out
    ga, gb = c['gifts_a'], c['gifts_b']
    pp = R.couple_estate_tax(total, ga, gb, c['charity'], y, portability=True, method='page')
    pn = R.couple_estate_tax(total, ga, gb, c['charity'], y, portability=False, method='page')
    t = pp['taxable_estate']
    out.update(taxable=t, first=pp['first_death_tax'], dsue_a=pp['dsue_a'], dsue_b=pp['dsue_b'],
               carried=pp['dsue_used'], added=pp['gifts_added'], page_p=pp['tax'], page_n=pn['tax'])
    for tag, first_g, surv_g, method in (('a', ga, gb, 'A_first'), ('b', gb, ga, 'B_first')):
        # the law for this order: the first to die's DSUE (20.2010-2(c)(1)-(2): gifts reduced by the amount on which
        # gift tax was paid), the survivor's own gifts added back, the survivor's gift tax payable subtracted.
        d = R.dsue(e, e, 0, first_g, gift_taxed_gifts=max(ZERO, first_g - e))
        assert d == (pp['dsue_a'] if tag == 'a' else pp['dsue_b'])
        gt = R.gift_tax_by_year({y: surv_g})[y]
        out['law_' + tag + '_p'] = R.estate_tax(t, surv_g, e + d, gt)['tax']
        out['law_' + tag + '_n'] = R.estate_tax(t, surv_g, e, gt)['tax']
        if surv_g <= e:   # no gift tax: rules.couple_estate_tax's own order of death must agree
            assert out['law_' + tag + '_p'] == R.couple_estate_tax(total, ga, gb, c['charity'], y, True, method)['tax']
            assert out['law_' + tag + '_n'] == R.couple_estate_tax(total, ga, gb, c['charity'], y, False, method)['tax']
    return out


def givers_of(plan):
    return ('A',) if plan['givers'] == 1 else ('A', 'B')


def gifts_1(plan, law):
    gl = [{'year': y, 'giver': frm, 'to': to, 'amount': F(c, 100), 'kind': kind, 'elect': el}
          for (y, frm, to, c, kind, el) in plan['gifts']]
    r = R.gift_ledger(gl, 'law' if law else 'page')
    givers = givers_of(plan)
    counted = {(k[1], k[0], k[2]): v for k, v in r['counted'].items()}
    assert all(k[1] in givers for k in counted)
    years = tuple(sorted({k[0] for k in counted}))
    over = {(y, w): r['over_by_year'][w][y] for y in years for w in givers}
    used = {w: r['used'][w] for w in givers}
    left = {w: R.exemption_left(used[w], TODAY) for w in givers}
    elections = {(k[1], k[0], k[2]): (v['elected'], v['excess']) for k, v in r['elections'].items()}
    form709 = tuple(r['form709_years'])
    filers = {y: '|'.join(sorted(f)) for y, f in r['filers'].items()}
    assert tuple(sorted(filers)) == form709, (filers, form709)   # a return is due exactly in the years someone files
    excl = tuple((y,) + tuple(R.annual_exclusion(y)) for y in years)
    return {'years': years, 'counted': counted, 'over': over, 'used': used, 'left': left, 'elections': elections,
            'form709': form709, 'filers': filers if law else None, 'split_years': tuple(r['split_years']),
            'exclusions': excl, 'exemption': R.basic_exclusion(TODAY)[0]}


# ============================ derivation 2: written separately ============================

ROWS_2 = [(lo, hi, pct) for lo, hi, _base, pct in R.RATE_SCHEDULE]   # the "tax on over" column is never used here
UPPER_LINES = [hi for _lo, hi, _pct in ROWS_2 if hi is not None]


def bea_2(year):
    """(whole dollars, published) for decedents dying in `year`: the newest table year not after it."""
    if MUT == 'exemption_2026_stale' and year == 2026:
        return 13990000, True
    if MUT == 'exemption_2027_guessed' and year == 2027:
        return 15480000, False
    known = [y for y in R.BASIC_EXCLUSION if y <= year]
    return R.BASIC_EXCLUSION[max(known)], year in R.BASIC_EXCLUSION


def ae_2(year):
    """(integer cents, published) of the yearly allowance for gifts made in `year`: the newest table year not after it."""
    known = [y for y in R.ANNUAL_EXCLUSION if y <= year]
    return R.ANNUAL_EXCLUSION[max(known)] * 100, year in R.ANNUAL_EXCLUSION


def tt_2(c):
    """Tentative tax in exact cents on c cents: the sum, row by row, of the rate times the part of c inside the row."""
    total = ZERO
    for lo, hi, pct in ROWS_2:
        if MUT == 'top_rate_39' and hi is None:
            pct = 39
        lo_c = lo * 100
        if c <= lo_c:
            break
        top = c if hi is None else min(c, hi * 100)
        total += F(pct, 100) * (top - lo_c)
    return total


def bracket_2(x):
    i = (bisect_right if MUT == 'line_in_upper_row' else bisect_left)(UPPER_LINES, x)   # first line x is not over
    lo, _hi, pct = ROWS_2[i]
    return lo, pct


def forty_pct_over(cents):
    """40% of a positive excess in cents, as dollars; 0 when the excess is not positive."""
    return TWO_FIFTHS * max(0, cents) / 100


def schedule_2(c):
    lo, pct = bracket_2(c['amount'])
    e, pub = bea_2(c['year'])
    dsue = {'basic': ZERO, 'doubled': F(e)}.get(c['kind'], c['dsue'])
    excl = e + dsue
    assert excl >= TOP_LINE and e >= TOP_LINE
    return {'tt': tt_2(int_cents(c['amount'])) / 100, 'lo': lo, 'pct': pct, 'basic': F(e), 'published': pub,
            'dsue': dsue, 'exemption': excl, 'credit': tt_2(int_cents(excl)) / 100,
            'tax': forty_pct_over(int_cents(c['amount']) - int_cents(excl))}


def estate_2(c):
    e, _pub = bea_2(c['year'])
    big_e = e * 100
    tot = sum(int_cents(c[k]) for k in ('estate_a', 'life_a', 'estate_b', 'life_b') if c[k] is not None)
    t = max(0, tot - int_cents(c['charity']))
    ga = int_cents(c['gifts_a'])
    out = {'total': F(tot, 100), 'exemption': F(e), 'taxable': F(t, 100)}

    def kept(g):   # with gift tax paid on the part above the exemption, 2001(b)(2) leaves only min(g, E) to tax again
        return g if MUT == 'no_gift_tax_subtracted' else min(g, big_e)

    if c['household'] == 'single':
        out['tax'] = forty_pct_over(t + ga - big_e)
        out['law_tax'] = forty_pct_over(t + kept(ga) - big_e)
        return out
    gb = int_cents(c['gifts_b'])
    da, db = max(0, big_e - ga), max(0, big_e - gb)
    carried = max(da, db) if MUT == 'couple_larger_dsue' else min(da, db)
    added = max(ga, gb)
    out.update(first=ZERO, dsue_a=F(da, 100), dsue_b=F(db, 100), carried=F(carried, 100), added=F(added, 100),
               page_p=forty_pct_over(t + added - big_e - carried), page_n=forty_pct_over(t + added - big_e))
    for tag, first_dsue, surv_g, first_g in (('a', da, gb, ga), ('b', db, ga, gb)):
        g = first_g if MUT == 'law_first_gifts' else surv_g
        out['law_' + tag + '_p'] = forty_pct_over(t + kept(g) - big_e - first_dsue)
        out['law_' + tag + '_n'] = forty_pct_over(t + kept(g) - big_e)
    return out


def ledger_2(plan, law):
    """The gift ledger again, in exact cents: each giver's pieces walked year by year, with a queue of 529 fifths still to
    land. Returns the same structure as gifts_1, in dollars."""
    gifts = plan['gifts']
    givers = givers_of(plan)
    split_years = sorted({g[0] for g in gifts if g[1] == 'both'})
    pieces = defaultdict(list)   # giver -> [(year, to, cents, kind, elect, n)]
    for n, (y, frm, to, c, kind, el) in enumerate(gifts):
        halve = frm == 'both' or (law and y in split_years and MUT != 'split_marked_only')
        for w in (('A', 'B') if halve else (frm,)):
            pieces[w].append((y, to, F(c, 2) if halve else F(c), kind, el, n))
    counted, elections, starts, per_gift_over = {}, {}, set(), defaultdict(F)
    for w in givers:
        mine = pieces.get(w, [])
        if not mine:
            continue
        queue = defaultdict(F)   # (year, to) -> fifths that land then
        for y in range(min(p[0] for p in mine), max(p[0] for p in mine) + 5):
            x = ae_2(y)[0]
            now = [p for p in mine if p[0] == y]
            for to in sorted({p[1] for p in now} | {k[1] for k in queue if k[0] == y}):
                cash = [p for p in now if p[1] == to and p[3] == 'cash']
                qtp = [p for p in now if p[1] == to and p[3] == '529']
                total_qtp = sum((p[2] for p in qtp), ZERO)
                elect = any(p[4] for p in qtp)
                here = sum((p[2] for p in cash), ZERO)
                if qtp and elect and (not law or total_qtp > x or MUT == 'qtp_law_at_or_under'):
                    elected = total_qtp if MUT == 'qtp_no_cap' else min(total_qtp, F(5 * x))
                    elections[(y, w, to)] = (elected, total_qtp - elected)
                    starts.add((w, y))
                    for k in range(5):
                        queue[(y + k, to)] += elected / 5
                    here += total_qtp - elected
                else:
                    here += total_qtp
                here += queue.pop((y, to), ZERO)
                counted[(y, w, to)] = here
                if MUT == 'allowance_per_gift':   # each cash gift, and the rest, against its own allowance
                    rest = here - sum((p[2] for p in cash), ZERO)
                    per_gift_over[(y, w)] += sum((max(ZERO, v - x) for v in [p[2] for p in cash] + [rest]), ZERO)
        assert not queue
    years = tuple(sorted({k[0] for k in counted}))
    over = {}
    for y in years:
        x = ae_2(y)[0]
        for w in givers:
            over[(y, w)] = sum((max(ZERO, v - x) for k, v in counted.items() if k[0] == y and k[1] == w), ZERO)
            if MUT == 'allowance_per_gift':
                over[(y, w)] = per_gift_over[(y, w)]
    used = {w: sum((v for k, v in over.items() if k[1] == w), ZERO) for w in givers}
    today = bea_2(TODAY)[0] * 100
    form709 = []
    for y in years:
        anything_over = any(over[(y, w)] > 0 for w in givers)
        split = y in split_years and MUT != 'form709_split_needs_over'
        if anything_over or split or any((w, y) in starts for w in givers):
            form709.append(y)
    filers = {}
    if law:
        for y in form709:
            filers[y] = '|'.join(filers_2(y, gifts, givers, split_years, over, starts, elections))
    return {'years': years,
            'counted': {k: v / 100 for k, v in counted.items()},
            'over': {k: v / 100 for k, v in over.items()},
            'used': {w: v / 100 for w, v in used.items()},
            'left': {w: max(F(0), F(today - v)) / 100 for w, v in used.items()},   # used up: 0 left
            'elections': {k: (a / 100, b / 100) for k, (a, b) in elections.items()},
            'form709': tuple(form709), 'filers': filers if law else None, 'split_years': tuple(split_years),
            'exclusions': tuple((y, F(ae_2(y)[0], 100), ae_2(y)[1]) for y in years),
            'exemption': F(bea_2(TODAY)[0])}


def filers_2(y, gifts, givers, split_years, over, starts, elections):
    """Who files a gift tax return for year y under the law (26 U.S.C. 6019; 26 CFR 25.6019-1, 25.6019-2)."""
    x = ae_2(y)[0]
    started = {w for w in givers if (w, y) in starts}
    if y not in split_years:
        return sorted(w for w in givers if over[(y, w)] > 0 or w in started)
    if MUT == 'filers_both_always':
        return ['A', 'B']
    # "without regard to the provisions of section 2513": each spouse's own gifts of the year (a gift from both is half
    # each), per recipient, plus the fifths of earlier elections that land in y.
    own = defaultdict(F)
    for (gy, frm, to, c, _kind, _el) in gifts:
        if gy == y:
            for w in (('A', 'B') if frm == 'both' else (frm,)):
                own[(w, to)] += F(c, 2) if frm == 'both' else c
    for (ey, w, to), (elected, _excess) in elections.items():
        if ey < y <= ey + 4:
            own[(w, to)] += elected / 5
    alone = [w for w in givers if w in started or any(v > x for (ww, _to), v in own.items() if ww == w)]
    if len(alone) == 2:
        return ['A', 'B']                     # "returns must be filed by both spouses"
    if len(alone) == 1:
        other = 'B' if alone[0] == 'A' else 'A'
        late = over[(y, other)] > 0 or other in started   # "a return must also be filed by such other spouse"
        return sorted(alone + ([other] if late else []))
    return ['A', 'B']   # nobody had to: the consent is signified on a return; a gift from both is signed by both


# ============================ RULES.md worked examples, through derivation 2 ============================

def parse_plan(text, givers=2, label='', note=''):
    gifts = []
    for part in text.split(';'):
        y, frm, to, amount, kind, el = part.split(':')
        assert frm in GIVER_ORDER and kind in ('cash', '529') and el in ('yes', 'no')
        assert givers == 2 or frm == 'A'
        gifts.append((int(y), frm, to, int_cents(amount), kind, el == 'yes'))
    gifts.sort(key=lambda g: (g[0], GIVER_ORDER[g[1]], g[2], g[4], g[3], g[5]))
    return {'givers': givers, 'gifts': tuple(gifts), 'label': label, 'note': note}


def check_examples():
    n = 0

    def tt(d):
        return tt_2(int_cents(d)) / 100
    assert tt('19500000') == 7745800 and tt('15000000') == 5945800 and tt('43000000') == 17145800
    assert tt('27000000') == 10745800 and tt('14000000') == 5545800 and tt('6800000') == 2665800
    assert tt('10000') == 1800 and tt('5000') == 900 and tt('1000000') == 345800 and tt('0') == 0
    assert all(tt(R.BASIC_EXCLUSION[y]) == v for y, v in R.I706_CREDIT_EQUIVALENT.items())   # Form 706 table
    assert bracket_2(10000) == (0, 18) and bracket_2(F(1000001, 100)) == (10000, 20) and bracket_2(2000000) == (1000000, 40)
    n += 5
    # 9.1 Morgan
    m = estate_2(estate_case(2026, 'single', '17500000', None, '500000', None, '1000000', '2500000', None))
    assert m['total'] == 18000000 and m['taxable'] == 17000000 and m['tax'] == 1800000
    assert estate_2(estate_case(2025, 'single', '17500000', None, '500000', None, '1000000', '2500000', None))['tax'] == 2204000
    assert estate_2(estate_case(2024, 'single', '17500000', None, '500000', None, '1000000', '2500000', None))['tax'] == 2356000
    assert estate_2(estate_case(2026, 'single', '12000000', None, '0', None, '0', '3000000', None))['tax'] == 0
    assert estate_2(estate_case(2026, 'single', '9000000', None, '0', None, '0', '0', None))['tax'] == 0
    g = estate_2(estate_case(2026, 'single', '5000000', None, '0', None, '0', '16000000', None))
    assert g['tax'] == 2400000 and g['law_tax'] == 2000000
    n += 6
    # 9.2 Jordan and Casey
    j = estate_2(estate_case(2026, 'couple', '22000000', '15000000', '2000000', '1000000', '0', '3000000', '1000000'))
    assert (j['dsue_a'], j['dsue_b'], j['carried'], j['added']) == (12000000, 14000000, 12000000, 3000000)
    assert j['page_p'] == 6400000 and j['page_n'] == 11200000
    assert (j['law_a_p'], j['law_b_p'], j['law_a_n'], j['law_b_n']) == (5600000, 5600000, 10400000, 11200000)
    z = estate_2(estate_case(2026, 'couple', '18000000', '10000000', '0', '0', '0', '0', '0'))
    assert z['page_p'] == 0 and z['page_n'] == 5200000
    n += 4

    def led(text, law):
        return ledger_2(parse_plan(text), law)
    # 9.3 (the page enters a split gift as "from both")
    s = led('2026:both:daughter:38000:cash:no', False)
    assert s['counted'] == {(2026, 'A', 'daughter'): 19000, (2026, 'B', 'daughter'): 19000}
    assert s['used'] == {'A': 0, 'B': 0} and s['form709'] == (2026,)
    ns = led('2026:A:daughter:38000:cash:no', False)
    assert ns['used'] == {'A': 19000, 'B': 0} and ns['left']['A'] == 14981000
    s40 = led('2026:both:daughter:40000:cash:no', True)
    assert s40['used'] == {'A': 1000, 'B': 1000} and s40['filers'] == {2026: 'A|B'}
    n += 5
    # 9.4 529 over the cap
    q = '2026:B:grandson:120000:529:yes;2027:B:grandson:5000:cash:no'
    for law in (False, True):
        r = led(q, law)
        assert r['elections'] == {(2026, 'B', 'grandson'): (95000, 25000)}
        assert [r['counted'][(y, 'B', 'grandson')] for y in range(2026, 2031)] == [44000, 24000, 19000, 19000, 19000]
        assert [r['over'][(y, 'B')] for y in range(2026, 2031)] == [25000, 5000, 0, 0, 0]
        assert r['used']['B'] == 30000 and r['left']['B'] == 14970000 and r['form709'] == (2026, 2027)
    assert led(q, True)['filers'] == {2026: 'B', 2027: 'B'}
    qb = led('2026:both:grandson:120000:529:yes', True)
    assert qb['counted'][(2026, 'A', 'grandson')] == 12000 and qb['used'] == {'A': 0, 'B': 0}
    assert qb['form709'] == (2026,) and qb['filers'] == {2026: 'A|B'}
    n += 8
    # 9.5 one gift from both while the same couple made other gifts
    mix = '2026:both:son:38000:cash:no;2026:A:nephew:50000:cash:no;2026:B:friend:25000:cash:no'
    pg, lw = led(mix, False), led(mix, True)
    assert pg['used'] == {'A': 31000, 'B': 6000} and lw['used'] == {'A': 6000, 'B': 6000}
    assert lw['counted'][(2026, 'A', 'nephew')] == 25000 and lw['counted'][(2026, 'B', 'friend')] == 12500
    assert lw['filers'] == {2026: 'A|B'} and pg['left']['A'] == 14969000 and lw['left']['A'] == 14994000
    n += 3
    # Form 709 instructions (2025), Line B, Pat: $100,000 to a 529 in 2025, $20,000 cash to another person in 2026.
    p = led('2025:A:grandson:100000:529:yes;2026:A:nephew:20000:cash:no', True)
    assert p['counted'][(2025, 'A', 'grandson')] == 24000 and p['counted'][(2026, 'A', 'grandson')] == 19000
    assert p['counted'][(2026, 'A', 'nephew')] == 20000 and tuple(p['filers']) == (2025, 2026)
    # A 529 contribution not above the allowance: the law does not spread it, the page does.
    lw15, pg15 = led('2026:A:niece:15000:529:yes', True), led('2026:A:niece:15000:529:yes', False)
    assert lw15['elections'] == {} and lw15['form709'] == () and lw15['filers'] == {}
    assert pg15['counted'][(2026, 'A', 'niece')] == 3000 and pg15['form709'] == (2026,)
    n += 4
    return n


# ============================ cases ============================

def schedule_case(amount, gifts, year, kind, dsue=None, label='', note=''):
    amount, gifts = fr(amount), fr(gifts)
    assert ZERO <= gifts <= amount and kind in KINDS and (dsue is None) == (kind != 'plus_dsue')
    return {'amount': amount, 'taxable': amount - gifts, 'gifts': gifts, 'year': year, 'kind': kind,
            'dsue': None if dsue is None else fr(dsue), 'label': label, 'note': note}


def estate_case(year, household, ea, eb, la, lb, charity, ga, gb, label='', note=''):
    single = household == 'single'
    assert household in ('single', 'couple') and (eb is None) == single and (lb is None) == single and (gb is None) == single
    opt = (lambda v: None if v is None else fr(v))
    return {'year': year, 'household': household, 'estate_a': fr(ea), 'estate_b': opt(eb), 'life_a': fr(la),
            'life_b': opt(lb), 'charity': fr(charity), 'gifts_a': fr(ga), 'gifts_b': opt(gb), 'label': label,
            'note': note}


def compare(guard, where, d1, d2, money_keys, exact_keys):
    for k in exact_keys:
        guard.same(where, k, d1.get(k), d2.get(k))
    for k in money_keys:
        guard.money(where, k, d1.get(k), d2.get(k))


# ============================ schedule.csv ============================

SCHEDULE_COLUMNS = ['case_id', 'label', 'amount', 'bracket_over', 'bracket_rate', 'tentative_tax', 'taxable', 'gifts',
                    'year', 'exemption_published', 'exemption_kind', 'basic_exclusion', 'dsue', 'exemption', 'credit',
                    'estate_tax', 'note']
SCHEDULE_MONEY = ('tt', 'dsue', 'exemption', 'credit', 'tax', 'basic')
SCHEDULE_EXACT = ('lo', 'pct', 'published')


def schedule_edge_cases():
    out = []
    add = (lambda *a, **k: out.append(schedule_case(*a, **k)))
    add('0', '0', 2026, 'basic', label='zero', note='nothing: tentative tax 0, estate tax 0')
    add('0.01', '0', 2026, 'basic', label='one cent', note='18% of a cent is 0.0018, written 0.00')
    lines = [hi for _lo, hi, _b, _p in R.RATE_SCHEDULE if hi is not None]
    for i, line in enumerate(lines):
        for off, word in ((-1, 'a cent under'), (0, 'exactly'), (1, 'a cent over')):
            amount = F(line) + F(off, 100)
            year = SCHEDULE_YEARS[(i + off + 1) % 4]
            kind = KINDS[(i + off + 1) % 3]
            gifts = ZERO if (i + off) % 2 == 0 else to_cents(amount / 3) * CENT
            add(amount, gifts, year, kind, dsue=('2500000' if kind == 'plus_dsue' else None),
                label=f'{word} the ${line:,} line',
                note=('"not over" the line: the lower row' if off == 0 else '') )
    add('49999999.99', '0', 2027, 'doubled', label='a cent under $50,000,000', note='top of the range')
    add('50000000', '20000000', 2024, 'plus_dsue', dsue='13610000', label='$50,000,000', note='top of the range')
    for y in SCHEDULE_YEARS:
        e = R.basic_exclusion(y)[0]
        for kind in KINDS:
            dsue = F(12000000) if kind == 'plus_dsue' else None
            excl = e + {'basic': ZERO, 'doubled': e, 'plus_dsue': dsue}[kind]
            for off, word in ((-1, 'a cent under'), (0, 'exactly'), (1, 'a cent over')):
                add(excl + F(off, 100), '3000000', y, kind, dsue=dsue,
                    label=f'{word} the {y} exemption ({kind.replace("_", " ")})',
                    note=('2027: the 2026 figure carried forward, not yet published' if y == 2027 else
                          ('tax 0.00 exactly at the exemption' if off == 0 else '')))
    for y, credit in sorted(R.I706_CREDIT_EQUIVALENT.items()):
        add(R.BASIC_EXCLUSION[y], '0', SCHEDULE_YEARS[y % 4], KINDS[y % 3],
            dsue=('1000000' if KINDS[y % 3] == 'plus_dsue' else None),
            label=f'Form 706 table, {y}', note=f'tentative tax {credit:,} (credit equivalent of the {y} exemption)')
    add('19500000', '2500000', 2026, 'basic', label='RULES.md 9.1, 2026', note='7,745,800 - 5,945,800 = 1,800,000')
    add('19500000', '2500000', 2025, 'basic', label='RULES.md 9.1, 2025', note='estate tax 2,204,000')
    add('19500000', '2500000', 2024, 'basic', label='RULES.md 9.1, 2024', note='estate tax 2,356,000')
    add('43000000', '3000000', 2026, 'plus_dsue', dsue='12000000', label='RULES.md 9.2, portability',
        note='17,145,800 - 10,745,800 = 6,400,000')
    add('43000000', '3000000', 2026, 'basic', label='RULES.md 9.2, no portability', note='estate tax 11,200,000')
    add('0.25', '0', 2025, 'basic', label='half-cent tie, 18% row', note='18% of 0.25 = 0.045 exactly, written 0.05 (half up)')
    add('500000.50', '0', 2024, 'basic', label='half-cent tie, 37% row',
        note='155,800 + 37% of 0.50 = 155,800.185 exactly, written 155,800.19 (half up)')
    add('14000000', '0', 2026, 'basic', label='26 CFR 20.2010-1(c)(2) Example 4', note='tentative tax 5,545,800')
    add('6800000', '0', 2026, 'basic', label='26 CFR 20.2010-1(c)(2) Example 4', note='tentative tax 2,665,800')
    return out


def random_schedule(rng):
    if chance(rng, 35):   # strictly inside one of the rows below $1,000,000
        lo, hi, _p = ROWS_2[rng.randrange(len(UPPER_LINES))]
        amount = rng.randint(lo * 100 + 1, hi * 100 - 1)
    else:
        amount = draw_cents(rng, TOP_LINE, 50000000, pick(rng, [('cent', 50), ('dollar', 30), ('thousand', 20)]))
    gifts = 0 if chance(rng, 50) else rng.randint(0, min(amount, 1000000000))
    year = rng.choice(SCHEDULE_YEARS)
    kind = pick(rng, [('basic', 40), ('doubled', 30), ('plus_dsue', 30)])
    dsue = None
    if kind == 'plus_dsue':
        e = int(R.basic_exclusion(year)[0])   # a DSUE strictly between 0 and one basic exclusion amount
        if chance(rng, 80):
            dsue = F(rng.randint(1, e // 1000 - 1) * 1000)
        else:
            dsue = F(rng.randint(1, e * 100 - 1), 100)
    return schedule_case(F(amount, 100), F(gifts, 100), year, kind, dsue=dsue)


def schedule_row(cid, c, d):
    return {'case_id': cid, 'label': c['label'], 'amount': money(c['amount']), 'bracket_over': d['lo'],
            'bracket_rate': d['pct'], 'tentative_tax': money(d['tt']), 'taxable': money(c['taxable']),
            'gifts': money(c['gifts']), 'year': c['year'], 'exemption_published': 'yes' if d['published'] else 'no',
            'exemption_kind': c['kind'], 'basic_exclusion': money(d['basic']), 'dsue': money(d['dsue']),
            'exemption': money(d['exemption']), 'credit': money(d['credit']), 'estate_tax': money(d['tax']),
            'note': c['note']}


def build_schedule(rng):
    cases = schedule_edge_cases()
    n_edge = len(cases)
    redraws = 0
    while len(cases) < N_SCHEDULE:
        c = random_schedule(rng)
        if half_cent(schedule_1(c)['tt']):   # an exact half-cent tie is left to the labelled edge rows
            redraws += 1
            continue
        cases.append(c)
    guard, stats, rows = Guard('schedule.csv'), Counter(), []
    stats['random draws redrawn: tentative tax on a half cent'] = redraws
    lines = set(UPPER_LINES)
    for i, c in enumerate(cases):
        cid = f'sch-edge-{i + 1:03d}' if i < n_edge else f'sch-{i - n_edge + 1:04d}'
        d1, d2 = schedule_1(c), schedule_2(c)
        compare(guard, cid, d1, d2, SCHEDULE_MONEY, SCHEDULE_EXACT)
        rows.append(schedule_row(cid, c, d1))
        stats[f'amount in the row over {d1["lo"]:,} ({d1["pct"]}%)'] += 1
        stats[f'year {c["year"]} / {c["kind"]}'] += 1
        stats['estate tax above 0'] += d1['tax'] > 0
        stats['estate tax 0 (amount at or under the exemption)'] += d1['tax'] == 0
        stats['amount exactly on a bracket line'] += c['amount'] in lines
        stats['amount within a cent of the exemption'] += abs(c['amount'] - d1['exemption']) <= CENT
        stats['gifts above 0'] += c['gifts'] > 0
        stats['tentative tax exactly on a half cent before rounding'] += half_cent(d1['tt'])
        stats['exemption unpublished (2027, carried forward)'] += not d1['published']
        stats['largest estate tax'] = max(stats.get('largest estate tax', ZERO), d1['tax'])
    return rows, stats, guard, n_edge


# ============================ estate.csv ============================

ESTATE_COLUMNS = ['case_id', 'label', 'year', 'exemption', 'household', 'estate_a', 'estate_b', 'life_cover_a',
                  'life_cover_b', 'charity', 'gifts_a', 'gifts_b', 'estate_total', 'taxable_estate', 'tax',
                  'law_tax_less_gift_tax', 'first_death_tax', 'dsue_a', 'dsue_b', 'dsue_carried', 'gifts_added',
                  'second_death_tax_portability', 'second_death_tax_no_portability', 'law_a_first_portability',
                  'law_b_first_portability', 'law_a_first_no_portability', 'law_b_first_no_portability', 'note']
ESTATE_MONEY = ('total', 'exemption', 'taxable', 'tax', 'law_tax', 'first', 'dsue_a', 'dsue_b', 'carried', 'added',
                'page_p', 'page_n', 'law_a_p', 'law_b_p', 'law_a_n', 'law_b_n')


def estate_edge_cases():
    out = []
    add = (lambda *a, **k: out.append(estate_case(*a, **k)))
    for y, tax in ((2026, '1,800,000'), (2025, '2,204,000'), (2024, '2,356,000')):
        add(y, 'single', '17500000', None, '500000', None, '1000000', '2500000', None, label=f'RULES.md 9.1, {y}',
            note=f'estate 17.5M + life cover 0.5M - charity 1M = 17M taxable; + 2.5M gifts: tax {tax}')
    add(2026, 'single', '12000000', None, '0', None, '0', '3000000', None, label='RULES.md 9.1, at the exemption',
        note='12M + 3M gifts = 15M exactly: tax 0')
    add(2026, 'single', '9000000', None, '0', None, '0', '0', None, label='RULES.md 9.1, under the exemption',
        note='tax 0, never negative')
    add(2026, 'single', '5000000', None, '0', None, '0', '16000000', None, label='RULES.md 9.1, gifts over the exemption',
        note='page 2,400,000; the law subtracts the 400,000 gift tax payable: 2,000,000')
    for y in ESTATE_YEARS:
        add(y, 'couple', '22000000', '15000000', '2000000', '1000000', '0', '3000000', '1000000',
            label=f'RULES.md 9.2, {y}', note=('page 6,400,000 / 11,200,000; law 5,600,000 either order, 10,400,000 / '
                                             '11,200,000 without portability' if y == 2026 else
                                             'the 9.2 couple in another year'))
    add(2026, 'couple', '18000000', '10000000', '0', '0', '0', '0', '0', label='RULES.md 9.2, no gifts',
        note='28M: portability 0, without 5,200,000')
    words = ((-1, 'a cent under'), (0, 'exactly at'), (1, 'a cent over'))
    for y in ESTATE_YEARS:
        e = R.BASIC_EXCLUSION[y]
        for off, word in words:
            add(y, 'single', F(e - 1000000) + F(off, 100), None, '0', None, '0', '1000000', None,
                label=f'single {word} the {y} exemption', note='estate + 1M gifts against the exemption')
    for y in ESTATE_YEARS:
        e = R.BASIC_EXCLUSION[y]
        for off, word in words:   # taxable + larger gifts = E + smaller DSUE  <=>  taxable = 2E - 2 x 2,000,000
            add(y, 'couple', F(2 * e - 4000000 - 5000000) + F(off, 100), '5000000', '0', '0', '0', '2000000', '500000',
                label=f'couple {word} the {y} line with portability',
                note='taxable + the larger gifts = exemption + the smaller DSUE')
    for y in ESTATE_YEARS:
        e = R.BASIC_EXCLUSION[y]
        for off, word in words:   # taxable + larger gifts = E
            add(y, 'couple', F(e - 2000000 - 3000000) + F(off, 100), '3000000', '0', '0', '0', '2000000', '500000',
                label=f'couple {word} the {y} line without portability', note='taxable + the larger gifts = exemption')
    add(2026, 'single', '3000000', None, '0', None, '3500000', '500000', None, label='charity above the estate',
        note='taxable estate 0, not negative')
    add(2025, 'couple', '10000000', '5000000', '0', '0', '20000000', '0', '0', label='couple, charity above the estate',
        note='taxable estate 0')
    add(2026, 'couple', '12000000', '8000000', '0', '0', '0', '16000000', '0', label='couple, gifts above the exemption',
        note=('DSUE of A 0, not negative; page 8,400,000 both ways; law 2,000,000 either order with portability, '
              '2,000,000 / 8,000,000 without (gift tax subtracted)'))
    add(2024, 'single', '3000000', None, '0', None, '0', '14000000', None, label='single, gifts over the 2024 exemption',
        note='page 0.4 x (3M + 14M - 13.61M) = 1,356,000; law (gift tax on 390,000 subtracted) 0.4 x 3M = 1,200,000')
    add(2025, 'couple', '20000000', '10000000', '0', '0', '0', '0', '14500000',
        label='couple, the survivor gave more than the exemption',
        note=('DSUE of B 0; law, A first (B survives): 0.4 x (30M + 13.99M - 27.98M) = 6,404,000 after the gift tax; '
              'page 0.4 x (30M + 14.5M - 13.99M) = 12,204,000'))
    add(2026, 'couple', '25000000', '15000000', '0', '0', '0', '2000000', '2000000', label='couple, equal gifts',
        note='the page and both orders agree: 5,600,000')
    add(2026, 'single', '0', None, '0', None, '0', '0', None, label='single, nothing', note='all 0')
    add(2024, 'couple', '0', '0', '0', '0', '0', '0', '0', label='couple, nothing', note='all 0')
    add(2026, 'couple', '0', '0', '20000000', '10000000', '0', '0', '0', label='couple, life cover only',
        note='30M of life cover: portability 0, without 6,000,000')
    add(2026, 'couple', '35000000', '25000000', '0', '0', '0', '0', '5000000', label='couple, 60M, gifts 0 and 5M',
        note='page 16,000,000 / 20,000,000; law 14,000,000 either order, 20,000,000 / 18,000,000 without')
    add(2026, 'single', '1000000', None, '0', None, '0', '15000000', None, label='single, gifts exactly the exemption',
        note='tax 400,000; no gift tax was payable, so the law agrees')
    add(2026, 'couple', '12000000', '8000000', '0', '0', '0', '15000000', '0',
        label='couple, gifts exactly the exemption', note='DSUE of A exactly 0')
    add(2026, 'single', '15000000.03', None, '0', None, '0', '0', None, label='single, 3 cents over',
        note='40% of 3 cents = 0.012, written 0.01')
    add(2025, 'single', '9876543.21', None, '1234567.89', None, '111111.11', '2999999.99', None,
        label='single, cents everywhere', note='')
    add(2024, 'couple', '7654321.09', '8765432.10', '345678.90', '0', '98765.43', '1234567.01', '2345678.99',
        label='couple, cents everywhere', note='')
    return out


def random_household(rng):
    year = pick(rng, ESTATE_YEAR_WEIGHTS)
    single = chance(rng, 40)
    e = R.BASIC_EXCLUSION[year]

    def share():
        lo, hi = pick(rng, [((0, 2000000), 20), ((2000000, 8000000), 30), ((8000000, 20000000), 30),
                            ((20000000, 40000000), 20)])
        return draw_cents(rng, lo, hi, pick(rng, [('thousand', 50), ('dollar', 35), ('cent', 15)]))

    def cover():
        return 0 if chance(rng, 55) else rng.randint(2, 100) * 50000 * 100

    def gifts():
        band = pick(rng, [(None, 40), ((10000, 2000000), 35), ((2000000, 8000000), 20), ((8000000, e), 5)])
        if band is None:
            return 0
        return draw_cents(rng, band[0], band[1], pick(rng, [('thousand', 60), ('dollar', 30), ('cent', 10)]))

    ea, la, ga = share(), cover(), gifts()
    eb, lb, gb = (None, None, None) if single else (share(), cover(), gifts())
    total = ea + la + (0 if single else eb + lb)
    charity = 0
    if total >= 100000 and not chance(rng, 60):
        top = max(1000, total * 3 // 10 // 100)   # up to 30% of the estate, in dollars
        charity = draw_cents(rng, 1000, top, pick(rng, [('thousand', 60), ('dollar', 40)]))
    cents = (lambda v: None if v is None else F(v, 100))
    return estate_case(year, 'single' if single else 'couple', cents(ea), cents(eb), cents(la), cents(lb), cents(charity),
                       cents(ga), cents(gb))


def estate_row(cid, c, d):
    single = c['household'] == 'single'
    g = (lambda k: None if single else d[k])
    return {'case_id': cid, 'label': c['label'], 'year': c['year'], 'exemption': money(d['exemption']),
            'household': c['household'], 'estate_a': money(c['estate_a']), 'estate_b': money(c['estate_b']),
            'life_cover_a': money(c['life_a']), 'life_cover_b': money(c['life_b']), 'charity': money(c['charity']),
            'gifts_a': money(c['gifts_a']), 'gifts_b': money(c['gifts_b']), 'estate_total': money(d['total']),
            'taxable_estate': money(d['taxable']), 'tax': money(d['tax'] if single else None),
            'law_tax_less_gift_tax': money(d['law_tax'] if single else None), 'first_death_tax': money(g('first')),
            'dsue_a': money(g('dsue_a')), 'dsue_b': money(g('dsue_b')), 'dsue_carried': money(g('carried')),
            'gifts_added': money(g('added')), 'second_death_tax_portability': money(g('page_p')),
            'second_death_tax_no_portability': money(g('page_n')), 'law_a_first_portability': money(g('law_a_p')),
            'law_b_first_portability': money(g('law_b_p')), 'law_a_first_no_portability': money(g('law_a_n')),
            'law_b_first_no_portability': money(g('law_b_n')), 'note': c['note']}


def estate_stats(s, c, d):
    s[f'year {c["year"]}'] += 1
    s[c['household']] += 1
    s['written amounts exactly on a half cent before rounding'] += sum(half_cent(v) for v in d.values())
    s['charity above 0'] += c['charity'] > 0
    s['charity above the whole estate'] += c['charity'] > d['total']
    s['life cover above 0 (any person)'] += (c['life_a'] > 0) or bool(c['life_b'])
    s['estate amounts with cents'] += any(fr(c[k]).denominator != 1 for k in ('estate_a', 'estate_b', 'life_a', 'charity',
                                                                               'gifts_a', 'gifts_b') if c[k] is not None)
    if c['household'] == 'single':
        s['single: tax above 0'] += d['tax'] > 0
        s['single: gifts above 0'] += c['gifts_a'] > 0
        s['single: law (gift tax subtracted) differs'] += d['law_tax'] != d['tax']
        s['largest single tax'] = max(s.get('largest single tax', ZERO), d['tax'])
        return
    worse_p, worse_n = max(d['law_a_p'], d['law_b_p']), max(d['law_a_n'], d['law_b_n'])
    assert d['page_p'] >= worse_p and d['page_n'] >= worse_n and d['first'] == 0   # the page is never below the law
    if max(c['gifts_a'], c['gifts_b']) <= d['exemption']:
        assert d['law_a_p'] == d['law_b_p'] and d['page_n'] == worse_n   # RULES.md 4.5
        if d['law_a_p'] > 0:
            assert d['page_p'] - d['law_a_p'] == TWO_FIFTHS * abs(c['gifts_a'] - c['gifts_b'])
    s['couple: gifts above 0 (either person)'] += max(c['gifts_a'], c['gifts_b']) > 0
    s['couple: the two people gave different amounts'] += c['gifts_a'] != c['gifts_b']
    s['couple: gifts above the exemption (either)'] += max(c['gifts_a'], c['gifts_b']) > d['exemption']
    s['couple: tax with portability above 0'] += d['page_p'] > 0
    s['couple: tax without portability above 0'] += d['page_n'] > 0
    s['couple: page above the law (portability) by more than a cent'] += d['page_p'] - worse_p > CENT
    s['couple: page above the worse order (no portability) by more than a cent'] += d['page_n'] - worse_n > CENT
    s['couple: the two orders differ (no portability)'] += d['law_a_n'] != d['law_b_n']
    s['couple: portability saves something'] += d['page_n'] > d['page_p']
    s['largest couple tax (no portability)'] = max(s.get('largest couple tax (no portability)', ZERO), d['page_n'])


def build_estate(rng):
    cases = estate_edge_cases()
    n_edge = len(cases)
    while len(cases) < N_ESTATE:
        cases.append(random_household(rng))
    guard, stats, rows = Guard('estate.csv'), Counter(), []
    for i, c in enumerate(cases):
        cid = f'est-edge-{i + 1:03d}' if i < n_edge else f'est-{i - n_edge + 1:04d}'
        d1, d2 = estate_1(c), estate_2(c)
        compare(guard, cid, d1, d2, ESTATE_MONEY, ())
        rows.append(estate_row(cid, c, d1))
        estate_stats(stats, c, d1)
    return rows, stats, guard, n_edge


# ============================ gifts.csv ============================

GIFTS_COLUMNS = ['case_id', 'label', 'givers', 'gifts', 'years', 'allowances', 'unpublished_years', 'exemption',
                 'counted', 'over_by_year', 'elections', 'used_a', 'used_b', 'left_a', 'left_b', 'form709_years',
                 'law_split_years', 'law_counted', 'law_over_by_year', 'law_elections', 'law_used_a', 'law_used_b',
                 'law_left_a', 'law_left_b', 'law_form709_years', 'law_filers', 'law_differs', 'law_reason', 'note']


def gift_text(g):
    y, frm, to, c, kind, el = g
    return f'{y}:{frm}:{to}:{money(F(c, 100))}:{kind}:{"yes" if el else "no"}'


def fmt_counted(counted):
    groups = defaultdict(list)
    for (y, w, to), v in counted.items():
        groups[(y, w)].append((to, v))
    return ';'.join(f'{y}:{w}:' + '|'.join(f'{to}={money(v)}' for to, v in sorted(items))
                    for (y, w), items in sorted(groups.items()))


def fmt_over(over):
    return ';'.join(f'{y}:{w}={money(v)}' for (y, w), v in sorted(over.items()))


def fmt_elections(el):
    return ';'.join(f'{y}:{w}:{to}={money(a)}/{money(b)}' for (y, w, to), (a, b) in sorted(el.items()))


def fmt_years(ys):
    return '|'.join(str(y) for y in ys)


def compare_ledger(guard, where, a, b, givers):
    guard.same(where, 'years', a['years'], b['years'])
    guard.same(where, 'split years', a['split_years'], b['split_years'])
    guard.same(where, 'counted keys', sorted(a['counted']), sorted(b['counted']))
    for k in sorted(a['counted']):
        guard.money(where, f'counted {k}', a['counted'][k], b['counted'][k])
    guard.same(where, 'over keys', sorted(a['over']), sorted(b['over']))
    for k in sorted(a['over']):
        guard.money(where, f'over {k}', a['over'][k], b['over'][k])
    for w in givers:
        guard.money(where, f'used {w}', a['used'][w], b['used'][w])
        guard.money(where, f'left {w}', a['left'][w], b['left'][w])
    guard.same(where, 'election keys', sorted(a['elections']), sorted(b['elections']))
    for k in sorted(a['elections']):
        guard.money(where, f'elected {k}', a['elections'][k][0], b['elections'][k][0])
        guard.money(where, f'excess {k}', a['elections'][k][1], b['elections'][k][1])
    guard.same(where, 'form 709 years', a['form709'], b['form709'])
    guard.same(where, 'filers', a['filers'], b['filers'])
    guard.same(where, 'allowances', [(y, p) for y, _v, p in a['exclusions']], [(y, p) for y, _v, p in b['exclusions']])
    for (y, va, _pa), (_y, vb, _pb) in zip(a['exclusions'], b['exclusions']):
        guard.money(where, f'allowance {y}', va, vb)
    guard.money(where, 'exemption', a['exemption'], b['exemption'])


def gift_edge_cases():
    P = parse_plan
    return [
        P('2026:both:daughter:38000:cash:no', 2, 'RULES.md 9.3, from both',
          '19,000 each = the allowance: nothing over; a return for 2026 (the split); law: both file (convention)'),
        P('2026:A:daughter:38000:cash:no', 2, 'RULES.md 9.3, not split', 'A 19,000 over; left 14,981,000'),
        P('2026:both:daughter:40000:cash:no', 2, 'RULES.md 9.3, 40,000 from both', '1,000 over each; both file'),
        P('2026:B:grandson:120000:529:yes;2027:B:grandson:5000:cash:no', 2, 'RULES.md 9.4, 529 over the cap',
          'elected 95,000, excess 25,000; counted 44,000 / 24,000 / 19,000 x 3; over 25,000 + 5,000 = 30,000'),
        P('2026:both:grandson:120000:529:yes', 2, 'RULES.md 9.4, 529 from both',
          '60,000 each, 12,000 a year each: nothing over; a return for 2026; both file'),
        P('2026:both:son:38000:cash:no;2026:A:nephew:50000:cash:no;2026:B:friend:25000:cash:no', 2,
          'RULES.md 9.5, one gift from both', 'page used A 31,000, B 6,000; law (the whole year split) 6,000 each'),
        P('2025:A:grandson:100000:529:yes;2026:A:nephew:20000:cash:no', 2, 'Form 709 instructions, Pat',
          '2025 counted 5,000 + 19,000 = 24,000; returns 2025 and 2026 only'),
        P('2026:A:niece:15000:529:yes', 2, '529 under the allowance, elected',
          'page spreads 3,000 a year and needs a return; the law ("exceeds") does not: counted 15,000, no return'),
        P('2026:A:niece:19000:529:yes', 2, '529 exactly the allowance, elected',
          'page spreads 3,800 a year; the law does not (19,000 does not exceed 19,000); over 0 either way'),
        P('2026:A:niece:19000.01:529:yes', 2, '529 a cent over the allowance, elected',
          'both spread 3,800.002 a year (written 3,800.00)'),
        P('2026:A:grandson:95000:529:yes', 2, '529 exactly at the cap', '19,000 a year, nothing over; a return for 2026'),
        P('2026:A:grandson:95000.01:529:yes', 2, '529 a cent over the cap', 'excess 0.01 counted in 2026: over 0.01'),
        P('2024:A:grandson:90000:529:yes;2025:A:grandson:1000:cash:no;2026:A:grandson:1000.01:cash:no', 2,
          '529 in 2024, room left later',
          'cap 5 x 18,000; fifths of 18,000 meet the 19,000 allowance of 2025-2028: 1,000 more fits, 1,000.01 is 0.01 over'),
        P('2026:A:grandson:50000:529:no', 2, '529 without the election', 'counted 50,000 in 2026: over 31,000'),
        P('2024:A:son:18000:cash:no;2024:A:daughter:18000.01:cash:no', 2, 'the 2024 allowance line',
          '18,000 is not over; 18,000.01 is 0.01 over'),
        P('2025:A:son:19000:cash:no;2025:A:daughter:19000.01:cash:no', 2, 'the 2025 allowance line', ''),
        P('2026:A:son:19000:cash:no;2026:A:daughter:19000.01:cash:no', 2, 'the 2026 allowance line', ''),
        P('2027:A:son:19000:cash:no;2027:A:daughter:19000.01:cash:no', 2, 'the 2027 allowance line',
          '2027 is not published: the 2026 figure carried forward'),
        P('2026:A:niece:10000:cash:no;2026:A:niece:9000:cash:no;2026:A:niece:0.01:cash:no', 2,
          'three gifts to one recipient', 'the allowance is per recipient and year: 19,000.01 counted, 0.01 over'),
        P('2026:A:son:19000:cash:no;2026:B:son:19000:cash:no', 2, 'each spouse gives the allowance',
          'each has an own allowance: nothing over, no return'),
        P('2024:A:son:25000:cash:no;2025:A:son:25000:cash:no;2026:A:son:25000:cash:no', 1, 'one giver, three years',
          'over 7,000 + 6,000 + 6,000 = 19,000'),
        P('2025:B:friend:60000:cash:no;2026:B:friend:5000:cash:no', 2, 'only the second spouse gives',
          'B 41,000 over; A nothing'),
        P('2025:A:grandson:95000:529:yes;2027:A:grandson:50000:529:yes', 2, 'two elections overlap',
          '2027-2029 counted 19,000 + 10,000 = 29,000, 10,000 over each year; used 30,000'),
        P('2026:A:grandson:50000:529:yes;2026:A:grandson:30000:529:no', 2, 'two 529 gifts, one elected',
          'the statute takes the aggregate of the year: 80,000 elected, 16,000 a year (key\'s reading)'),
        P('2026:both:granddaughter:120000:529:yes;2026:A:granddaughter:10000:cash:no', 2, '529 from both + cash',
          'page: A 12,000 + 10,000 = 22,000, 3,000 over; law: the cash is split too, 17,000 each, nothing over'),
        P('2026:A:son:16000000:cash:no', 2, 'a gift above the exemption',
          'used 15,981,000, left 0 (the exemption is used up; gift tax is due on the 981,000 above it, not on the page)'),
        P('2025:A:grandson:95000:529:yes;2026:both:son:10000:cash:no;2026:A:nephew:30000:cash:no', 2,
          'fifths in a later split year', 'the 2026 fifth stays with A; law splits the nephew gift: nothing over'),
        P('2026:both:son:38000.01:cash:no', 2, 'odd cent from both',
          '19,000.005 each: over 0.005 each, written 0.01 (a half-cent tie); left 14,999,999.995 written 15,000,000.00'),
        P('2026:A:grandson:50000.03:529:yes', 2, '529 fifth with a fraction of a cent', 'fifth 10,000.006, written 10,000.01'),
        P('2026:both:niece:30000:529:yes', 2, '529 from both, each half under the allowance',
          'page spreads 3,000 a year each; law: 15,000 each does not exceed 19,000, so no election'),
        P('2026:A:son:30000:cash:no;2026:B:son:3000:cash:no;2026:both:friend:2000:cash:no', 2,
          'regulation over the instructions',
          'law: split year, nothing over; only A files (25.6019-2); the Form 709 instructions would send both'),
        P('2026:both:son:20000:cash:no;2026:B:friend:50000:cash:no', 2, 'from both beside a large gift',
          'page: B 31,000 over; law: friend 25,000 each, 6,000 over each'),
        P('2027:A:niece:40000:cash:no;2028:both:nephew:50000:cash:no', 2, 'future years only',
          'allowance carried forward to 2027 and 2028'),
    ]


def random_plan(rng):
    givers = 1 if chance(rng, 25) else 2
    n = pick(rng, [(1, 15), (2, 25), (3, 25), (4, 15), (5, 12), (6, 8)])
    pool = rng.sample(RECIPIENTS, rng.randint(1, min(4, n)))
    gifts, qtp_slots = [], set()
    for _ in range(n):
        y = pick(rng, [(2024, 15), (2025, 20), (2026, 35), (2027, 20), (2028, 10)])
        frm = 'A' if givers == 1 else pick(rng, [('A', 40), ('B', 30), ('both', 30)])
        to = rng.choice(pool)
        x = int(R.annual_exclusion(y)[0])
        want_qtp = chance(rng, 22)
        if want_qtp and (y, to) not in qtp_slots:   # at most one 529 contribution per recipient and year
            qtp_slots.add((y, to))
            elect = chance(rng, 70)
            lo, hi = pick(rng, [((5000, x), 25), ((x, 5 * x), 50), ((5 * x, 250000), 25)])
            amount = draw_cents(rng, lo, hi, pick(rng, [('hundred', 50), ('dollar', 40), ('cent', 10)]))
            gifts.append((y, frm, to, amount, '529', elect))
            continue
        band = pick(rng, [((1000, x), 55), ((x, 3 * x), 28), ((3 * x, 250000), 12), ((250000, 2000000), 4),
                          ((2000000, 6000000), 1)])
        grain = 'thousand' if band[0] >= 250000 else pick(rng, [('dollar', 70), ('hundred', 20), ('cent', 10)])
        gifts.append((y, frm, to, draw_cents(rng, band[0], band[1], grain), 'cash', False))
    gifts.sort(key=lambda g: (g[0], GIVER_ORDER[g[1]], g[2], g[4], g[3], g[5]))
    return {'givers': givers, 'gifts': tuple(gifts), 'label': '', 'note': ''}


def law_reason(plan, page, law):
    out = []
    for y in law['split_years']:
        if any(g[0] == y and g[1] != 'both' for g in plan['gifts']):
            out.append(f'split-all:{y}')
    for k in sorted(set(page['elections']) - set(law['elections'])):
        out.append('529-not-above:{}:{}:{}'.format(*k))
    for k in sorted(set(law['elections']) - set(page['elections'])):
        out.append('529-share-elected:{}:{}:{}'.format(*k))
    return ';'.join(out)


def gifts_row(cid, plan, pg, lw):
    givers = givers_of(plan)
    b = (lambda d: money(d['B']) if 'B' in givers else '')
    allow = sorted({(y, v, p) for y, v, p in pg['exclusions'] + lw['exclusions']})
    row = {'case_id': cid, 'label': plan['label'], 'givers': plan['givers'],
           'gifts': ';'.join(gift_text(g) for g in plan['gifts']), 'years': fmt_years(pg['years']),
           'allowances': '|'.join(f'{y}={money(v)}' for y, v, _p in allow),
           'unpublished_years': fmt_years(y for y, _v, p in allow if not p), 'exemption': money(pg['exemption']),
           'counted': fmt_counted(pg['counted']), 'over_by_year': fmt_over(pg['over']),
           'elections': fmt_elections(pg['elections']), 'used_a': money(pg['used']['A']), 'used_b': b(pg['used']),
           'left_a': money(pg['left']['A']), 'left_b': b(pg['left']), 'form709_years': fmt_years(pg['form709']),
           'law_split_years': fmt_years(lw['split_years']), 'law_counted': fmt_counted(lw['counted']),
           'law_over_by_year': fmt_over(lw['over']), 'law_elections': fmt_elections(lw['elections']),
           'law_used_a': money(lw['used']['A']), 'law_used_b': b(lw['used']), 'law_left_a': money(lw['left']['A']),
           'law_left_b': b(lw['left']), 'law_form709_years': fmt_years(lw['form709']),
           'law_filers': ';'.join(f'{y}:{f}' for y, f in sorted(lw['filers'].items())),
           'law_differs': '', 'law_reason': law_reason(plan, pg, lw), 'note': plan['note']}
    pairs = (('counted', 'law_counted'), ('over_by_year', 'law_over_by_year'), ('elections', 'law_elections'),
             ('used_a', 'law_used_a'), ('used_b', 'law_used_b'), ('form709_years', 'law_form709_years'))
    row['law_differs'] = 'yes' if any(row[a] != row[b] for a, b in pairs) else 'no'
    return row


def ledger_ties(d):
    vals = list(d['counted'].values()) + list(d['over'].values()) + list(d['used'].values()) + list(d['left'].values())
    vals += [v for pair in d['elections'].values() for v in pair]
    return sum(half_cent(v) for v in vals)


def gifts_stats(s, plan, pg, lw, row):
    gs = plan['gifts']
    s[f'givers {plan["givers"]}'] += 1
    s[f'plans with {len(gs)} gift(s)'] += 1
    s['plans with a gift from both'] += any(g[1] == 'both' for g in gs)
    s['plans with a 529 gift'] += any(g[4] == '529' for g in gs)
    s['plans with a 529 election (page)'] += bool(pg['elections'])
    s['plans with a 529 excess over the cap (page)'] += any(v[1] > 0 for v in pg['elections'].values())
    s['plans with anything over (page)'] += any(v > 0 for v in pg['over'].values())
    s['plans with a Form 709 year (page)'] += bool(pg['form709'])
    s['plans touching a year after 2026 (allowance carried forward)'] += bool(row['unpublished_years'])
    s['law differs: plans'] += row['law_differs'] == 'yes'
    s['law differs: the whole year split (reason)'] += 'split-all' in row['law_reason']
    s['law differs: a 529 at or under the allowance not spread (reason)'] += '529-not-above' in row['law_reason']
    s['law differs: used'] += (row['used_a'], row['used_b']) != (row['law_used_a'], row['law_used_b'])
    s['law differs: Form 709 years'] += row['form709_years'] != row['law_form709_years']
    s['law: one spouse alone files in a split year'] += any(y in lw['split_years'] and '|' not in f
                                                            for y, f in lw['filers'].items())
    s['exemption used up, left 0 (page)'] += any(v == 0 for v in pg['left'].values())
    s['written amounts exactly on a half cent before rounding'] += ledger_ties(pg) + ledger_ties(lw)
    s['largest used (page)'] = max(s.get('largest used (page)', ZERO), *pg['used'].values())


def build_gifts(rng):
    cases = gift_edge_cases()
    n_edge = len(cases)
    redraws = 0
    while len(cases) < N_GIFTS:
        plan = random_plan(rng)
        if ledger_ties(gifts_1(plan, False)) or ledger_ties(gifts_1(plan, True)):   # left to the labelled edge row
            redraws += 1
            continue
        cases.append(plan)
    guard, stats, rows = Guard('gifts.csv'), Counter(), []
    stats['random draws redrawn: a written amount on a half cent'] = redraws
    for i, plan in enumerate(cases):
        cid = f'gift-edge-{i + 1:03d}' if i < n_edge else f'gift-{i - n_edge + 1:04d}'
        givers = givers_of(plan)
        pg1, lw1 = gifts_1(plan, False), gifts_1(plan, True)
        pg2, lw2 = ledger_2(plan, False), ledger_2(plan, True)
        compare_ledger(guard, cid + ' page', pg1, pg2, givers)
        compare_ledger(guard, cid + ' law', lw1, lw2, givers)
        row = gifts_row(cid, plan, pg1, lw1)
        rows.append(row)
        gifts_stats(stats, plan, pg1, lw1, row)
    return rows, stats, guard, n_edge


# ===================================================== run =====================================================

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
            tb = e.__traceback__
            while tb.tb_next:
                tb = tb.tb_next
            raise SystemExit(f'RULES.md examples check failed in derivation 2 at line {tb.tb_lineno} {e.args or ""}; '
                             'no CSV written')
        print(f'RULES.md worked examples reproduced by derivation 2: {n_ex} assertions')
    rng = random.Random(SEED)
    built = {}
    for name, build, cols, want in (('schedule.csv', build_schedule, SCHEDULE_COLUMNS, N_SCHEDULE),
                                    ('estate.csv', build_estate, ESTATE_COLUMNS, N_ESTATE),
                                    ('gifts.csv', build_gifts, GIFTS_COLUMNS, N_GIFTS)):
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
