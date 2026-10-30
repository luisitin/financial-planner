"""ESPP answer key: 1,000 invented employee-stock-purchase-plan lots and sales (IRC 423).

Run:  python3 tools/golden_career/espp_key.py
Writes tests/golden/career/espp.csv. Standard library only, Decimal money, deterministic.

Rules (sources in tools/golden_career/README.md):
  * Price paid = 85% of the lower of the offering-day and purchase-day prices (a 15% discount
    with a look-back). Prices are whole multiples of 20 cents, so 85% and 15% of them are whole
    cents and no plan rounding rule is involved. Shares are whole shares.
  * Qualifying disposition: sold MORE than 2 years after the offering (grant) date AND MORE than
    1 year after the purchase. A sale on either anniversary does not qualify (IRC 423(a)(1):
    no disposition "within" those periods; Pub. 525 "Holding period requirement"; Pub. 544: the
    holding period starts the day after the purchase).
  * Qualifying: ordinary income per share = the smaller of (sale price - price paid) and
    (offering-day price - the option price figured as if bought on the offering day, i.e. 15%
    of the offering-day price), never below 0 (IRC 423(c); Pub. 525 "Option granted at a
    discount"). The rest of the result is a long-term gain or loss.
  * Disqualifying: ordinary income per share = purchase-day price - price paid, even when the
    sale is at a loss (IRC 421(b); Pub. 525 "Holding period requirement not satisfied"). Basis
    becomes the purchase-day price; the rest is a gain or loss, long-term only if the shares
    were held more than 1 year after the purchase (Pub. 544 Table 4-1), else short-term.

Two derivations are written here and must agree on every row before the CSV is written.
"""
import sys
sys.dont_write_bytecode = True  # keep the repo free of __pycache__

import csv
import math
import random
from collections import Counter
from datetime import date, timedelta
from decimal import Decimal as D
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'tests' / 'golden' / 'career' / 'espp.csv'
SEED = 20261031
ROWS = 1000
DISCOUNT = D('0.15')          # IRC 423(b)(6) allows a price as low as 85% of the value
PAY_SHARE = 1 - DISCOUNT
ZERO = D(0)
TWENTY_CENTS = D('0.20')
COLUMNS = ['case_id', 'offering_date', 'purchase_date', 'sale_date', 'shares', 'fmv_offering',
           'fmv_purchase', 'price_paid', 'sale_price', 'qualifying', 'ordinary_income',
           'short_gain', 'long_gain']


def add_months(d, n):
    """Same day of the month n months later (the generator only uses days 1-28)."""
    assert d.day <= 28
    years, month0 = divmod(d.month - 1 + n, 12)
    return date(d.year + years, month0 + 1, d.day)


def add_years(d, n):
    assert d.day <= 28 or d.month != 2
    return date(d.year + n, d.month, d.day)


# =============================== derivation 1: the rules ====================================

def work(lot):
    offering, purchase, sale = lot['offering_date'], lot['purchase_date'], lot['sale_date']
    shares = D(lot['shares'])
    fmv_off, fmv_pur, paid, price = lot['fmv_offering'], lot['fmv_purchase'], lot['price_paid'], lot['sale_price']
    more_than_1y_after_purchase = sale > add_years(purchase, 1)
    more_than_2y_after_offering = sale > add_years(offering, 2)
    qualifying = more_than_1y_after_purchase and more_than_2y_after_offering
    gain = price - paid
    if qualifying:
        ordinary = max(ZERO, min(gain, DISCOUNT * fmv_off))
    else:
        ordinary = fmv_pur - paid
    capital = gain - ordinary
    long_term = more_than_1y_after_purchase
    return {
        'qualifying': qualifying,
        'ordinary_income': ordinary * shares,
        'short_gain': ZERO if long_term else capital * shares,
        'long_gain': capital * shares if long_term else ZERO,
    }


# ====================== derivation 2: basis and holding-period counting ======================

def work_alt(lot):
    offering, purchase, sale = lot['offering_date'], lot['purchase_date'], lot['sale_date']
    shares = D(lot['shares'])
    # Pub. 544: start counting on the day after the purchase; "more than 1 year" means the sale
    # falls on or after the day after the first anniversary. Compared as (year, month, day).
    # (day + 1 may be 29 February in a common year; the tuple comparison still holds.)
    first_long_day = (purchase.year + 1, purchase.month, purchase.day + 1)
    long_term = (sale.year, sale.month, sale.day) >= first_long_day
    first_qualifying_grant_day = (offering.year + 2, offering.month, offering.day + 1)
    qualifying = long_term and (sale.year, sale.month, sale.day) >= first_qualifying_grant_day
    proceeds = lot['sale_price'] * shares
    cost = lot['price_paid'] * shares
    if qualifying:
        grant_option_price = PAY_SHARE * lot['fmv_offering']        # as if bought on the offering day
        cap = (lot['fmv_offering'] - grant_option_price) * shares
        ordinary = min(cap, proceeds - cost) if proceeds > cost else ZERO
        basis = cost + ordinary
    else:
        basis = lot['fmv_purchase'] * shares                       # cost plus the wages reported
        ordinary = basis - cost
    capital = proceeds - basis
    return {'qualifying': qualifying, 'ordinary_income': ordinary,
            'short_gain': ZERO if long_term else capital, 'long_gain': capital if long_term else ZERO}


# ===================================== the generator =========================================

def to_twenty_cents(x):
    return max(TWENTY_CENTS, (D(x) / TWENTY_CENTS).quantize(D(1)) * TWENTY_CENTS)


def draw_lot(rng):
    offering = date(rng.randint(2018, 2025), rng.randint(1, 12), rng.randint(1, 28))
    purchase = add_months(offering, rng.randint(3, 27))
    last_sale = add_months(purchase, 40)
    two_years = add_years(offering, 2)
    r = rng.random()
    choices = []
    if r < 0.04:
        choices = [(purchase, 'same day as purchase')]
    elif r < 0.13:
        choices = [(add_years(purchase, 1), '1 year after purchase (anniversary)')]
    elif r < 0.22:
        choices = [(add_years(purchase, 1) + timedelta(days=1), '1 year and 1 day after purchase')]
    elif r < 0.25:
        choices = [(add_years(purchase, 1) - timedelta(days=1), '1 day before the purchase anniversary')]
    elif r < 0.34:
        choices = [(two_years, '2 years after offering (anniversary)')]
    elif r < 0.43:
        choices = [(two_years + timedelta(days=1), '2 years and 1 day after offering')]
    elif r < 0.46:
        choices = [(two_years - timedelta(days=1), '1 day before the 2-year offering mark')]
    sale, kind = None, 'random'
    for d, k in choices:
        if purchase <= d <= last_sale:
            sale, kind = d, k
    if sale is None:
        sale = purchase + timedelta(days=rng.randint(0, (last_sale - purchase).days))

    fmv_off = TWENTY_CENTS * int(round(math.exp(rng.uniform(math.log(10), math.log(3000)))))
    fmv_pur = fmv_off if rng.random() < 0.05 else to_twenty_cents(fmv_off * D(str(round(rng.uniform(0.4, 2.5), 4))))
    paid = PAY_SHARE * min(fmv_off, fmv_pur)
    assert paid == paid.quantize(D('0.01'))
    r = rng.random()
    if r < 0.05:
        sale_price = paid
    elif r < 0.10:
        sale_price = paid + DISCOUNT * fmv_off           # exactly at the 15% cap
    elif r < 0.15:
        sale_price = fmv_pur
    elif r < 0.25 and fmv_pur > paid + D('0.01'):
        sale_price = paid + D(rng.randint(1, int((fmv_pur - paid) * 100) - 1)) / 100  # between paid and FMV
    else:
        sale_price = max(D('0.01'), (fmv_pur * D(str(round(rng.uniform(0.3, 3.0), 4)))).quantize(D('0.01')))
    shares = rng.randint(1, 1500)
    return {'offering_date': offering, 'purchase_date': purchase, 'sale_date': sale, 'shares': shares,
            'fmv_offering': fmv_off, 'fmv_purchase': fmv_pur, 'price_paid': paid,
            'sale_price': sale_price, 'kind': kind}


def main():
    rng = random.Random(SEED)
    rows, stats = [], Counter()
    for i in range(ROWS):
        lot = draw_lot(rng)
        lot['case_id'] = f'espp-{i + 1:04}'
        a, b = work(lot), work_alt(lot)
        if a != b:
            raise AssertionError(f'{lot["case_id"]}: rules {a} vs basis method {b}')
        for k in ('ordinary_income', 'short_gain', 'long_gain'):
            assert a[k] == a[k].quantize(D('0.01')), 'amounts are whole cents by construction'
        total = (lot['sale_price'] - lot['price_paid']) * lot['shares']
        assert a['ordinary_income'] + a['short_gain'] + a['long_gain'] == total
        stats['rows'] += 1
        stats[f'sale {lot["kind"]}'] += 1
        held_long = lot['sale_date'] > add_years(lot['purchase_date'], 1)
        stats['qualifying' if a['qualifying'] else
              'disqualifying, long-term' if held_long else 'disqualifying, short-term'] += 1
        stats['capital loss'] += (a['short_gain'] + a['long_gain']) < 0
        stats['sale below price paid'] += lot['sale_price'] < lot['price_paid']
        rows.append({
            'case_id': lot['case_id'],
            'offering_date': lot['offering_date'].isoformat(),
            'purchase_date': lot['purchase_date'].isoformat(),
            'sale_date': lot['sale_date'].isoformat(),
            'shares': lot['shares'],
            'fmv_offering': f'{lot["fmv_offering"]:.2f}', 'fmv_purchase': f'{lot["fmv_purchase"]:.2f}',
            'price_paid': f'{lot["price_paid"]:.2f}', 'sale_price': f'{lot["sale_price"]:.2f}',
            'qualifying': 'true' if a['qualifying'] else 'false',
            'ordinary_income': f'{a["ordinary_income"]:.2f}',
            'short_gain': f'{a["short_gain"]:.2f}', 'long_gain': f'{a["long_gain"]:.2f}',
        })
    OUT.parent.mkdir(parents=True, exist_ok=True)
    with OUT.open('w', newline='', encoding='utf-8') as fh:
        w = csv.DictWriter(fh, fieldnames=COLUMNS, lineterminator='\n')
        w.writeheader()
        w.writerows(rows)
    print(f'wrote {OUT.relative_to(ROOT)}: {len(rows)} rows; both derivations agree on every row')
    for k in sorted(stats):
        print(f'  {k}: {stats[k]}')


if __name__ == '__main__':
    main()
