"""The household's federal income tax, worked two separate ways, for the business answer keys.

Shared by sole_key.py and scorp_key.py. Never imports or reads the app.

  forms_return()    derivation 1, the forms line by line: Form 1040 lines 1z-28, Schedule 1,
                    Form 8995 lines 1-17, the Qualified Dividends and Capital Gain Tax Worksheet
                    (Form 1040 instructions), Schedule 8812 lines 1-27 with Credit Limit
                    Worksheet A and the Earned Income Worksheet, Form 8960 lines 1-17.
  statute_return()  derivation 2, the statute written differently: IRC 61/62/63 for AGI and
                    taxable income, IRC 199A(a), (b)(3)(A), (e)(1), (i) for the deduction, the
                    Rev. Proc. "base plus rate" tables with IRC 1(h) stacking for the tax, IRC 24(b),
                    (d), (h) for the credit, IRC 32(c)(2)(A) for earned income, IRC 1411.

The quantity both return as `tax` is the one the keys define (and nothing else):
    regular income tax - nonrefundable child tax credit + net investment income tax
    - additional child tax credit.
Self-employment tax and additional Medicare tax are not in it.

amt_guard() works Form 6251 (Part III with the dividends) and raises Unsettled if a row would owe
alternative minimum tax, so the generators redraw it; no row in the keys owes AMT.
"""
import sys
sys.dont_write_bytecode = True

from decimal import Decimal as D, ROUND_HALF_UP, ROUND_CEILING, getcontext
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import rules as R  # noqa: E402

getcontext().prec = 50
ZERO = D(0)


class Unsettled(Exception):
    """The row would need a rule this key does not cover (AMT, 3+ children, over the 199A threshold)."""


def cents(x):
    return x.quantize(D('0.01'), rounding=ROUND_HALF_UP)


# =========================== derivation 1: the forms, line by line ===========================

def tax_computation(year, status, income):
    """Tax on an amount, bracket by bracket (exact; no Tax Table, as in tests/golden/taxes)."""
    income = max(ZERO, income)
    tax, lower = ZERO, ZERO
    tops = list(R.BRACKET_TOPS[year][status]) + [None]
    for top, rate in zip(tops, R.RATES):
        if top is None or income <= top:
            return tax + (income - lower) * rate
        tax += (D(top) - lower) * rate
        lower = D(top)
    raise AssertionError('unreachable')


def qdcg_worksheet(year, status, line15, qd):
    """Qualified Dividends and Capital Gain Tax Worksheet, lines 1-25 (no Schedule D)."""
    zero_top, fifteen_top = (D(x) for x in R.GAIN_TOPS[year][status])
    l1 = line15
    l2 = qd
    l3 = ZERO                         # Form 1040 line 7a: no capital gain on these returns
    l4 = l2 + l3
    l5 = max(ZERO, l1 - l4)
    l6 = zero_top
    l7 = min(l1, l6)
    l8 = min(l5, l7)
    l9 = l7 - l8                      # taxed at 0%
    l10 = min(l1, l4)
    l11 = l9
    l12 = l10 - l11
    l13 = fifteen_top
    l14 = min(l1, l13)
    l15 = l5 + l9
    l16 = max(ZERO, l14 - l15)
    l17 = min(l12, l16)
    l18 = l17 * D('0.15')
    l19 = l9 + l17
    l20 = l10 - l19
    l21 = l20 * D('0.20')
    l22 = tax_computation(year, status, l5)
    l23 = l18 + l21 + l22
    l24 = tax_computation(year, status, l1)
    l25 = min(l23, l24)
    return {'line4': l4, 'line5': l5, 'line25': l25}


def form_8995(year, status, qbi, active, line11, qd):
    """Form 8995 (2025: lines 1-15; 2026 draft: lines 1-17). `qbi` is line 1(c) for the one business."""
    if qbi is None:
        return {'line15': ZERO, 'line17': ZERO, 'deduction': ZERO, 'min_applied': False}
    line2 = qbi                       # lines 1i-1v, column (c): one business
    line3 = ZERO                      # no prior-year qualified business loss carryforward
    line4 = max(ZERO, line2 + line3)
    line5 = line4 * R.QBI_RATE
    line9 = ZERO                      # no REIT dividends or PTP income (lines 6-9)
    line10 = line5 + line9
    line12 = qd                       # net capital gain = qualified dividends (no Schedule D)
    line13 = max(ZERO, line11 - line12)
    line14 = line13 * R.QBI_RATE
    line15 = min(line10, line14)
    out = {'line10': line10, 'line11': line11, 'line14': line14, 'line15': line15,
           'deduction': line15, 'min_applied': False}
    if R.QBI_MIN_DEDUCTION[year] is not None:   # 2026 draft lines 16-17
        line16 = R.QBI_MIN_DEDUCTION[year] if (active and qbi >= R.QBI_MIN_ACTIVE_QBI[year]) else ZERO
        line17 = max(line15, line16)
        out.update(line16=line16, line17=line17, deduction=line17, min_applied=line16 > line15)
    return out


def ceil_to_thousand(x):
    """Schedule 8812 line 10: 'if not a multiple of $1,000, enter the next multiple of $1,000'."""
    if x <= 0:
        return ZERO
    return (x / R.CTC_PHASEOUT_STEP).to_integral_value(rounding=ROUND_CEILING) * R.CTC_PHASEOUT_STEP


def earned_income_worksheet(h):
    """Schedule 8812 instructions, Earned Income Worksheet (no EIC, no optional method)."""
    l1a = h['wages']                  # Form 1040 line 1z
    l1b = ZERO                        # nontaxable combat pay
    l2a = ZERO                        # statutory employee income
    l2b = h['sched_c']                # Schedule C line 31 (S corporation K-1 income is not here)
    l2e = ZERO                        # no farm
    l3 = l1a + l1b + l2a + l2b + l2e
    if l3 <= 0:
        return ZERO
    l4 = ZERO                         # Medicaid waiver payments
    l5 = h['se_half']                 # Schedule 1 line 15
    l6 = l4 + l5
    return l3 - l6                    # line 7


def schedule_8812(year, status, line11a, kids, line18, earned):
    out = {'line12': ZERO, 'line14': ZERO, 'line27': ZERO}
    line3 = line11a                   # no excluded foreign / Puerto Rico income
    line5 = kids * R.CTC_PER_CHILD[year]
    line7 = ZERO                      # no other dependents
    line8 = line5 + line7
    line9 = R.CTC_PHASEOUT_START[status]
    line10 = ceil_to_thousand(line3 - line9)
    line11 = line10 * D('0.05')
    if line8 <= line11:
        return out
    line12 = line8 - line11
    line13 = line18                   # Credit Limit Worksheet A: line 18, no other credits, no Worksheet B
    line14 = min(line12, line13)
    out.update(line12=line12, line14=line14)
    line16a = line12 - line14
    if line16a == 0:
        return out
    line16b = kids * R.ACTC_PER_CHILD[year]
    if line16b >= R.ACTC_PART_IIB_FROM:
        raise Unsettled('Part II-B (3 or more children) is outside this key')
    line17 = min(line16a, line16b)
    line18a = earned
    line19 = line18a - R.ACTC_EARNED_FLOOR if line18a > R.ACTC_EARNED_FLOOR else ZERO
    line20 = line19 * R.ACTC_RATE
    out['line27'] = min(line17, line20)
    return out


def form_8960(status, qd, magi):
    line2 = qd                        # ordinary dividends (all qualified)
    line8 = line2                     # no interest, rents, gains, other investment income
    line12 = line8                    # no investment expenses
    line13 = magi                     # = AGI: no foreign earned income exclusion
    line14 = R.NIIT_THRESHOLD[status]
    line15 = max(ZERO, line13 - line14)
    line16 = min(line12, line15)
    return line16 * R.NIIT_RATE


def forms_return(h):
    """Form 1040 for the household. `h` keys: year, status, kids, wages (box 1 total), qd,
    sched_c (Schedule C line 31), k1 (S corporation ordinary income), se_half, sep, sehi,
    qbi (Form 8995 line 1(c) or None), active."""
    year, s = h['year'], h['status']
    line1z = h['wages']
    line3b = h['qd']                  # ordinary dividends; line 3a qualified = the same amount
    sch1_line3 = h['sched_c']         # business income (Schedule C)
    sch1_line5 = h['k1']              # Schedule E line 41: nonpassive S corporation income or loss
    sch1_line10 = sch1_line3 + sch1_line5
    line8 = sch1_line10
    line9 = line1z + line3b + line8
    sch1_line26 = h['se_half'] + h['sep'] + h['sehi']   # Schedule 1 lines 15, 16, 17
    line10 = sch1_line26
    line11a = line9 - line10
    line12e = D(R.STANDARD_DEDUCTION[year][s])
    f8995 = form_8995(year, s, h['qbi'], h['active'], line11a - line12e, h['qd'])
    line13a = f8995['deduction']
    line13b = ZERO                    # no Schedule 1-A deductions (no tips, overtime, car loan, nobody 65+)
    line14 = line12e + line13a + line13b
    line15 = max(ZERO, line11a - line14)
    ws = qdcg_worksheet(year, s, line15, h['qd'])
    line16 = ws['line25'] if h['qd'] > 0 else tax_computation(year, s, line15)
    line17 = ZERO                     # Schedule 2 line 3: no AMT (amt_guard), no excess APTC
    line18 = line16 + line17
    earned = earned_income_worksheet(h)
    s8812 = schedule_8812(year, s, line11a, h['kids'], line18, earned)
    niit = form_8960(s, h['qd'], line11a)
    tax = line16 - s8812['line14'] + niit - s8812['line27']
    return {
        'agi': line11a, 'ti_before_qbi': line11a - line12e, 'f8995': f8995, 'qbi_deduction': line13a,
        'taxable_income': line15, 'regular_tax': line16, 'ctc_after_phaseout': s8812['line12'],
        'ctc': s8812['line14'],
        'actc': s8812['line27'], 'niit': niit, 'tax': tax, 'earned': earned,
        'ws_line4': ws['line4'], 'ws_line5': ws['line5'],
    }


# ========================= derivation 2: the statute, written differently ======================

def table_tax(year, status, income):
    """IRC 1(j) via the Rev. Proc. tables: 'tax is $base plus rate of the excess over $top'."""
    if income <= 0:
        return ZERO
    tops = [D(0)] + [D(t) for t in R.BRACKET_TOPS[year][status]]
    bases = [D(b) for b in R.BRACKET_BASES[year][status]]
    i = max(k for k in range(len(tops)) if income > tops[k] or k == 0)
    return bases[i] + R.RATES[i] * (income - tops[i])


def tax_1h(year, status, ti, ncg):
    """IRC 1(h)(1)(A)-(D) with the adjusted net capital gain = qualified dividends, capped at the
    tax on all taxable income (1(h)(1): 'shall not exceed')."""
    if ti <= 0:
        return ZERO
    zero_top, fifteen_top = (D(x) for x in R.GAIN_TOPS[year][status])
    ancg = min(ncg, ti)
    ordinary = ti - ancg                                        # (A): greater of TI - NCG, or ...
    at_zero = min(ancg, max(ZERO, zero_top - ordinary))         # (B)
    at_fifteen = min(ancg - at_zero, max(ZERO, min(ti, fifteen_top) - ordinary - at_zero))  # (C)
    at_twenty = ancg - at_zero - at_fifteen                      # (D)
    stacked = table_tax(year, status, ordinary) + D('0.15') * at_fifteen + D('0.20') * at_twenty
    return min(stacked, table_tax(year, status, ti))


def statute_return(h):
    year, s = h['year'], h['status']
    gross_income = h['wages'] + h['qd'] + h['sched_c'] + h['k1']        # IRC 61(a)(1), (2), (7); 1366(a)
    above_line = h['se_half'] + h['sehi'] + h['sep']                    # IRC 164(f), 162(l), 404 via 62(a)(1), (6)
    agi = gross_income - above_line                                    # IRC 62(a)
    std = D(R.STANDARD_DEDUCTION[year][s])                             # IRC 63(c)
    ti_for_199a = agi - std                                            # IRC 199A(e)(1): without the 199A deduction
    if h['qbi'] is None:
        qbi_ded = ZERO
    else:
        if ti_for_199a > R.QBI_THRESHOLD[year][s]:
            raise Unsettled('over the 199A threshold: the W-2 wage limit would apply')
        per_business = R.QBI_RATE * max(ZERO, h['qbi'])                # 199A(b)(2)(A); (b)(3)(A): no (B) limit
        combined = per_business                                        # 199A(b)(1)(A): one business, no REIT/PTP
        income_cap = R.QBI_RATE * max(ZERO, ti_for_199a - h['qd'])     # 199A(a)(2)
        qbi_ded = min(combined, income_cap)                            # 199A(a)
        floor = R.QBI_MIN_DEDUCTION[year]
        if floor is not None and h['active'] and h['qbi'] >= R.QBI_MIN_ACTIVE_QBI[year]:
            qbi_ded = max(qbi_ded, floor)                              # 199A(i)(1)
    ti = max(ZERO, agi - std - qbi_ded)                                # IRC 63(b)
    regular = tax_1h(year, s, ti, h['qd'])
    # IRC 24: $2,200 per child less $50 per $1,000 or fraction over the threshold (cents as integers).
    excess_cents = int((agi - R.CTC_PHASEOUT_START[s]) * 100)
    steps = -(-excess_cents // 100000) if excess_cents > 0 else 0
    credit = max(ZERO, h['kids'] * R.CTC_PER_CHILD[year] - R.CTC_PHASEOUT_PER_STEP * steps)
    nonrefundable = min(credit, regular)                               # 24(b)(3): regular tax liability, no other credits
    earned = max(ZERO, h['wages'] + h['sched_c'] - h['se_half'])       # 32(c)(2)(A) as 24(d)(1)(B)(i) uses it
    if h['kids'] > 2:
        raise Unsettled('3 or more children')
    refundable = min(credit - nonrefundable,                            # 24(d)(1): the part 26(a) disallowed
                     R.ACTC_PER_CHILD[year] * h['kids'],                # 24(h)(5)
                     R.ACTC_RATE * max(ZERO, earned - R.ACTC_EARNED_FLOOR))  # 24(d)(1)(B)(i), (h)(6)
    niit = R.NIIT_RATE * min(h['qd'], max(ZERO, agi - R.NIIT_THRESHOLD[s]))  # IRC 1411(a)(1)
    tax = regular - nonrefundable + niit - refundable
    return {'agi': agi, 'ti_before_qbi': ti_for_199a, 'qbi_deduction': qbi_ded, 'taxable_income': ti,
            'regular_tax': regular, 'ctc': nonrefundable, 'actc': refundable, 'niit': niit, 'tax': tax}


# =================================== the AMT guard (Form 6251) ================================

def amt_guard(h, f):
    """Form 6251 lines 1b-11 with Part III. Raises Unsettled if the row would owe AMT."""
    year, s = h['year'], h['status']
    C = R.CAREER
    line1b = f['agi'] - (D(R.STANDARD_DEDUCTION[year][s]) + f['qbi_deduction'])  # 1040 line 11b - line 14
    line2a = D(R.STANDARD_DEDUCTION[year][s])                                     # 1040 line 12e
    line4 = line1b + line2a
    ex, start, rate = D(C.AMT_EXEMPTION[year][s]), D(C.AMT_PHASEOUT_START[year][s]), C.AMT_PHASEOUT_RATE[year]
    line5 = max(ZERO, ex - rate * max(ZERO, line4 - start))
    line6 = max(ZERO, line4 - line5)
    bp, sub = D(C.AMT_28_FROM[year][s]), D(C.AMT_28_SUBTRACT[year][s])

    def at_26_28(x):
        return x * C.AMT_RATE_LOW if x <= bp else x * C.AMT_RATE_HIGH - sub

    if line6 == 0:
        tmt = ZERO
    elif h['qd'] > 0:
        zero_top, fifteen_top = (D(x) for x in R.GAIN_TOPS[year][s])
        l12 = line6
        l13 = f['ws_line4']
        l16 = min(l12, l13)
        l17 = l12 - l16
        l18 = at_26_28(l17)
        l20 = f['ws_line5']
        l21 = max(ZERO, zero_top - l20)
        l22 = min(l12, l13)
        l23 = min(l21, l22)
        l24 = l22 - l23
        l28 = l21 + f['ws_line5']
        l29 = max(ZERO, fifteen_top - l28)
        l30 = min(l24, l29)
        l31 = l30 * D('0.15')
        l32 = l23 + l30
        l33 = l22 - l32
        l34 = l33 * D('0.20')
        l38 = l18 + l31 + l34
        l39 = at_26_28(l12)
        tmt = min(l38, l39)
    else:
        tmt = at_26_28(line6)
    if tmt > f['regular_tax']:
        raise Unsettled('alternative minimum tax would apply')
    return tmt
