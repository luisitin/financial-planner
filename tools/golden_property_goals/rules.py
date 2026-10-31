"""Rules for the answer key of three household calculators, "Vehicles" (car costs and keep / buy / lease), "Big purchase
planner" and "Renovation" (paying for a home improvement), as data plus small pure functions. Today is 2026-10-31.

Written from the brief (the pages' documented models, called "page convention" below) and the primary sources listed
here, never from the app's code. Nobody opened modules/, core/ or tests/*.test.mjs while writing this file, and it never
imports or runs the app. Only the layout and conventions of tools/golden_property/ and tools/golden_debt/ were looked at
(how their rules.py, README.md and tests/golden/{property,debt}/RULES.md are laid out); no figure or code is shared with them. Every figure names its
source and the date it was read on the same line. Money is an exact Fraction while it is worked and a Decimal when it is
shown. Importing this file runs check_rules(), which asserts the hand-worked examples of
tests/golden/property-goals/RULES.md section 8.

The models (the brief; where a fact the page states could be wrong the key adds a law / contrast figure, see RULES.md):
  VEHICLES  per car: value lost, fuel (or electricity), insurance, upkeep, registration, the loan's interest over the next
            12 payments; total, per mile, monthly. What-if for the first car over a whole number of years: keep (old
            loan's payments + running costs with only the upkeep rising each year, V1; back = its value then - what the
            old loan still owes), buy (trade-in, sales tax, cash down, a level-payment loan, the new car's running costs
            flat every year, V2; back = new car's value - still owed), lease (due at signing per lease started, the
            payments, excess miles, the new car's running costs flat with upkeep halved, V2, less a positive trade-in,
            back = 0); cost = paid - back; the cheapest by a walk keep, buy, lease that changes only for more than $1
            less (A9). (A5 and A6 as revised on 2026-10-31: like for like.) Cash back when the old car's equity and the
            cash down cover the new price with tax (A7); blank what-if inputs take the page's defaults (D1); on an
            electric first car a blank new mpg leaves the new car charged like the car (E1, corrected after the fourth
            revision's comparison with the page).
  PURCHASE  total = price x (1 + sales tax); whole calendar months to the date (W2, P1); save up (an ordinary annuity on
            top of the set-aside money at cash return / 12); finance (level payment, all 0%, or 0% for the promo months
            then apr, the payment solved exactly); pay cash, which fits when the usable cash covers the amount (P3); goals
            give way, least important first, a goal already done skipped (P2), a spare below 0 counted as 0 (B5), and
            their arrival moves.
  RENOVATE  value added, equity change; cash; home-equity line (85% combined limit, borrowable at least 0); cash-out
            refinance (closing costs 3% of mortgage + cost, the page's reading; fits when the new loan is at most 80% of
            the value, HUD1911; none without a mortgage, R3; a blank rate or years 6.5% and 30 years, D1) against keeping
            the old mortgage; personal loan; tax saved when itemizing, on the interest of acquisition debt up to $750,000
            (R1; for the line by P936 Table 1, the mortgage's own share cut over the line's term, L1); today's money at
            the plan's blended return after the tax saved, discounted like the payments (R2, L1); cushion in months; the
            best by a walk that changes only for more than $1 less (R5), the ranking that walk repeated.

Revised four times on 2026-10-31. First (after the first comparison with the pages): C1, B8, 5.2, C4, A5, A6. Second (the
pages' stated conventions given to the key): V1 and V2 (what rises on Keep, Buy and Lease), P1 (W2 months), P2 (a done goal
is skipped), P3 (pay cash fits when the usable cash covers the amount), R1 (tax saved by the law's limits), R2 (today's
money after the tax saved), R3 (no refinance without a mortgage) and R5 (the best by a $1 walk) are now the main readings;
the key's earlier readings are the alt_* contrasts. Third (a verifier's review): the line's tax saved by P936 Table 1 as
law columns. Fourth (more of the pages' stated conventions): L1 (the line's tax saved and today's money by P936 Table 1,
the mortgage's share cut over the line's term, now the main reading; R1's line figure the contrast), A7 (cash back when the
old car's equity and the cash down cover the new price with tax), A9 (the cheapest by a walk keep, buy, lease with a $1
margin), B5 (a spare below 0 counts as 0) and D1 (the pages' defaults for blank what-if, line, refinance and loan inputs).

Sources (all read 2026-10-31; sha256 of the copy read: first 8 ... last 10 hex digits):
  USC163   26 U.S.C. 163(a), (h)(1), (h)(2)(D), (h)(3)(A)-(C), (h)(3)(F)(i)-(ii), (h)(4)(A)-(D), OLRC edition "current
           through Public Law 119-136 (October 22, 2026)"; (h)(3)(F) as amended by Pub. L. 119-21, s.70108 (heading now
           "beginning after 2017", the end date "and before January 1, 2026" struck); (h)(4) added by Pub. L. 119-21,
           s.70203(a)   https://uscode.house.gov/us/usc/119-136/t26/s163/   (ddf94cff...4a740cdbe0)
  LII163   the same section at Cornell LII, read to cross-check (h)(3)(F)(i)(I)-(II) and (h)(4)(A): same text
           https://www.law.cornell.edu/uscode/text/26/163   (53ffe402...5b6e1b091d)
  USC63    26 U.S.C. 63(b)(7) (car-loan interest of 163(h)(4) is deductible without itemizing), same OLRC edition
           https://uscode.house.gov/us/usc/119-136/t26/s63/   (ed5cc3db...c6cabf21e4)
  P936     IRS Publication 936 (2025) "Home Mortgage Interest Deduction", "For use in preparing 2025 Returns" (PDF modified
           2025-12-12): Reminders, Part I (conditions; the home equity Note), Part II Home Acquisition Debt, Refinanced home
           acquisition debt, Cost of home or improvements, Substantial improvement, Mixed-use mortgages
           https://www.irs.gov/pub/irs-pdf/p936.pdf   (a4ef802b...7dc31c32de)
  CFPBHL   CFPB booklet "What you should know about Home Equity Lines of Credit (HELOC)" (PDF of 2022-10-12, the
           booklet required by 12 CFR 1026.40(e)), comparison table p.2   https://files.consumerfinance.gov/f/documents/cfpb_heloc-brochure.pdf
           (7dae37f7...0022cac3a9)
  OCC34    12 CFR part 34, subpart D, Appendix A "Interagency Guidelines for Real Estate Lending Policies", Supervisory
           Loan-to-Value Limits and its footnote 2, eCFR as of 2026-10-29
           https://www.ecfr.gov/api/versioner/v1/full/2026-10-29/title-12.xml?part=34&subpart=D   (20156f0f...cc107e1c54)
  HUD1911  HUD Mortgagee Letter 2019-11 (August 1, 2019), Handbook 4000.1 II.A.8.d.v(B)(1): FHA cash-out refinance
           "The maximum LTV is 80 percent of the Adjusted Value"   https://www.hud.gov/sites/dfiles/OCHCO/documents/19-11ml.pdf
           (27063e59...68c038d243)
  FMREFI   Freddie Mac My Home, "Understanding the costs of refinancing": "you can expect to spend 3%-6% of your loan
           principal"   https://myhome.freddiemac.com/refinancing/costs-of-refinancing   (84e8d3e3...75c63c324e)
  RAMSEY   Ramsey Solutions, G. Kamel, "Car Depreciation: How Much Is Your Car Worth?" (published Nov 20, 2023, last
           updated Jul 22, 2025), "Car Depreciation Rates" table   https://www.ramseysolutions.com/saving/car-depreciation
           (aeae63c0...ab664e9ea9)
  LTREE    LendingTree, "Car Depreciation: How Much Is My Car Worth?" (dateModified 2025-04-30)
           https://www.lendingtree.com/auto/how-much-do-new-cars-depreciate/   (d52c8b51...df56d6f2ac)
  SFARM    State Farm, "Car Depreciation Calculator: How To Minimize Value Loss"
           https://www.statefarm.com/simple-insights/auto-and-vehicles/calculate-your-vehicle-depreciation   (284d1184...478a47d3a3)
  TXMV     Texas Comptroller, Motor Vehicle Tax FAQ ("Will a trade-in reduce the taxable value? Yes.")
           https://comptroller.texas.gov/taxes/motor-vehicle/faq.php   (42e71d3f...57d8e5daec)
  CFPBDI   CFPB Ask CFPB "I got a credit card promising no interest for a purchase if I pay in full within 12 months. How
           does this work?" (last reviewed Jan 22, 2024)
           https://www.consumerfinance.gov/ask-cfpb/what-is-a-deferred-interest-promotion-en-40/   (d9c987de...d5bff6f23b)
  BRIEF    the task brief that states the three pages' models ("page convention") and "Today is 2026-10-31"
  STATED   the pages' stated conventions, given to the key on 2026-10-31: V1-V3, P1-P3, R1-R5 (second revision); L1, A7,
           A9, B5 and D1 (fourth revision: "the pages now do the following")

NOT VERIFIED on any official source (the key states its own convention or marks the figure a page convention):
  - The 85% combined limit of the home-equity line: no law or regulator sets it. CFPBHL: "Generally a percentage of the
    appraised value of your home, minus the amount you owe on your mortgage" (no percentage); OCC34 footnote 2: "A
    loan-to-value limit has not been established for permanent mortgage or home equity loans on owner-occupied, 1- to
    4-family residential property", with credit enhancement expected at 90% or more. A page convention.
  - New-car depreciation 20% in year one then 15% a year: no official source; RAMSEY states exactly these figures (its
    table matches the page's rule for years 1-4 and shows 60% lost at year 5, the rule gives 58.2395%); LTREE and SFARM
    give "about 20%" after a year and about 60% by year five. A page convention consistent with popular averages.
  - The used-car loss of 12% a year, the insurance share 1.25, the upkeep rise 10% a year, the lease upkeep halved, the
    heloc 8% / 10 years, the personal loan 12% / 5 years: page conventions (brief), no source sought. The what-if
    defaults of D1 (new mpg 32, new upkeep $500, new price 35,000, tax 6%, rate 7%, term 60, lease 450 / 3,000 / 36
    months / 12,000 miles / 0.25) and the refinance's 6.5% over 30 years: page conventions (STATED), no source sought.
  - The $1 margins of R5 and A9: page conventions (STATED).
  - Fannie Mae's 80% cash-out refinance limit (Eligibility Matrix) could not be read (HTTP 403); its Selling Guide
    B2-1.3-03 (12/10/2025, read through a fetch tool, no hash) only points to the matrix. HUD1911 (FHA, 80%) is cited.
  - What the page does where the brief leaves room: conventions W1-W3, R1-R2, A1-A10, B1-B9, C1-C9 in RULES.md
    section 7.
"""
import sys
sys.dont_write_bytecode = True  # keep the repo free of __pycache__

import math
from datetime import date, timedelta
from decimal import Decimal as D, localcontext
from fractions import Fraction as F

READ_ON = '2026-10-31'      # every source above was read on this date
TODAY = date(2026, 10, 31)  # BRIEF: "Today is 2026-10-31"; read 2026-10-31
CENT = F(1, 100)
RATE_PLACES = 6             # BRIEF: "Money to the cent; rates and ratios to six decimals"; read 2026-10-31
MAX_MONTHS = 1200           # key guard (100 years): a loan or a goal still open here is "never"; no source; read 2026-10-31


# ---- exact arithmetic helpers ---------------------------------------------------------------------
def _F(x):
    """Exact Fraction from an int, str, Decimal or Fraction. Floats are refused (they are not exact)."""
    if isinstance(x, float):
        raise TypeError('pass money as str, int, Decimal or Fraction, never float')
    if isinstance(x, F):
        return x
    if isinstance(x, (int, D)):
        return F(x)
    return F(D(str(x).strip().replace(',', '').replace('$', '')))


def _opt(x):
    """None or blank stays None; anything else becomes an exact Fraction. A typed 0 is 0, not blank."""
    return None if x is None or (isinstance(x, str) and x.strip() == '') else _F(x)


def _or(x, default):
    """A blank takes the page's default; a typed value (0 included) is kept."""
    v = _opt(x)
    return None if v is None and default is None else (_F(default) if v is None else v)


def _yes(x):
    """yes / no fields: True for yes, y, true, 1."""
    return x is True or str(x).strip().lower() in ('yes', 'y', 'true', '1')


def _d(x):
    """A date from a date or 'YYYY-MM-DD'; None for blank."""
    if x is None or isinstance(x, date):
        return x
    s = str(x).strip()
    return None if s == '' else date.fromisoformat(s)


def round_half_up(x, quantum=CENT):
    """Round x to a multiple of quantum, halves away from zero (the key's display convention R1)."""
    x, q = _F(x), _F(quantum)
    n = abs(x) / q
    k = (2 * n.numerator + n.denominator) // (2 * n.denominator)  # floor(n + 1/2)
    return (k * q) if x >= 0 else -(k * q)


def show(x):
    """Money for display: Decimal rounded half up to the cent (BRIEF "Money to the cent")."""
    if x is None:
        return None
    r = round_half_up(x, CENT)
    return (D(r.numerator) / D(r.denominator)).quantize(D('0.01'))


def show_rate(x):
    """A rate or ratio for display: Decimal rounded half up to six decimals."""
    if x is None:
        return None
    q = F(1, 10 ** RATE_PLACES)
    r = round_half_up(_F(x), q)
    return (D(r.numerator) / D(r.denominator)).quantize(D(1).scaleb(-RATE_PLACES))


def _div(a, b):
    """a / b, or None when b is 0 (a ratio with no denominator is blank)."""
    return None if b is None or b == 0 else _F(a) / _F(b)


def _ln(x):
    """Natural log of a positive Fraction as a Decimal with 60 significant digits (only for first guesses)."""
    with localcontext() as ctx:
        ctx.prec = 60
        return (D(x.numerator) / D(x.denominator)).ln()


# =====================================================================================================
# 1. Calendar months (page B; convention W2 since 2026-10-31, P1; W1 and W3 contrasts; RULES.md s.4.1)
# =====================================================================================================
def _last_day(y, m):
    return date(y + m // 12, m % 12 + 1, 1) - timedelta(days=1)


def add_months(d, k):
    """The date k calendar months after d (k >= 0). A d on the last day of its month gives the last day of the target
    month; a day that does not exist in the target month falls back to that month's last day (the W1 contrast, and B6:
    a goal's arrival date)."""
    n = d.year * 12 + (d.month - 1) + k
    y, m = n // 12, n % 12 + 1
    last = _last_day(y, m)
    if d == _last_day(d.year, d.month):
        return last
    return date(y, m, min(d.day, last.day))


def whole_months(start, end, rule='W2'):
    """Whole calendar months from start to end.
    W2 (the page's convention, P1, main since 2026-10-31): (years x 12 + months) between the two dates, less 1 when
       end's day of the month is before start's (the day of the month must be reached).
    W1 (the key's first reading, now a contrast): the largest k >= 0 with add_months(start, k) <= end (a month from the
       31st ends on the 30th of a 30-day month; from a month's last day, on the next month's last day).
    W3 (contrast): the calendar-month difference, days ignored."""
    s, e = _d(start), _d(end)
    n = (e.year - s.year) * 12 + (e.month - s.month)
    if rule == 'W3':
        return n
    if rule == 'W2':
        return n - (1 if e.day < s.day else 0)
    if rule != 'W1':
        raise ValueError(rule)
    if e < s:
        return 0
    k = max(0, n)
    while k > 0 and add_months(s, k) > e:
        k -= 1
    while add_months(s, k + 1) <= e:
        k += 1
    return k


MIN_MONTHS_TO_DATE = 1  # BRIEF: "months to the date = whole calendar months from today (at least 1 ...)"; read 2026-10-31


def months_to_date(when, today=TODAY, rule='W2'):
    """BRIEF, page B: whole calendar months from today to the date (W2, P1), at least 1; None when the date is blank
    (B1)."""
    w = _d(when)
    if w is None:
        return None
    return max(MIN_MONTHS_TO_DATE, whole_months(today, w, rule))


# =====================================================================================================
# 2. Loans, level payments, savings, present value (shared)
# =====================================================================================================
MONTHS_A_YEAR = 12       # BRIEF: "interest = balance x rate / 12", "i = cash return / 12", "g = growth / 12"; read 2026-10-31
LOAN_STOP = F(5, 1000)   # BRIEF (page A): "stopping at 0.005 or less"; used for every schedule in the key; read 2026-10-31


def run_loan(balance, annual_rate, payment, months=None, keep=False):
    """BRIEF's month, page A (and the key's for every loan): interest = balance x rate / 12; payment = min(payment,
    balance + interest); balance = balance + interest - payment; stop once the balance is 0.005 or less, or after
    `months` months. months=None runs to the end (guard: a payment that never pays it off raises).
    Returns paid, interest (the sum of the monthly interest, convention A8), months run, end balance, and with keep=True
    the list of payments and the list of each month's interest (R2 discounts it)."""
    b, r, p = _F(balance or 0), _F(annual_rate or 0) / MONTHS_A_YEAR, _F(payment or 0)
    if b < 0 or r < 0 or p < 0:
        raise ValueError('loan figures are never negative')
    limit = MAX_MONTHS if months is None else int(months)
    paid = interest = F(0)
    n, pays, ints = 0, [], []
    while n < limit and b > LOAN_STOP:
        i = b * r
        pay = min(p, b + i)
        if months is None and pay <= i:
            raise ValueError('the payment never pays this loan off')
        b = b + i - pay
        paid, interest, n = paid + pay, interest + i, n + 1
        if keep:
            pays.append(pay)
            ints.append(i)
    if months is None and b > LOAN_STOP:
        raise ValueError('loan still open after %d months' % MAX_MONTHS)
    return {'paid': paid, 'interest': interest, 'months': n, 'end': b, 'payments': pays if keep else None,
            'interests': ints if keep else None}


def loan_year(balance, annual_rate, payment):
    """BRIEF, page A: the loan's interest over the next 12 payments (run_loan for 12 months). No loan: None."""
    if _opt(balance) is None and _opt(annual_rate) is None and _opt(payment) is None:
        return None
    return run_loan(balance, annual_rate, payment, months=MONTHS_A_YEAR)


def level_payment(amount, annual_rate, months):
    """The level monthly payment that pays `amount` off in `months` at annual_rate / 12 (BRIEF "pmt(rate / 12, n,
    amount)"; "0% = principal / term"). From the balance after n payments, B (1 + r)^n - p ((1 + r)^n - 1) / r = 0:
    p = B r / (1 - (1 + r)^-n). Exact (a Fraction); not rounded to the cent (convention R2)."""
    a, r, n = _F(amount), _F(annual_rate or 0) / MONTHS_A_YEAR, int(months)
    if n <= 0:
        raise ValueError('a loan needs at least one month')
    if a == 0:
        return F(0)
    if r == 0:
        return a / n
    return a * r / (1 - (1 + r) ** -n)


def level_payment_by_schedule(amount, annual_rate, months):
    """Second derivation of level_payment: the balance after n months is linear in p,
    B_n(p) = A (1 + r)^n - p x sum_{t<n} (1 + r)^t, so p = A (1 + r)^n / sum_{t<n} (1 + r)^t (r = 0 included)."""
    a, r, n = _F(amount), _F(annual_rate or 0) / MONTHS_A_YEAR, int(months)
    return a * (1 + r) ** n / sum(((1 + r) ** t for t in range(n)), F(0))


def promo_payment(amount, apr, term, promo=0):
    """BRIEF, page B, finance: one level payment p for the whole term. promo = 0: pmt(apr / 12, term, amount); promo =
    term (or apr 0): amount / term; 0 < promo < term: 0% for the first `promo` months (the balance falls by p), then
    apr / 12 (the balance grows by its interest and falls by p), leaving exactly 0 after the term. Solved exactly: after
    k promo months the balance is A - k p, and the level payment on it over the m = term - k months left must be p:
    A - k p = p (1 - (1 + r)^-m) / r, so p = A / (k + (1 - (1 + r)^-m) / r)."""
    a, n, k, r = _F(amount), int(term), int(promo or 0), _F(apr or 0) / MONTHS_A_YEAR
    if not 0 <= k <= n or n <= 0:
        raise ValueError('promo months must be between 0 and the term')
    if a <= 0:
        return F(0)
    if k == n or r == 0:
        return a / n
    m = n - k
    return a / (k + (1 - (1 + r) ** -m) / r)


def promo_payment_by_schedule(amount, apr, term, promo=0):
    """Second derivation of promo_payment: the final balance is linear in p. With m = term - k months at r after k at 0%:
    B_final(p) = A (1 + r)^m - p (k (1 + r)^m + sum_{t<m} (1 + r)^t), so p = A (1 + r)^m / (k (1 + r)^m + sum ...)."""
    a, n, k, r = _F(amount), int(term), int(promo or 0), _F(apr or 0) / MONTHS_A_YEAR
    m = n - k
    g = (1 + r) ** m
    return a * g / (k * g + sum(((1 + r) ** t for t in range(m)), F(0)))


def promo_balances(amount, apr, term, promo, payment):
    """The schedule month by month (interest first, then the payment): the balance after each month, exact."""
    b, r, out = _F(amount), _F(apr or 0) / MONTHS_A_YEAR, []
    for t in range(1, int(term) + 1):
        b = b * (1 + (0 if t <= int(promo or 0) else r)) - _F(payment)
        out.append(b)
    return out


def save_up_monthly(total, set_aside, cash_return, n):
    """BRIEF, page B, save up: the monthly m with S (1 + i)^n + m ((1 + i)^n - 1) / i = total, i = cash return / 12
    (deposits at the end of each month, an ordinary annuity); i = 0: (total - S) / n; at least 0."""
    t, s, i, n = _F(total), _F(set_aside or 0), _F(cash_return or 0) / MONTHS_A_YEAR, int(n)
    if n <= 0:
        raise ValueError('at least one month')
    if i == 0:
        m = (t - s) / n
    else:
        g = (1 + i) ** n
        m = (t - s * g) * i / (g - 1)
    return max(F(0), m)


def savings_after(set_aside, monthly, annual_growth, n):
    """S (1 + g)^n + M ((1 + g)^n - 1) / g with g = growth / 12 (g = 0: S + M n): money saved after n months."""
    s, m, g, n = _F(set_aside or 0), _F(monthly or 0), _F(annual_growth or 0) / MONTHS_A_YEAR, int(n)
    if g == 0:
        return s + m * n
    x = (1 + g) ** n
    return s * x + m * (x - 1) / g


def savings_by_simulation(set_aside, monthly, annual_growth, n):
    """Second derivation of savings_after: month by month, balance = balance x (1 + g) + M."""
    b, m, g = _F(set_aside or 0), _F(monthly or 0), _F(annual_growth or 0) / MONTHS_A_YEAR
    for _ in range(int(n)):
        b = b * (1 + g) + m
    return b


def months_to_goal(target, set_aside, monthly, annual_growth):
    """BRIEF, page B: the months n solving S (1 + g)^n + M ((1 + g)^n - 1) / g >= target, rounded up: the smallest whole
    n >= 0 for which savings_after(n) >= target, checked exactly. 0 when already there; None when it never gets there
    (no saving and no growth to help) or only after more than MAX_MONTHS (convention B7). The first guess is
    ceil(ln((T g + M) / (S g + M)) / ln(1 + g)) (g = 0: ceil((T - S) / M)), then corrected by exact comparison."""
    t, s, m = _F(target), _F(set_aside or 0), _F(monthly or 0)
    g = _F(annual_growth or 0) / MONTHS_A_YEAR
    if g < 0 or m < 0:
        raise ValueError('growth and saving are never negative here')
    if s >= t:
        return 0
    if m == 0 and (g == 0 or s <= 0):
        return None
    if g == 0:
        n = math.ceil((t - s) / m)
    else:
        x = (t * g + m) / (s * g + m)
        guess = _ln(x) / _ln(1 + g)
        if guess > MAX_MONTHS + 1:
            return None
        n = max(0, int(guess.to_integral_value(rounding='ROUND_CEILING')))
    while n > 0 and savings_after(s, m, annual_growth, n - 1) >= t:
        n -= 1
    while savings_after(s, m, annual_growth, n) < t:
        n += 1
    return None if n > MAX_MONTHS else n


def months_to_goal_by_iteration(target, set_aside, monthly, annual_growth, cap=MAX_MONTHS):
    """Second derivation of months_to_goal: step month by month until the balance reaches the target."""
    t, b, m = _F(target), _F(set_aside or 0), _F(monthly or 0)
    g = _F(annual_growth or 0) / MONTHS_A_YEAR
    n = 0
    while b < t:
        if n >= cap:
            return None
        b, n = b * (1 + g) + m, n + 1
    return n


def annuity_pv(payment, annual_rate, months):
    """BRIEF, page C: sum over months m = 1..n of payment / (1 + r / 12)^m = payment (1 - (1 + j)^-n) / j (j = 0: p n)."""
    p, j, n = _F(payment), _F(annual_rate or 0) / MONTHS_A_YEAR, int(months)
    if j == 0:
        return p * n
    return p * (1 - (1 + j) ** -n) / j


def pv_payments(payments, annual_rate):
    """BRIEF, page C: sum of each month's payment / (1 + r / 12)^m, m = 1, 2, ... (any list, e.g. the old mortgage's)."""
    j = _F(annual_rate or 0) / MONTHS_A_YEAR
    v, x, total = 1 / (1 + j), F(1), F(0)
    for p in payments:
        x *= v
        total += _F(p) * x
    return total


def pv_interest(amount, annual_rate, payment, months, plan_return):
    """R2 (page C, 2026-10-31): the present value of a loan's interest, sum over months m = 1, 2, ... of that month's
    interest / (1 + d / 12)^m, d the plan's return: exactly the discounting of the payments. The loan is stepped month by
    month (run_loan, keep=True) and its list of monthly interest summed by pv_payments. months=None runs to the end."""
    sched = run_loan(amount, annual_rate, payment, months=months, keep=True)
    if months is not None and sched['months'] != int(months):
        raise ValueError('a level loan stopped before its term')
    return pv_payments(sched['interests'], plan_return)


# =====================================================================================================
# 3. Page A, "Vehicles" (page convention throughout; RULES.md s.3)
# =====================================================================================================
DEFAULT_LOSS = F(12, 100)             # BRIEF: "loss a year (blank = 12%)"; page convention, no source; read 2026-10-31
NEW_YEAR_ONE_KEEP = F(80, 100)        # BRIEF: "a new one = price x 0.8 after year one"; page convention; RAMSEY "After one year ... worth about 20% less than what you paid for it"; LTREE, SFARM "about 20%"; read 2026-10-31
NEW_LATER_YEAR_KEEP = F(85, 100)      # BRIEF: "then x 0.85 a year"; page convention; RAMSEY "a new car depreciates by about 15% every year until it hits the five-year mark"; read 2026-10-31
DEFAULT_INSURANCE_SHARE = F(125, 100) # BRIEF: "new insurance share (blank = 1.25)"; page convention; read 2026-10-31
DEFAULT_UPKEEP_RISE = F(10, 100)      # BRIEF: "upkeep rise (blank = 10% a year)"; page convention; read 2026-10-31
LEASE_UPKEEP_FACTOR = F(1, 2)         # BRIEF: "running costs with upkeep halved"; page convention; read 2026-10-31
RAMSEY_TABLE = (48000, 38400, 32640, 27744, 23582, 19200)  # RAMSEY "Car Depreciation Rates": initial, after 1-5 years (the after-1-month row 43,200 left out); read 2026-10-31
RAMSEY_FIVE_YEAR_LOSS = F(60, 100)    # RAMSEY "around 60% of its value" after five years; LTREE "60% less within five"; SFARM "approximately 60% by year five"; read 2026-10-31
TRADE_IN_TAX_CREDIT_EXAMPLE = 'TX'    # TXMV "Will a trade-in reduce the taxable value? Yes. The value of a motor vehicle a seller receives as consideration for the purchase of another motor vehicle reduces the taxable value"; contrast only, states differ; read 2026-10-31
CAR_LOAN_INTEREST_CAP = 10000         # USC163 (h)(4)(C)(i) "shall not exceed $10,000" (2025-2028, new US-assembled vehicle, loan after 2024; not modelled, note only); read 2026-10-31
CAR_LOAN_PHASEOUT = {'joint': 200000, 'other': 100000}  # USC163 (h)(4)(C)(ii)(I) "$200 for each $1,000 ... exceeds $100,000 ($200,000 in the case of a joint return)"; note only; read 2026-10-31
# D1 (STATED, fourth revision, given to the key 2026-10-31): "a blank new mpg takes 32, a blank new upkeep $500 (and every
# other blank what-if its stated default: new price 35,000, tax 6%, rate 7%, term 60, insurance share 1.25, lease 450 /
# 3,000 / 36 months / 12,000 miles / 0.25, upkeep rise 10%)"; page conventions, no source sought; read 2026-10-31
DEFAULT_NEW_MPG = 32                  # D1; the key's earlier A3 (a blank new mpg keeps the old car's fuel cost) is the contrast
# E1 (corrected 2026-10-31, after the fourth revision's comparison with the page; RULES.md 3.4, 11): D1's 32 is the
# default of the new car's mpg, which the petrol rule uses; an electric car is charged by its kWh (the page's fuel rule,
# "electric: miles x kWh a mile x price"), and the page does not compare gas against electric (its README lists "Gas
# against electric" as not yet built), so on an electric first car a blank new mpg leaves the new car charged like the
# car. The fourth revision's reading (the new car at 32 mpg and a fuel price the electric car carries) is the contrast.
DEFAULT_NEW_UPKEEP = 500              # D1; the key's earlier A3 (a blank new upkeep keeps the old car's) is the contrast
DEFAULT_NEW_PRICE = 35000             # D1
DEFAULT_NEW_TAX = F(6, 100)           # D1
DEFAULT_NEW_RATE = F(7, 100)          # D1
DEFAULT_NEW_TERM = 60                 # D1
DEFAULT_LEASE_MONTHLY = 450           # D1
DEFAULT_LEASE_DUE = 3000              # D1
DEFAULT_LEASE_MONTHS = 36             # D1
DEFAULT_LEASE_MILES = 12000           # D1 (miles a year)
DEFAULT_LEASE_EXCESS = F(25, 100)     # D1 (a mile over)
CHEAPEST_MARGIN = F(1)                # A9 (STATED, fourth revision): "a later way replaces the current cheapest only when its cost is lower by more than $1 (as R5)"; read 2026-10-31


def _is_electric(car):
    return _yes(car.get('electric')) or (_opt(car.get('kwh_per_mile')) is not None and _opt(car.get('mpg')) is None)


def fuel_year(car, mpg=None):
    """BRIEF: fuel = miles / mpg x price; electric: miles x kWh a mile x price a kWh. With `mpg` given (the new car's
    mpg in the what-if), the petrol rule is used with that mpg and the car's fuel price (convention A3)."""
    miles = _F(car['miles'])
    if mpg is None and _is_electric(car):
        return miles * _F(car['kwh_per_mile']) * _F(car['kwh_price'])
    m = _F(mpg if mpg is not None else car['mpg'])
    if m <= 0:
        raise ValueError('mpg must be more than 0')
    return miles / m * _F(car['fuel_price'])


def car_year(car):
    """BRIEF, page A, a car's year. value lost = value x loss (blank 12%); fuel; insurance, upkeep (maintenance),
    registration as typed; the loan's interest over the next 12 payments; total; per mile = total / miles (blank at 0
    miles, A10); monthly = total / 12."""
    value, loss = _F(car['value']), _or(car.get('loss'), DEFAULT_LOSS)
    lost = value * loss
    fuel = fuel_year(car)
    ins, upk, reg = (_or(car.get(k), 0) for k in ('insurance', 'maintenance', 'registration'))
    loan = loan_year(car.get('loan_balance'), car.get('loan_rate'), car.get('loan_payment'))
    interest = loan['interest'] if loan else F(0)
    total = lost + fuel + ins + upk + reg + interest
    return {'value_lost': lost, 'fuel': fuel, 'insurance': ins, 'maintenance': upk, 'registration': reg,
            'loan_interest': interest, 'total': total, 'per_mile': _div(total, _F(car['miles'])),
            'monthly': total / MONTHS_A_YEAR, 'loan': loan}


def used_value(value, loss, years):
    """BRIEF: a used car after n years = value x (1 - loss)^n."""
    return _F(value) * (1 - _F(loss)) ** int(years)


def new_value(price, years):
    """BRIEF: a new car = price x 0.8 after year one, then x 0.85 a year: price x 0.8 x 0.85^(n - 1); n = 0: price."""
    n = int(years)
    if n == 0:
        return _F(price)
    return _F(price) * NEW_YEAR_ONE_KEEP * NEW_LATER_YEAR_KEEP ** (n - 1)


def running_costs(parts, rise, years, rise_on):
    """Fuel, insurance, registration and upkeep for each year t = 0 .. Y - 1 of the period (year 1 at today's level).
    rise_on='upkeep' (V1, the page's Keep, main since 2026-10-31): year t = fuel + insurance + registration + upkeep x
    (1 + rise)^t; only the upkeep rises. rise_on='none' (V2, the page's Buy and Lease): every year at today's figures.
    rise_on='all' (A1, the key's first reading of the brief's "each year's running costs rising by the upkeep rise",
    now a contrast): year t = (fuel + insurance + registration + upkeep) x (1 + rise)^t. Returns (total, per-year list)."""
    rise, y = _F(rise), int(years)
    flat = parts['fuel'] + parts['insurance'] + parts['registration']
    per = []
    for k in range(y):
        f = (1 + rise) ** k
        if rise_on == 'all':
            per.append((flat + parts['upkeep']) * f)
        elif rise_on == 'upkeep':
            per.append(flat + parts['upkeep'] * f)
        elif rise_on == 'none':
            per.append(flat + parts['upkeep'])
        else:
            raise ValueError(rise_on)
    return sum(per, F(0)), per


def _whatif_inputs(car, w, blanks='page'):
    """The what-if's period, trade-in, rise and the old and new car's running parts. blanks='page' (D1, the page's stated
    convention since the fourth revision): a blank new mpg takes 32 (the petrol rule at the car's own fuel price), a blank
    new maintenance $500; on an electric first car a blank new mpg leaves the new car charged like the car (E1, corrected
    after the fourth revision's comparison). blanks='petrol32' (E1's contrast, the fourth revision's reading): a blank new
    mpg is 32 at the car's fuel price on an electric car too. blanks='old' (A3, the key's earlier reading, now a
    contrast): a blank new mpg keeps the old car's fuel or electricity cost, a blank new maintenance the old car's upkeep."""
    years = int(_F(w['years']))
    if years <= 0 or _F(w['years']) != years:
        raise ValueError('the what-if period is a whole number of years (A9)')
    bal = _or(car.get('loan_balance'), 0)
    tin = _F(car['value']) - bal
    rise = _or(w.get('upkeep_rise'), DEFAULT_UPKEEP_RISE)
    share = _or(w.get('new_insurance_share'), DEFAULT_INSURANCE_SHARE)
    new_mpg = _opt(w.get('new_mpg'))
    if blanks == 'page':
        new_upkeep = _or(w.get('new_maintenance'), DEFAULT_NEW_UPKEEP)                                # D1
        if new_mpg is None and _is_electric(car):
            new_fuel = fuel_year(car)                                                                 # E1
        else:
            new_fuel = fuel_year(car, new_mpg if new_mpg is not None else _F(DEFAULT_NEW_MPG))       # D1
    elif blanks == 'petrol32':
        new_upkeep = _or(w.get('new_maintenance'), DEFAULT_NEW_UPKEEP)                                # D1
        new_fuel = fuel_year(car, new_mpg if new_mpg is not None else _F(DEFAULT_NEW_MPG))           # E1's contrast
    elif blanks == 'old':
        new_upkeep = _or(w.get('new_maintenance'), _or(car.get('maintenance'), 0))                   # A3 contrast
        new_fuel = fuel_year(car, new_mpg) if new_mpg is not None else fuel_year(car)                # A3 contrast
    else:
        raise ValueError(blanks)
    old_parts = {'fuel': fuel_year(car), 'insurance': _or(car.get('insurance'), 0),
                 'registration': _or(car.get('registration'), 0), 'upkeep': _or(car.get('maintenance'), 0)}
    new_parts = {'fuel': new_fuel, 'insurance': old_parts['insurance'] * share,
                 'registration': old_parts['registration'], 'upkeep': new_upkeep}         # A4
    return years, years * MONTHS_A_YEAR, tin, rise, old_parts, new_parts


def keep_way(car, w, rise_on='upkeep'):
    """BRIEF, keep: the old loan's payments over the period (stopping when paid) + running costs (V1: only the upkeep
    rises, rise_on='upkeep'; 'all' is the A1 contrast); back = the car's value
    at the end (used_value) less what the old loan still owes then (A6, revised 2026-10-31: the brief's back left the
    debt in, but Buy pays the whole old loan off through the trade-in, so like for like Keep must count the part still
    owed; 'value_end' is the car's value alone and vehicles_case's alt 'keep_owed_end_ignored' the brief's figure)."""
    years, months, tin, rise, old_parts, _ = _whatif_inputs(car, w)
    loss = _or(car.get('loss'), DEFAULT_LOSS)
    old = run_loan(car.get('loan_balance'), car.get('loan_rate'), car.get('loan_payment'), months=months)
    run, per = running_costs(old_parts, rise, years, rise_on)
    paid = old['paid'] + run
    value_end = used_value(car['value'], loss, years)
    back = value_end - old['end']
    cost = paid - back
    return {'loan_paid': old['paid'], 'loan_months': old['months'], 'owed_end': old['end'], 'running': run,
            'running_years': per, 'paid': paid, 'value_end': value_end, 'back': back, 'cost': cost,
            'monthly': cost / months}


def buy_way(car, w, rise_on='none', taxable_price=None, blanks='page'):
    """BRIEF, buy: trade-in = value - loan balance; a negative trade-in is paid in cash; financed = new price x (1 +
    sales tax) - max(0, trade-in) - cash down, a level-payment loan at the new rate over the new term (0% = principal /
    term), paid for the period (stopping when paid); cash down counted as paid; running costs of the new car, flat every
    year (V2: fuel at the new mpg + insurance x the share + registration + the new upkeep; rise_on='none'; 'all' and
    'upkeep' are contrasts); back = the
    new car's value at the end - what is still owed. A7 (STATED, fourth revision): cash back = max(0, max(0, trade-in) +
    cash down - new price x (1 + tax)), the financed amount is then 0, and paid = cash down + max(0, -trade-in) - cash
    back + payments + running costs. taxable_price (contrast only): the base the sales tax is charged on (TXMV: price less
    the trade-in's value). D1: a blank new price 35,000, tax 6%, rate 7%, term 60, cash down 0."""
    years, months, tin, rise, _, new_parts = _whatif_inputs(car, w, blanks)
    price, tax = _or(w.get('new_price'), DEFAULT_NEW_PRICE), _or(w.get('new_sales_tax'), DEFAULT_NEW_TAX)     # D1
    rate, term = _or(w.get('new_rate'), DEFAULT_NEW_RATE), int(_or(w.get('new_term'), DEFAULT_NEW_TERM))      # D1
    down = _or(w.get('cash_down'), 0)
    base = price if taxable_price is None else _F(taxable_price)
    raw = price + base * tax - max(F(0), tin) - down
    financed = max(F(0), raw)
    cash_back = max(F(0), max(F(0), tin) + down - (price + base * tax))       # A7, as the page states it (= max(0, -raw))
    negative = max(F(0), -tin)
    if financed > 0:
        pmt = level_payment(financed, rate, term)
        loan = run_loan(financed, rate, pmt, months=months)
    else:
        pmt, loan = F(0), {'paid': F(0), 'end': F(0), 'months': 0, 'interest': F(0)}
    run, per = running_costs(new_parts, rise, years, rise_on)
    paid = down + negative - cash_back + loan['paid'] + run                    # A7
    value_end = new_value(price, years)
    back = value_end - loan['end']
    cost = paid - back
    return {'trade_in': tin, 'negative_trade_in_cash': negative, 'financed': financed, 'cash_back': cash_back,
            'payment': pmt, 'loan_paid': loan['paid'], 'loan_months': loan['months'], 'owed_end': loan['end'],
            'running': run, 'running_years': per, 'price': price,
            'value_end': value_end, 'paid': paid, 'back': back, 'cost': cost, 'monthly': cost / months}


def lease_way(car, w, rise_on='none', running_from='new', blanks='page'):
    """BRIEF, lease: due at signing for each lease started in the period (ceil(period months / lease months)) + the
    payment every month + (miles a year - lease miles a year, at least 0) x years x the excess charge + running costs
    with upkeep halved, flat every year (V2, rise_on='none'; 'all' and 'upkeep' are contrasts); back = 0; a negative
    trade-in is paid in cash here too. running_from='new' (A2, the page's stated reading since 2026-10-31): the new
    car's running costs (new mpg, insurance x share, registration) with the new upkeep halved;
    'old' (A2 contrast): the old car's running costs with its upkeep halved. A positive trade-in is credited (A5, revised
    2026-10-31): the old car goes when the lease starts (a negative trade-in is paid in cash, as the brief says), so its
    equity comes back as cash at signing, as Buy takes it off what is financed; paid is net of it. The brief credited
    nothing (vehicles_case's alt 'lease_equity_not_credited'). D1: a blank lease payment 450, due at signing 3,000,
    lease months 36, miles a year 12,000, excess charge 0.25 a mile."""
    years, months, tin, rise, old_parts, new_parts = _whatif_inputs(car, w, blanks)
    base = dict(new_parts if running_from == 'new' else old_parts)
    base['upkeep'] = base['upkeep'] * LEASE_UPKEEP_FACTOR
    lm = int(_or(w.get('lease_months'), DEFAULT_LEASE_MONTHS))                                   # D1
    leases = -(-months // lm)
    due = _or(w.get('lease_due'), DEFAULT_LEASE_DUE) * leases                                    # D1
    payments = _or(w.get('lease_monthly'), DEFAULT_LEASE_MONTHLY) * months                       # D1
    over = max(F(0), _F(car['miles']) - _or(w.get('lease_miles'), DEFAULT_LEASE_MILES))          # D1
    excess = over * years * _or(w.get('lease_excess'), DEFAULT_LEASE_EXCESS)                     # D1
    run, per = running_costs(base, rise, years, rise_on)
    negative, credited = max(F(0), -tin), max(F(0), tin)
    paid = due + payments + excess + run + negative - credited
    return {'leases': leases, 'due_total': due, 'payments': payments, 'excess_miles': over * years,
            'excess_miles_charge': excess, 'running': run,
            'running_years': per, 'negative_trade_in_cash': negative, 'trade_in_credited': credited, 'paid': paid,
            'back': F(0), 'cost': paid, 'monthly': paid / months}


WAY_ORDER_A = ('keep', 'buy', 'lease')  # A9: the cheapest's walk order (and the tie order of the alt_cheapest_lowest contrast); read 2026-10-31


def vehicles_case(case):
    """Page A for one household. case: {'cars': [1 or 2 cars], 'whatif': {...} or None}. Each car: value, miles, mpg
    and fuel_price (or electric with kwh_per_mile and kwh_price), insurance, maintenance, registration, loss (blank 12%),
    loan_balance, loan_rate, loan_payment (blank = no loan). The what-if is for the first car: years, new_price,
    new_sales_tax, new_mpg, new_rate, new_term, cash_down, new_insurance_share, new_maintenance, lease_monthly,
    lease_due, lease_months, lease_miles, lease_excess, upkeep_rise. Returns the page's figures and the contrasts."""
    cars = case['cars']
    if not 1 <= len(cars) <= 2:
        raise ValueError('one or two cars')
    out = {'cars': [car_year(c) for c in cars], 'whatif': None}
    w = case.get('whatif')
    if not w:
        return out
    car = cars[0]
    # D1 (fourth revision): every blank what-if input takes the page's default, so Buy and Lease always exist (before it
    # the key left out Buy without a new price and Lease without a payment or months; no row had them blank)
    ways = {'keep': keep_way(car, w), 'buy': buy_way(car, w), 'lease': lease_way(car, w)}
    costs = {k: ways[k]['cost'] for k in WAY_ORDER_A}
    # A9 (STATED, fourth revision): walk keep, buy, lease; a later way replaces the current cheapest only when its cost
    # is lower by more than $1 (the R5 walk, best_by_walk below); the key's earlier reading (the lowest, ties to the
    # first in the order) is the contrast 'cheapest_lowest'
    cheapest = best_by_walk(WAY_ORDER_A, costs, CHEAPEST_MARGIN)
    # contrasts, each changing one reading: 'rise_all' = A1, the key's first reading (every running cost rises, on all
    # three ways); 'rise_upkeep_only' on Buy and Lease = Keep's own rule (V1) applied to the new car, like for like
    alt = {'rise_all': {'keep': keep_way(car, w, rise_on='all')['cost']}, 'rise_upkeep_only': {},
           'cheapest_lowest': min(WAY_ORDER_A, key=lambda k: (costs[k], WAY_ORDER_A.index(k)))}
    alt['rise_all']['buy'] = buy_way(car, w, rise_on='all')['cost']
    alt['rise_upkeep_only']['buy'] = buy_way(car, w, rise_on='upkeep')['cost']
    taxable = max(F(0), ways['buy']['price'] - _F(car['value']))
    alt['buy_tax_after_trade_in_credit'] = buy_way(car, w, taxable_price=taxable)['cost']
    alt['rise_all']['lease'] = lease_way(car, w, rise_on='all')['cost']
    alt['rise_upkeep_only']['lease'] = lease_way(car, w, rise_on='upkeep')['cost']
    alt['lease_old_running'] = lease_way(car, w, running_from='old')['cost']
    alt['lease_equity_not_credited'] = ways['lease']['cost'] + ways['lease']['trade_in_credited']   # A5, the brief's
    alt['keep_owed_end_ignored'] = ways['keep']['cost'] - ways['keep']['owed_end']                       # A6, the brief's
    # A3 (the key's earlier reading of a blank new mpg or new maintenance, D1's contrast): the old car's fuel and upkeep
    alt['blank_keeps_old'] = {'buy': buy_way(car, w, blanks='old')['cost'], 'lease': lease_way(car, w, blanks='old')['cost']}
    # E1's contrast (the fourth revision's reading): on an electric first car a blank new mpg is 32 at the car's fuel price
    alt['electric_new_at_32_mpg'] = {'buy': buy_way(car, w, blanks='petrol32')['cost'],
                                     'lease': lease_way(car, w, blanks='petrol32')['cost']}
    out['whatif'] = {'months': int(_F(w['years'])) * MONTHS_A_YEAR, 'ways': ways, 'cheapest': cheapest, 'alt': alt,
                     'new_car_loss_at_end': 1 - new_value(1, int(_F(w['years'])))}
    return out


# =====================================================================================================
# 4. Page B, "Big purchase planner" (page convention; RULES.md s.4)
# =====================================================================================================
PRIORITIES = (1, 2, 3)  # BRIEF: "priority 1-3 (1 most important)"; read 2026-10-31
MAX_GOALS = 4           # BRIEF: "goals (0 to 4 ...)"; read 2026-10-31


def _give_order(goals):
    """BRIEF: least important first (priority 3, then 2, then 1), within a priority the latest due first. B3: a blank due
    date counts as the latest; equal due dates keep the listed order."""
    def key(ix):
        i, g = ix
        due = _d(g.get('due'))
        return (-int(g['priority']), 0 if due is None else 1, -(due.toordinal() if due else 0), i)
    return [g for _, g in sorted(enumerate(goals), key=key)]


def give_way(goals, monthly, spare, today=TODAY, done_gives=False, spare_literal=False):
    """BRIEF: when a way's monthly amount is more than spare, goals give up their monthly saving in _give_order, each up
    to its whole monthly saving, until the gap is covered. B5 (STATED, fourth revision): need = monthly - max(0, spare),
    at least 0: a spare below 0 counts as 0 (the page: "Nothing spare: everything comes from goals"). spare_literal=True
    is the key's earlier reading (need = monthly - spare even when spare is below 0), now a contrast. P2 (the page's stated
    convention, main since 2026-10-31): a goal already done (its set-aside money has reached its target, the page's
    status "done") is never taken from; it is skipped and the next goal in the order gives instead. done_gives=True is
    the key's first reading (a done goal gives too, and is paused when it gives all), now a contrast. Each goal: old
    and new arrival in whole months (months_to_goal, rounded up) and as dates (add_months from today, B6); a goal left
    at 0 after giving is paused (B4: new arrival None; growth_only_months shown). What no goal covers is "more than you
    have" (shortfall > 0)."""
    m, s = _F(monthly), _F(spare)
    if not spare_literal:
        s = max(F(0), s)                                                    # B5
    need = m - s if m > s else F(0)
    left, rows = need, []
    for g in (_give_order(goals) if need > 0 else goals):
        old_m = _or(g.get('monthly'), 0)
        target, sa, gr = _F(g['target']), _or(g.get('set_aside'), 0), _or(g.get('growth'), 0)
        done = sa >= target
        skipped = done and not done_gives
        give = F(0) if skipped else min(old_m, left)
        skipped_with_something_to_give = skipped and left > 0 and old_m > 0
        left -= give
        new_m = old_m - give
        old_n = months_to_goal(target, sa, old_m, gr)
        paused = give > 0 and new_m == 0
        new_n = None if paused else months_to_goal(target, sa, new_m, gr)
        due = _d(g.get('due'))
        old_at = add_months(today, old_n) if old_n is not None else None
        new_at = add_months(today, new_n) if new_n is not None else None
        rows.append({'name': g.get('name'), 'priority': int(g['priority']), 'done': done,
                     'skipped_done': skipped_with_something_to_give, 'gives': give, 'monthly_old': old_m,
                     'monthly_new': new_m, 'old_months': old_n, 'new_months': new_n,
                     'delay_months': (new_n - old_n) if (old_n is not None and new_n is not None) else None,
                     'old_arrival': old_at, 'new_arrival': new_at, 'paused': paused,
                     'growth_only_months': months_to_goal(target, sa, 0, gr) if paused else None,
                     'on_time_old': (old_at <= due) if (due and old_at) else None,
                     'on_time_new': (new_at <= due) if (due and new_at) else None})
    return {'need': need, 'covered': need - left, 'shortfall': left, 'more_than_you_have': left > 0, 'goals': rows}


def big_purchase_case(case, inputs, today=TODAY):
    """Page B for one purchase. case: name, price, sales_tax, when (date or blank), set_aside, apr, term, promo, goals.
    inputs: spare, usable_cash, emergency_target, cash_return. Returns the page's figures and the contrasts."""
    goals = case.get('goals') or []
    if len(goals) > MAX_GOALS or any(int(g['priority']) not in PRIORITIES for g in goals):
        raise ValueError('0 to 4 goals, priority 1 to 3')
    total = _F(case['price']) * (1 + _or(case.get('sales_tax'), 0))
    sa = _or(case.get('set_aside'), 0)
    spare = _F(inputs['spare'])
    cash_return = _or(inputs.get('cash_return'), 0)
    # P1 (2026-10-31): the page's W2 count is the main one and every save-up figure uses it; W1 (the key's first
    # reading) and W3 are contrasts
    out = {'total': total, 'months': months_to_date(case.get('when'), today, 'W2'),
           'months_w1': months_to_date(case.get('when'), today, 'W1'),
           'months_w3': months_to_date(case.get('when'), today, 'W3'), 'save': None, 'finance': None, 'alt_w1': None}
    n = out['months']
    if n is not None:                                                          # B1: blank date, no save-up way
        m = save_up_monthly(total, sa, cash_return, n)
        # B8 (revised 2026-10-31): earned = total - set aside - m n with the set-aside money counted up to the total (as
        # the amount to finance is, B2), so it is 0, not below 0, when more than the total is already set aside
        out['save'] = {'monthly': m, 'earned': total - min(sa, total) - m * n,
                       'give_way': give_way(goals, m, spare, today),
                       'give_way_done_gives': give_way(goals, m, spare, today, done_gives=True),       # P2 contrast
                       'give_way_spare_literal': give_way(goals, m, spare, today, spare_literal=True)}  # B5 contrast
        n1 = out['months_w1']
        m1 = save_up_monthly(total, sa, cash_return, n1)
        out['alt_w1'] = {'months': n1, 'monthly': m1, 'earned': total - min(sa, total) - m1 * n1}  # P1 contrast
    amount = max(F(0), total - sa)                                             # B2
    out['amount'] = amount
    if _opt(case.get('term')) is not None:
        term, promo, apr = int(_F(case['term'])), int(_or(case.get('promo'), 0)), _or(case.get('apr'), 0)
        p = promo_payment(amount, apr, term, promo)
        fin = {'payment': p, 'interest': p * term - amount, 'give_way': give_way(goals, p, spare, today),
               'give_way_done_gives': give_way(goals, p, spare, today, done_gives=True),
               'give_way_spare_literal': give_way(goals, p, spare, today, spare_literal=True),          # B5 contrast
               'kind': 'all 0%' if (promo == term or apr == 0) else ('promo' if promo else 'level')}
        if 0 < promo < term and apr > 0 and amount > 0:                       # B9 contrast: a deferred-interest plan (CFPBDI)
            r = apr / MONTHS_A_YEAR
            fin['balance_after_promo'] = amount - promo * p
            fin['deferred_interest_if_not_paid'] = sum(((amount - t * p) * r for t in range(promo)), F(0))
        out['finance'] = fin
    usable = _F(inputs['usable_cash'])
    after = usable - amount
    # P3 (the page's stated convention, 2026-10-31): fits when the usable cash covers the amount; the key's first reading
    # (the brief's "fits = after >= the emergency target") is kept as the contrast
    out['cash'] = {'after': after, 'fits': usable >= amount,
                   'alt_fits_keeps_emergency_target': after >= _F(inputs['emergency_target'])}
    return out


# =====================================================================================================
# 5. Page C, "Renovation" (page convention, with the law's contrasts; RULES.md s.5 and s.6)
# =====================================================================================================
HELOC_CLTV = F(85, 100)              # BRIEF: "borrowable = value x 85% - mortgage"; page convention: CFPBHL "Generally a percentage of the appraised value of your home, minus the amount you owe on your mortgage" (no percentage); OCC34 fn.2 "A loan-to-value limit has not been established for ... home equity loans on owner-occupied, 1- to 4-family residential property"; read 2026-10-31
OCC_CREDIT_ENHANCEMENT_LTV = F(90, 100)  # OCC34 fn.2 "for any such loan with a loan-to-value ratio that equals or exceeds 90 percent at origination, an institution should require appropriate credit enhancement"; contrast only; read 2026-10-31
DEFAULT_HELOC_RATE = F(8, 100)       # BRIEF: "heloc rate (8%)"; page convention; D1 (STATED, fourth revision): "a blank line rate/years 8% / 10"; read 2026-10-31
DEFAULT_HELOC_YEARS = 10             # BRIEF: "and years (10)"; page convention; D1 the same; read 2026-10-31
DEFAULT_REFI_COST_SHARE = F(3, 100)  # BRIEF: "refi costs share (3%)" ("the README says closing costs default 3%"); C1 (revised 2026-10-31): 3% of mortgage + cost, the page's reading (the brief does not say of what; FMREFI "you can expect to spend 3%-6% of your loan principal" is a range, not a rule); 3% of the new loan is the contrast; read 2026-10-31
DEFAULT_LOAN_RATE = F(12, 100)       # BRIEF: "loan rate (12%)"; page convention; D1 (STATED, fourth revision): "a blank loan rate/years 12% / 5"; read 2026-10-31
DEFAULT_LOAN_YEARS = 5               # BRIEF: "and years (5)"; page convention; D1 the same; read 2026-10-31
DEFAULT_REFI_RATE = F(65, 1000)      # D1 (STATED, fourth revision): "a blank refinance rate or years takes 6.5% and 30 years (closing 3%)"; page convention, no source sought; the key's earlier C4 (no refinance unless both are typed) is the contrast; read 2026-10-31
DEFAULT_REFI_YEARS = 30              # D1, the same statement; read 2026-10-31
FHA_CASH_OUT_MAX_LTV = F(80, 100)    # HUD1911 II.A.8.d.v(B)(1)(a) "The maximum LTV is 80 percent of the Adjusted Value" (FHA cash-out refinance); C4 (revised 2026-10-31): the refinance fits when its new loan, closing costs included, is at most this share of the value; read 2026-10-31
ACQ_DEBT_LIMIT = {'married_separate': 375000, 'other': 750000}  # USC163 (h)(3)(F)(i)(II) substitutes "$750,000 ($375,000" for "$1,000,000 ($500,000" for taxable years beginning after 2017 (no end date since Pub. L. 119-21); P936 "For debt secured after December 15, 2017, the limit is $750,000 ($375,000 if married filing separately)"; read 2026-10-31
GRANDFATHERED_LIMIT = {'married_separate': 500000, 'other': 1000000}  # USC163 (h)(3)(B)(ii), (F)(i)(IV); P936 "debt secured after October 13, 1987, and prior to December 16, 2017, the limit is $1 million"; not used (C8); read 2026-10-31
WAY_ORDER_C = ('cash', 'line', 'refi', 'loan')  # R5: the walk's order (and C7's tie order for the alt_ranking_lowest_first contrast); read 2026-10-31
BEST_MARGIN = F(1)   # R5 (the page's stated convention, given to the key 2026-10-31): a way replaces the current best only when its today's money is lower by more than $1; read 2026-10-31


def refi_new_loan(mortgage, cost, share, reading='mortgage_plus_cost'):
    """BRIEF: a new loan of mortgage + cost + closing costs. reading='mortgage_plus_cost' (C1, revised 2026-10-31: the
    page's reading, since the brief does not say what the 3% is a share of): closing costs = share x (mortgage + cost).
    reading='new_loan' (C1 contrast): closing costs = share x the new loan, so the new loan N = (mortgage + cost) / (1 -
    share). They differ by (M + C) share^2 / (1 - share)."""
    base, s = _F(mortgage) + _F(cost), _F(share)
    if reading == 'new_loan':
        n = base / (1 - s)
    elif reading == 'mortgage_plus_cost':
        n = base * (1 + s)
    else:
        raise ValueError(reading)
    return n, n - base


def loan_way(amount, annual_rate, years, plan_return):
    """BRIEF: a loan's level payment pmt(rate / 12, years x 12, amount); interest = payment x n - amount; in today's
    money before tax = sum of payment / (1 + r / 12)^m - cash received (the amount)."""
    n = int(years) * MONTHS_A_YEAR
    p = level_payment(amount, annual_rate, n)
    pv = annuity_pv(p, plan_return, n)
    return {'payment': p, 'months': n, 'total_paid': p * n, 'interest': p * n - _F(amount), 'pv_payments': pv,
            'todays_money': pv - _F(amount), 'todays_money_before_tax': pv - _F(amount)}


def law_deductible_share(acquisition_debt, status='other'):
    """USC163 (h)(3)(B)(ii) with (F)(i)(II): interest is qualified residence interest only on acquisition debt up to
    $750,000 ($375,000 married filing separately). The share of the interest deductible = min(1, limit / debt), by
    principal at the start (P936 Table 1 works with average balances; the page's convention R1 uses this share)."""
    d = _F(acquisition_debt)
    lim = ACQ_DEBT_LIMIT['married_separate' if status == 'married_separate' else 'other']
    return F(1) if d <= lim else F(lim) / d


def best_by_walk(names, money, margin=BEST_MARGIN):
    """R5: walk the ways in the order given (cash, line, refinance, loan, those that fit), starting from the first; a way
    replaces the current best only when its today's money is lower than the best's by more than `margin` ($1)."""
    best = None
    for k in names:
        if best is None or money[k] < money[best] - margin:
            best = k
    return best


def rank_by_walk(names, money):
    """The ranking: the R5 walk repeated (the best, then the best of the ways left, and so on)."""
    left, out = list(names), []
    while left:
        k = best_by_walk(left, money)
        out.append(k)
        left.remove(k)
    return out


def _refi_way(mort, cost, share, rate, n, value, r, top, item, status, old, old_payment=0, reading='mortgage_plus_cost',
              pvi_per_dollar=None):
    """One cash-out refinance (section 5.3) with the old mortgage's run `old` (run_loan keep=True; None = no old side,
    only for the R3 contrast) and its typed payment `old_payment`. R1: tax saved = (new interest x min(M + C, L) / N - old interest x min(1, L / M)) x top,
    only when itemizing; R2: today's money = PV(new payments) - PV(old payments) - C - top x (share_new x PVI_new -
    share_old x PVI_old), PVI = the interest discounted like the payments. pvi_per_dollar: the new loan's interest PV
    per dollar borrowed when already known (the schedule is linear in the amount); None steps the loan here."""
    new_loan, closing = refi_new_loan(mort, cost, share, reading)
    pay = level_payment(new_loan, rate, n)
    new_interest = pay * n - new_loan
    if old is not None:
        old_pay, old_interest = _F(old_payment), old['interest']
        old_pv, old_months = pv_payments(old['payments'], r), old['months']
        old_pvi = pv_payments(old['interests'], r)
        old_share = law_deductible_share(mort, status)
    else:
        old_pay = old_interest = old_pv = old_pvi = old_share = F(0)
        old_months = 0
    lim = ACQ_DEBT_LIMIT['married_separate' if status == 'married_separate' else 'other']
    law_share = min(_F(mort) + _F(cost), F(lim)) / new_loan       # closing costs are not acquisition debt (P936)
    pvi_new = pv_interest(new_loan, rate, pay, n, r) if pvi_per_dollar is None else pvi_per_dollar * new_loan
    pv_new = annuity_pv(pay, r, n)
    before = pv_new - old_pv - _F(cost)
    pv_tax = top * (law_share * pvi_new - old_share * old_pvi) if item else F(0)
    extra = new_interest - old_interest
    return {'new_loan': new_loan, 'closing_costs': closing, 'payment': pay, 'months': n, 'old_payment': old_pay,
            'old_months_left': old_months, 'payment_change': pay - old_pay, 'new_interest': new_interest,
            'old_interest': old_interest, 'extra_interest': extra, 'interest': extra, 'total_paid': pay * n,
            'pv_new': pv_new, 'pv_old': old_pv, 'pv_interest_new': pvi_new, 'pv_interest_old': old_pvi,
            'law_share': law_share, 'old_law_share': old_share,
            'tax_saved': (new_interest * law_share - old_interest * old_share) * top if item else F(0),     # R1 (main)
            'alt_tax_saved_extra_interest': extra * top if item else F(0),     # the key's first reading (C2), contrast
            'tax_saved_whole_new_interest': new_interest * top if item else F(0),                 # C2 contrast
            'pv_tax_saved': pv_tax, 'todays_money_before_tax': before, 'todays_money': before - pv_tax,   # R2
            'ltv_after': new_loan / value, 'above_fha_cash_out_limit': new_loan / value > FHA_CASH_OUT_MAX_LTV,
            # C4 (revised 2026-10-31; R4): HUD1911 "The maximum LTV is 80 percent of the Adjusted Value", on the new
            # loan with the closing costs in it
            'fits': new_loan / value <= FHA_CASH_OUT_MAX_LTV}


def renovation_case(case, inputs):
    """Page C for one project. case: cost, recoup (share), home ('yes'/'no'), home_value, mortgage_balance,
    mortgage_rate, mortgage_payment, heloc_rate, heloc_years, refi_rate, refi_years, refi_cost_share, loan_rate,
    loan_years, filing_status (the $750,000 / $375,000 limit of R1). inputs: usable_cash, blended_return, top_rate,
    itemizes, essential_monthly. Returns the page's figures, the ranking and the contrasts."""
    cost, recoup = _F(case['cost']), _F(case['recoup'])
    r, top, item = _F(inputs['blended_return']), _F(inputs['top_rate']), _yes(inputs.get('itemizes'))
    usable, essential = _F(inputs['usable_cash']), _F(inputs['essential_monthly'])
    has_home = _yes(case.get('home', 'yes')) and _opt(case.get('home_value')) is not None
    status = case.get('filing_status') or 'other'
    added = cost * recoup
    out = {'value_added': added, 'equity_change': added - cost, 'ways': {}, 'alt_refi_no_mortgage': None}
    cushion = usable - cost
    out['ways']['cash'] = {'fits': usable >= cost, 'todays_money': F(0), 'todays_money_before_tax': F(0),
                           'total_paid': cost, 'interest': F(0), 'tax_saved': F(0), 'cushion': cushion,
                           'cushion_months': _div(cushion, essential)}
    refi_blank = False
    if has_home:
        value = _F(case['home_value'])
        mort = _or(case.get('mortgage_balance'), 0)
        mrate, mpay = _or(case.get('mortgage_rate'), 0), _or(case.get('mortgage_payment'), 0)
        has_mortgage = mort > 0 and mpay > 0
        # the old mortgage kept on its own payment until it is paid (section 2.2), with each month's payment and interest
        # listed: the refinance compares against all of it (5.3), L1 takes its months during the line's term
        old = run_loan(mort, mrate, mpay, keep=True) if has_mortgage else None
        hrate = _or(case.get('heloc_rate'), DEFAULT_HELOC_RATE)
        line = loan_way(cost, hrate, int(_or(case.get('heloc_years'), DEFAULT_HELOC_YEARS)), r)
        line['borrowable'] = max(F(0), value * HELOC_CLTV - mort)   # revised 2026-10-31: what could be borrowed is at least 0
        line['fits'] = line['borrowable'] >= cost                   # R4
        line['cltv_after'] = (mort + cost) / value
        # L1 (STATED, fourth revision; P936 Table 1, line 12 "the total of the average balances of all mortgages", line 13
        # "the total amount of interest that you paid on the loans from line 12", line 14 "Divide the amount on line 11 by
        # the amount on line 12", line 15 "Multiply the amount on line 13 by the decimal amount on line 14 ... This is your
        # deductible home mortgage interest"): the limit's share falls on ALL the home's interest, so once the line takes
        # the home's debt over L the mortgage's own interest is cut from s_old to s_new too while both run.
        #   tax saved = (line interest x s_new - the mortgage's interest over the line's term x (s_old - s_new)) x top,
        #   s_new = min(1, L / (M + C)), s_old = min(1, L / M) (0 when M = 0); shares by principal at the start (C8);
        #   the mortgage's interest over the line's term = the old mortgage stepped month by month on its own payment for
        #   the line's months (heloc years x 12), or until it is paid: the first months of `old`.
        # R1's line figure (the second and third revisions' main: the line's own interest x s_new only) is the contrast.
        s_new = law_deductible_share(mort + cost, status)             # (B)(i)(I): debt to improve = acquisition
        s_old = law_deductible_share(mort, status) if mort > 0 else F(0)
        line['law_share'] = s_new
        line['pv_interest'] = pv_interest(cost, hrate, line['payment'], line['months'], r)
        if has_mortgage:
            during = old['interests'][:line['months']]
            line['mortgage_interest_in_term'] = sum(during, F(0))
            pvi_during = pv_payments(during, r)
        else:
            line['mortgage_interest_in_term'], pvi_during = None, F(0)
        mi, cut = line['mortgage_interest_in_term'] or F(0), s_old - s_new
        if item:
            line['tax_saved'] = (line['interest'] * s_new - mi * cut) * top                                 # L1 (main)
            line['pv_tax_saved'] = top * (s_new * line['pv_interest'] - cut * pvi_during)                   # L1, R2
            line['alt_tax_saved_r1'] = line['interest'] * s_new * top                                       # R1 (contrast)
            pv_tax_r1 = top * s_new * line['pv_interest']
        else:
            line['tax_saved'] = line['pv_tax_saved'] = line['alt_tax_saved_r1'] = pv_tax_r1 = F(0)
        line['alt_tax_saved_no_limit'] = line['interest'] * top if item else F(0)            # the key's first reading
        line['todays_money'] = line['todays_money_before_tax'] - line['pv_tax_saved']        # R2 with L1
        line['alt_todays_money_r1'] = line['todays_money_before_tax'] - pv_tax_r1            # R2 with R1 (contrast)
        out['ways']['line'] = line
        # D1 (STATED, fourth revision): a blank refinance rate or years takes 6.5% and 30 years (closing 3%); before it the
        # key offered no refinance unless both were typed (C4's first half, now the contrast alt_ranking_blank_refi_not_offered)
        share = _or(case.get('refi_cost_share'), DEFAULT_REFI_COST_SHARE)
        rate = _or(case.get('refi_rate'), DEFAULT_REFI_RATE)
        n = int(_or(case.get('refi_years'), DEFAULT_REFI_YEARS)) * MONTHS_A_YEAR
        refi_blank = _opt(case.get('refi_rate')) is None or _opt(case.get('refi_years')) is None
        if has_mortgage:
            refi = _refi_way(mort, cost, share, rate, n, value, r, top, item, status, old, mpay)
            # C1 contrast: 3% of the new loan; the same old side, and its interest PV scaled from the main loan's
            # (the schedule is linear in the amount borrowed)
            refi['alt_cost_of_new_loan'] = _refi_way(mort, cost, share, rate, n, value, r, top, item, status, old,
                                                     mpay, 'new_loan', refi['pv_interest_new'] / refi['new_loan'])
            out['ways']['refi'] = refi
        else:
            # R3 (2026-10-31): no mortgage with a payment, no refinance way; the key's first reading (C6: a
            # refinance with an old side of 0) is kept as a contrast
            out['alt_refi_no_mortgage'] = _refi_way(0, cost, share, rate, n, value, r, top, item, status, None)
    loan = loan_way(cost, _or(case.get('loan_rate'), DEFAULT_LOAN_RATE),
                    int(_or(case.get('loan_years'), DEFAULT_LOAN_YEARS)), r)
    loan['fits'] = True
    loan['tax_saved'] = F(0)          # USC163 (h)(1) personal interest; a loan not secured by the home is not (h)(3)
    out['ways']['loan'] = loan
    ways = out['ways']
    fit = [k for k in WAY_ORDER_C if k in ways and ways[k]['fits']]
    after = {k: ways[k]['todays_money'] for k in fit}
    out['ranking'] = rank_by_walk(fit, after)                                                # R5 (main)
    out['best'] = best_by_walk(fit, after)
    out['alt_ranking_lowest_first'] = sorted(fit, key=lambda k: (after[k], WAY_ORDER_C.index(k)))   # C7, the key's
    out['alt_ranking_before_tax'] = rank_by_walk(fit, {k: ways[k]['todays_money_before_tax'] for k in fit})   # C3
    r1 = dict(after)                                                         # L1's contrast: the line's today's money by R1
    if 'line' in r1:
        r1['line'] = ways['line']['alt_todays_money_r1']
    out['alt_ranking_line_r1'] = rank_by_walk(fit, r1)
    # D1's contrast (C4's first half, the key's earlier reading): no refinance offered when its rate or years is blank
    out['alt_ranking_blank_refi_not_offered'] = rank_by_walk([k for k in fit if not (k == 'refi' and refi_blank)], after)
    nm = out['alt_refi_no_mortgage']
    if nm is not None:
        fit2 = [k for k in WAY_ORDER_C if (k == 'refi' and nm['fits']) or (k != 'refi' and k in fit)]
        money2 = dict(after, refi=nm['todays_money'])
        out['alt_ranking_refi_no_mortgage'] = rank_by_walk(fit2, money2)
    else:
        out['alt_ranking_refi_no_mortgage'] = None
    return out


# =====================================================================================================
# 6. Self-checks: rules, the two derivations, RULES.md section 8
# =====================================================================================================
def check_rules():
    n = 0
    # W1 / W2 / W3 from today 2026-10-31 (a month end): RULES.md s.4.1 table.
    for end, want in (('2026-11-30', (1, 0, 1)), ('2026-12-30', (1, 1, 2)), ('2026-12-31', (2, 2, 2)),
                      ('2027-02-28', (4, 3, 4)), ('2027-06-30', (8, 7, 8)), ('2027-07-01', (8, 8, 9)),
                      ('2026-10-31', (0, 0, 0)), ('2026-09-15', (0, -2, -1))):
        assert tuple(whole_months(TODAY, end, k) for k in ('W1', 'W2', 'W3')) == want, end
    assert months_to_date('2026-10-31') == 1 and months_to_date('2026-11-29') == 1 and months_to_date('') is None
    assert months_to_date('2027-06-30') == 7 and months_to_date('2027-06-30', rule='W1') == 8          # P1: W2 is the main count
    assert add_months(date(2026, 1, 31), 1) == date(2026, 2, 28) and add_months(date(2026, 1, 30), 1) == date(2026, 2, 28)
    assert add_months(date(2026, 2, 28), 1) == date(2026, 3, 31) and add_months(date(2027, 2, 15), 12) == date(2028, 2, 15)
    assert whole_months('2026-01-30', '2026-02-28', 'W1') == 1 and whole_months('2026-02-28', '2026-03-30', 'W1') == 0
    assert whole_months('2026-01-30', '2026-02-28') == 0 and whole_months('2026-02-28', '2026-03-30') == 1
    n += 15
    # Level payment: textbook values, the two derivations agree, and the schedule ends at exactly 0.
    assert show(level_payment(100000, '0.06', 360)) == D('599.55') and show(level_payment(200000, '0.065', 360)) == D('1264.14')
    assert show(level_payment(30000, '0.12', 60)) == D('667.33') and level_payment(1200, 0, 12) == 100
    for a, rate, months in ((19560, '0.07', 60), (30000, '0.08', 120), (304000, '0.0625', 360), (500, '0.2499', 7), (900, 0, 9)):
        p = level_payment(a, rate, months)
        assert p == level_payment_by_schedule(a, rate, months)
        assert run_loan(a, rate, p, months=months)['end'] == 0
    n += 9
    # Promo payment: the closed form equals the linear solve; the schedule ends at exactly 0; the edge cases.
    for a, apr, term, k in ((2180, '0.2499', 24, 12), (2180, '0.2499', 24, 1), (5000, '0.18', 36, 35), (999, '0.3', 48, 6)):
        p = promo_payment(a, apr, term, k)
        assert p == promo_payment_by_schedule(a, apr, term, k) and promo_balances(a, apr, term, k, p)[-1] == 0
        assert all(x > 0 for x in promo_balances(a, apr, term, k, p)[:-1])
    assert promo_payment(2400, '0.2499', 24, 24) == 100 and promo_payment(2400, 0, 24, 0) == 100
    assert promo_payment(2180, '0.2499', 24, 0) == level_payment(2180, '0.2499', 24) and promo_payment(0, '0.2', 12, 6) == 0
    n += 6
    # Save up: the formula against month-by-month saving; i = 0; already enough gives 0.
    m = save_up_monthly(3180, 1000, '0.04', 8)
    assert savings_by_simulation(1000, m, '0.04', 8) == 3180 and savings_after(1000, m, '0.04', 8) == 3180
    assert save_up_monthly(3000, 600, 0, 8) == 300 and save_up_monthly(1000, 1200, '0.04', 5) == 0
    n += 3
    # Months to a goal: exact at the boundary (g = 0: 600 / 150 = 4 months, not 5); the two derivations agree.
    assert months_to_goal(1000, 400, 150, 0) == 4 and months_to_goal(1000, 400, 149, 0) == 5
    assert months_to_goal(500, 600, 0, 0) == 0 and months_to_goal(1000, 0, 0, '0.05') is None and months_to_goal(1000, 10, 0, 0) is None
    for args in ((2000, 400, 150, '0.04'), (10000, 2500, 200, '0.04'), (5000, 3000, 100, 0), (10000, 2500, F(4100, 25), '0.04'),
                 (25000, 0, 37, '0.07'), (1000, 999, 0, '0.06'), (7000, 50, 1, '0.12')):
        assert months_to_goal(*args) == months_to_goal_by_iteration(*args), args
    assert months_to_goal(1000, 999, 0, '0.06') == 1 and months_to_goal(1000, 500, 0, '0.12') == 70
    n += 5
    # Present value: the closed form against the sum, at 5% and at 0%.
    assert annuity_pv(100, '0.05', 24) == pv_payments([100] * 24, '0.05') and annuity_pv(100, 0, 24) == 2400
    # R2: the interest's PV, stepped month by month, against the closed form (rA - p) v sum (g v)^k + p a_n; at 0% it is
    # the whole interest; the payments' PV less the principal's PV.
    for a, rate, months, d in ((30000, '0.08', 120, '0.05'), (19560, '0.07', 60, '0.07'), (5000, 0, 24, '0.03'),
                               (303850, '0.0625', 360, 0)):
        p, rr, j = level_payment(a, rate, months), _F(rate) / 12, _F(d) / 12
        v, g = 1 / (1 + j), 1 + rr
        geo = F(months) if g * v == 1 else ((g * v) ** months - 1) / (g * v - 1)
        assert pv_interest(a, rate, p, months, d) == (rr * a - p) * v * geo + p * annuity_pv(1, d, months), (a, rate)
    assert pv_interest(1000, '0.12', 600, None, 0) == F('14.10')
    n += 6
    # The loan month: a loan paid off inside the period stops; interest is accrued monthly on the opening balance.
    ly = run_loan(1000, '0.12', 600, months=12)
    assert ly['months'] == 2 and ly['end'] == 0 and ly['interest'] == F('14.10') and ly['paid'] == F('1014.10')
    n += 1
    # Vehicle values: RAMSEY's table equals the page's rule for years 1-4 (to the dollar), not at year 5.
    assert [round_half_up(new_value(48000, k), 1) for k in range(5)] == list(RAMSEY_TABLE[:5])
    assert new_value(48000, 5) == F('20045.04') and RAMSEY_TABLE[5] == 19200 and 1 - new_value(1, 5) == F('0.5823950')
    assert show(used_value(18000, '0.12', 5)) == D('9499.17') and show(new_value(32000, 5)) == D('13363.36')
    n += 3
    # Renovation pieces: the two refinance readings; the $750,000 share; the closing-cost share of a refinance.
    nl, cl = refi_new_loan(265000, 30000, '0.03', 'new_loan')
    assert cl == nl * F(3, 100) and show(nl) == D('304123.71')
    assert refi_new_loan(265000, 30000, '0.03') == refi_new_loan(265000, 30000, '0.03', 'mortgage_plus_cost') == (F(303850), F(8850))
    assert show(nl - 303850) == D('273.71') and nl - 303850 == F(295000) * F(9, 10000) / F(97, 100)
    assert law_deductible_share(800000) == F(15, 16) and law_deductible_share(400000, 'married_separate') == F(15, 16)
    assert law_deductible_share(750000) == 1
    # R5: the walk keeps the earlier way unless the later one is lower by more than $1, and is not a sort.
    assert best_by_walk(['cash', 'line'], {'cash': 0, 'line': F(-99, 100)}) == 'cash'
    assert best_by_walk(['cash', 'line'], {'cash': 0, 'line': F(-101, 100)}) == 'line'
    assert best_by_walk(['cash', 'line'], {'cash': 0, 'line': -1}) == 'cash'
    assert rank_by_walk(['cash', 'line', 'refi'], {'cash': 0, 'line': F(-8, 10), 'refi': F(-16, 10)}) == ['refi', 'cash', 'line']
    # V1, V2: what rises
    parts = {'fuel': F(100), 'insurance': F(10), 'registration': F(1), 'upkeep': F(1000)}
    assert running_costs(parts, '0.1', 2, 'upkeep')[0] == 111 * 2 + 1000 + 1100
    assert running_costs(parts, '0.1', 2, 'none')[0] == 1111 * 2 and running_costs(parts, '0.1', 2, 'all')[0] == F('2333.1')
    n += 11
    # Fourth revision. D1: every blank what-if input takes the page's default (the sedan, everything blank but 5 years):
    # 35,000 x 1.06 - 12,000 financed at 7% over 60 months; two 36-month leases of 3,000 due and 450 a month; 12,000
    # miles a year against the sedan's 12,000 (no excess); 32 mpg; new upkeep 500; lease upkeep 250.
    blank = vehicles_case({'cars': [SEDAN], 'whatif': dict({k: '' for k in SEDAN_WHATIF}, years=5)})['whatif']['ways']
    bb, bl = blank['buy'], blank['lease']
    assert bb['financed'] == 25100 and bb['payment'] == level_payment(25100, '0.07', 60) and bb['price'] == 35000
    assert bl['leases'] == 2 and bl['due_total'] == 6000 and bl['payments'] == 27000 and bl['excess_miles_charge'] == 0
    assert bb['running_years'][0] == F(12000, 32) * F('3.50') + 1500 * F('1.25') + 200 + 500 and bl['running'] == 5 * (1312 + F(1, 2) + 1875 + 200 + 250)
    # A7: cash back = max(0, max(0, trade-in) + cash down - price x (1 + tax)); with cash back the cost does not depend
    # on the cash down (it comes straight back). A9: the walk keeps the earlier way unless the later one is more than $1
    # lower. B5: a spare below 0 gives the same need as a spare of 0.
    nol = {k: v for k, v in SEDAN.items() if not k.startswith('loan')}
    a7 = [buy_way(dict(nol, value=40000), dict(SEDAN_WHATIF, new_price=24000, new_sales_tax='0.06', cash_down=d)) for d in (0, 3000)]
    assert [x['cash_back'] for x in a7] == [40000 - F(25440), 43000 - F(25440)] and a7[0]['cost'] == a7[1]['cost'] and a7[0]['financed'] == 0
    assert best_by_walk(WAY_ORDER_A, {'keep': 300, 'buy': F('299.60'), 'lease': 9000}, CHEAPEST_MARGIN) == 'keep'
    # lease is 2.01 below keep but exactly 1.00 below buy, the current cheapest: buy stays
    assert best_by_walk(WAY_ORDER_A, {'keep': 300, 'buy': F('298.99'), 'lease': F('297.99')}, CHEAPEST_MARGIN) == 'buy'
    for m in (F('304.99'), F(0), F(-5)):
        assert give_way(SOFA_GOALS, m, -150)['need'] == give_way(SOFA_GOALS, m, 0)['need'] == max(F(0), m)
    assert give_way(SOFA_GOALS, 0, -150, spare_literal=True)['need'] == 150                     # the earlier reading
    # L1 by P936 Table 1 directly: the deductible interest over the line's term with the line, s_new x (line interest +
    # the mortgage's), less without it, s_old x the mortgage's; under the limit L1 equals R1.
    big = renovation_case(dict(KITCHEN, cost=120000, home_value=1400000, mortgage_balance=900000, mortgage_rate='0.04',
                               mortgage_payment=5000), dict(KITCHEN_INPUTS, usable_cash=150000))['ways']['line']
    s_new, s_old = F(750000, 1020000), F(750000, 900000)
    assert big['law_share'] == s_new and big['mortgage_interest_in_term'] == run_loan(900000, '0.04', 5000, months=120)['interest']
    assert big['tax_saved'] == F('0.24') * (s_new * (big['interest'] + big['mortgage_interest_in_term']) - s_old * big['mortgage_interest_in_term'])
    kl = renovation_case(KITCHEN, KITCHEN_INPUTS)['ways']['line']
    assert kl['tax_saved'] == kl['alt_tax_saved_r1'] and kl['todays_money'] == kl['alt_todays_money_r1']
    n += 13
    n += worked_examples()
    return n


SEDAN = {'name': 'Sedan', 'value': 18000, 'miles': 12000, 'mpg': 30, 'fuel_price': '3.50', 'insurance': 1500,
         'maintenance': 800, 'registration': 200, 'loss': '', 'loan_balance': 6000, 'loan_rate': '0.06',
         'loan_payment': 350}
EV = {'name': 'Hatchback', 'value': 22000, 'miles': 8000, 'electric': 'yes', 'kwh_per_mile': '0.30', 'kwh_price': '0.16',
      'insurance': 1300, 'maintenance': 300, 'registration': 250, 'loss': ''}
SEDAN_WHATIF = {'years': 5, 'new_price': 32000, 'new_sales_tax': '0.08', 'new_mpg': 35, 'new_rate': '0.07',
                'new_term': 60, 'cash_down': 3000, 'new_insurance_share': '', 'new_maintenance': 300,
                'lease_monthly': 399, 'lease_due': 2000, 'lease_months': 36, 'lease_miles': 10000,
                'lease_excess': '0.20', 'upkeep_rise': ''}
WAGON = {'name': 'Wagon', 'value': 5000, 'miles': 12000, 'mpg': 20, 'fuel_price': '3.50', 'insurance': 1000,
         'maintenance': 1500, 'registration': 100, 'loss': ''}          # A9's $1 margin (RULES.md 8.1, fourth revision)
WAGON_WHATIF = {'years': 1, 'new_price': 15000, 'new_sales_tax': 0, 'new_mpg': 40, 'new_rate': 0, 'new_term': 12,
                'cash_down': 0, 'new_insurance_share': '1.00', 'new_maintenance': '149.60', 'lease_monthly': 450,
                'lease_due': 3000, 'lease_months': 36, 'lease_miles': 12000, 'lease_excess': '0.25', 'upkeep_rise': ''}
SOFA_GOALS = [
    {'name': 'Holiday', 'priority': 3, 'due': '2027-12-31', 'target': 2000, 'set_aside': 400, 'monthly': 150, 'growth': '0.04'},
    {'name': 'Car fund', 'priority': 2, 'due': '2029-12-31', 'target': 10000, 'set_aside': 2500, 'monthly': 200, 'growth': '0.04'},
    {'name': 'Rainy-day top-up', 'priority': 1, 'due': '2028-06-30', 'target': 5000, 'set_aside': 3000, 'monthly': 100, 'growth': 0}]
SOFA = {'name': 'Sofa', 'price': 3000, 'sales_tax': '0.06', 'when': '2027-06-30', 'set_aside': 1000, 'apr': '0.2499',
        'term': 24, 'promo': 12, 'goals': SOFA_GOALS}
SOFA_INPUTS = {'spare': 80, 'usable_cash': 6000, 'emergency_target': 5000, 'cash_return': '0.04'}
KITCHEN = {'cost': 30000, 'recoup': '0.70', 'home': 'yes', 'home_value': 380000, 'mortgage_balance': 265000,
           'mortgage_rate': '0.035', 'mortgage_payment': 1437, 'heloc_rate': '', 'heloc_years': '', 'refi_rate': '0.0625',
           'refi_years': 30, 'refi_cost_share': '', 'loan_rate': '', 'loan_years': ''}
KITCHEN_INPUTS = {'usable_cash': 40000, 'blended_return': '0.05', 'top_rate': '0.24', 'itemizes': 'yes',
                  'essential_monthly': 4000}


def worked_examples():
    """tests/golden/property-goals/RULES.md section 8, worked by hand there and asserted here."""
    n = 0
    # 8.1 Ana's sedan and hatchback; the sedan's what-if over 5 years.
    r = vehicles_case({'cars': [SEDAN, EV], 'whatif': SEDAN_WHATIF})
    s, e = r['cars']
    assert s['value_lost'] == 2160 and s['fuel'] == 1400 and show(s['loan_interest']) == D('252.62')
    assert show(s['total']) == D('6312.62') and show_rate(s['per_mile']) == D('0.526052') and show(s['monthly']) == D('526.05')
    assert show(s['loan']['end']) == D('2052.62') and s['loan']['paid'] == 4200
    assert e['value_lost'] == 2640 and e['fuel'] == 384 and e['total'] == 4874 and show(e['monthly']) == D('406.17')
    assert show_rate(e['per_mile']) == D('0.609250')
    w = r['whatif']['ways']
    k, b, l = w['keep'], w['buy'], w['lease']
    assert k['loan_months'] == 18 and show(k['loan_paid']) == D('6288.55') and k['owed_end'] == 0
    assert [show(x) for x in k['running_years']] == [D('3900.00'), D('3980.00'), D('4068.00'), D('4164.80'), D('4271.28')]   # V1
    assert show(k['running']) == D('20384.08') and show(k['back']) == D('9499.17') and show(k['cost']) == D('17173.45')
    assert k['value_end'] == k['back']                                   # nothing owed at the end here (A6)
    assert show(k['monthly']) == D('286.22') and show(k['paid']) == D('26672.63')
    assert b['trade_in'] == 12000 and b['financed'] == 19560 and show(b['payment']) == D('387.31')
    assert show(b['loan_paid']) == D('23238.69') and b['owed_end'] == 0 and b['running'] == 17875              # V2: 3,575 x 5
    assert b['running_years'] == [3575] * 5 and show(b['paid']) == D('44113.69')
    assert show(b['back']) == D('13363.36') and show(b['cost']) == D('30750.33') and show(b['monthly']) == D('512.51')
    assert l['leases'] == 2 and l['due_total'] == 4000 and l['payments'] == 23940 and l['excess_miles_charge'] == 2000
    assert l['running'] == 17125 and l['running_years'] == [3425] * 5                                         # V2
    assert l['trade_in_credited'] == 12000 and l['paid'] == 35065                                            # A5
    assert l['cost'] == 35065 and show(l['monthly']) == D('584.42')
    assert r['whatif']['cheapest'] == 'keep'
    a = r['whatif']['alt']
    assert [show(a['rise_all'][x]) for x in WAY_ORDER_A] == [D('20599.26'), D('34701.06'), D('38849.97')]   # A1, the key's
    assert [show(a['rise_upkeep_only'][x]) for x in ('buy', 'lease')] == [D('31081.86'), D('35230.77')]
    assert a['rise_upkeep_only']['lease'] == F('35230.765')  # exactly half a cent: rounds up (R1)
    assert [show(x) for x in buy_way(SEDAN, SEDAN_WHATIF, rise_on='all')['running_years']][3] == D('4758.33')
    assert buy_way(SEDAN, SEDAN_WHATIF, rise_on='all')['running_years'][3] == F('4758.325')
    assert lease_way(SEDAN, SEDAN_WHATIF, rise_on='all')['running_years'][3] == F('4558.675')
    assert a['lease_old_running'] == 35440 and a['lease_equity_not_credited'] == 47065
    assert a['keep_owed_end_ignored'] == k['cost']
    tc = buy_way(SEDAN, SEDAN_WHATIF, taxable_price=32000 - 18000)
    assert tc['financed'] == 18120 and show(tc['payment']) == D('358.80') and show(a['buy_tax_after_trade_in_credit']) == D('29039.50')
    assert show_rate(r['whatif']['new_car_loss_at_end']) == D('0.582395')
    r1 = vehicles_case({'cars': [SEDAN], 'whatif': dict(SEDAN_WHATIF, years=1)})                       # veh-0002
    k1 = r1['whatif']['ways']['keep']
    assert k1['paid'] == 8100 and show(k1['back']) == D('13787.38') and show(k1['cost']) == D('-5687.38')
    assert r1['whatif']['alt']['keep_owed_end_ignored'] == -7740
    n += 31
    assert r['whatif']['alt']['cheapest_lowest'] == 'keep'
    # D1 (fourth revision, veh-0025): the sedan's what-if with the new mpg and the new upkeep blank: 32 mpg (fuel 12,000 /
    # 32 x 3.50 = 1,312.50) and 500; the contrast A3 keeps the sedan's 1,400 and 800.
    rd = vehicles_case({'cars': [SEDAN], 'whatif': dict(SEDAN_WHATIF, new_mpg='', new_maintenance='')})['whatif']
    bd, ld = rd['ways']['buy'], rd['ways']['lease']
    assert bd['running_years'] == [F('3887.50')] * 5 and bd['running'] == F('19437.50') and show(bd['cost']) == D('32312.83')
    assert ld['running'] == F('18187.50') and ld['cost'] == F('36127.50') and rd['cheapest'] == 'keep'
    assert show(rd['alt']['blank_keeps_old']['buy']) == D('34250.33') and rd['alt']['blank_keeps_old']['lease'] == 37315
    # A7 (veh-0027 and -0028): the sedan without its loan worth 40,000, against a 24,000 car at 6% (25,440): cash back
    # 40,000 + 3,000 - 25,440 = 17,560 with 3,000 down, 14,560 with none; paid 3,315 either way.
    for down, back in ((3000, 17560), (0, 14560)):
        ra = vehicles_case({'cars': [dict({k: v for k, v in SEDAN.items() if not k.startswith('loan')}, value=40000)],
                            'whatif': dict(SEDAN_WHATIF, new_price=24000, new_sales_tax='0.06', cash_down=down)})['whatif']
        ba = ra['ways']['buy']
        assert ba['cash_back'] == back and ba['financed'] == 0 and ba['payment'] == 0 and ba['paid'] == 3315
        assert ba['back'] == F('10022.52') and ba['cost'] == F('-6707.52') and ra['cheapest'] == 'buy'
        assert show(ra['ways']['keep']['cost']) == D('-725.20') and ra['ways']['lease']['cost'] == 7065
    # A9 (veh-0032): a 5,000 wagon kept one year costs 300.00; a 15,000 car at 0% over 12 months 299.60: 0.40 lower, not
    # more than $1, so keep stays the cheapest (the lowest is buy).
    r9 = vehicles_case({'cars': [WAGON], 'whatif': WAGON_WHATIF})['whatif']
    assert r9['ways']['keep']['cost'] == 300 and r9['ways']['buy']['cost'] == F('299.60') and r9['ways']['lease']['cost'] == F('5624.80')
    assert r9['cheapest'] == 'keep' and r9['alt']['cheapest_lowest'] == 'buy'
    n += 12
    # E1 (corrected after the fourth revision's comparison, veh-0007): Ana's hatchback (electric, carrying a 3.50 fuel
    # price) over 6 years against the sedan's what-if with the new mpg blank: the new car is charged like the hatchback,
    # 8,000 x 0.30 x 0.16 = 384 a year, so buy runs 6 x (384 + 1,625 + 250 + 300) = 15,354 and lease 6 x (384 + 1,625 +
    # 250 + 150) = 14,454; the contrast (32 mpg at 3.50, 875 a year) 18,300 and 17,400.
    re1 = vehicles_case({'cars': [dict(EV, fuel_price='3.50'), SEDAN], 'whatif': dict(SEDAN_WHATIF, new_mpg='', years=6)})['whatif']
    be, le = re1['ways']['buy'], re1['ways']['lease']
    assert be['running'] == 15354 and show(be['cost']) == D('18353.11') and le['running'] == 14454 and le['cost'] == 25182
    assert show(re1['alt']['electric_new_at_32_mpg']['buy']) == D('21299.11') and re1['alt']['electric_new_at_32_mpg']['lease'] == 28128
    assert re1['cheapest'] == 'keep' and show(re1['ways']['keep']['cost']) == D('3701.79')
    assert re1['alt']['blank_keeps_old'] == {'buy': be['cost'], 'lease': le['cost']}     # A3 equals E1 here (upkeep typed)
    n += 5
    # 8.2 Ben's sofa: save up over 7 months (W2, P1), or 0% for 12 months then 24.99% over 24; goals give way.
    r = big_purchase_case(SOFA, SOFA_INPUTS)
    assert r['total'] == 3180 and (r['months'], r['months_w1'], r['months_w3']) == (7, 8, 8)
    sv = r['save']
    assert show(sv['monthly']) == D('304.99') and show(sv['earned']) == D('45.04')
    assert show(r['alt_w1']['monthly']) == D('266.00') and show(r['alt_w1']['earned']) == D('51.97') and r['alt_w1']['months'] == 8
    gw = sv['give_way']
    assert show(gw['need']) == D('224.99') and gw['shortfall'] == 0 and not gw['more_than_you_have']
    hol, car, top = gw['goals']
    assert (hol['name'], hol['gives'], hol['paused'], hol['old_months'], hol['new_months']) == ('Holiday', 150, True, 11, None)
    assert hol['old_arrival'] == date(2027, 9, 30) and hol['on_time_old'] is True and hol['growth_only_months'] == 484
    assert car['name'] == 'Car fund' and show(car['gives']) == D('74.99') and show(car['monthly_new']) == D('125.01')
    assert (car['old_months'], car['new_months'], car['delay_months']) == (35, 52, 17)
    assert show(savings_after(2500, car['monthly_new'], '0.04', 51)) == D('9899.08')
    assert show(savings_after(2500, car['monthly_new'], '0.04', 52)) == D('10057.08')
    assert car['new_arrival'] == date(2031, 2, 28) and car['on_time_old'] is True and car['on_time_new'] is False
    assert top['gives'] == 0 and top['old_months'] == 20 and top['new_months'] == 20
    assert [x['gives'] for x in sv['give_way_done_gives']['goals']] == [x['gives'] for x in gw['goals']]   # no goal is done
    fn = r['finance']
    assert r['amount'] == 2180 and show(fn['payment']) == D('96.79') and show(fn['interest']) == D('143.07')
    assert show(fn['balance_after_promo']) == D('1018.47') and show(fn['deferred_interest_if_not_paid']) == D('411.74')
    g2 = fn['give_way']
    assert show(g2['need']) == D('16.79') and show(g2['goals'][0]['gives']) == D('16.79')
    assert g2['goals'][0]['old_months'] == 11 and g2['goals'][0]['new_months'] == 12 and g2['goals'][0]['new_arrival'] == date(2027, 10, 31)
    assert g2['goals'][1]['gives'] == 0
    assert r['cash'] == {'after': F(3820), 'fits': True, 'alt_fits_keeps_emergency_target': False}          # P3
    r3 = big_purchase_case(dict(SOFA, set_aside=4000), SOFA_INPUTS)                                # B8: more set aside than the total
    assert r3['save']['monthly'] == 0 and r3['save']['earned'] == 0 and r3['amount'] == 0
    plain = promo_payment(2180, '0.2499', 24, 0)
    assert show(plain) == D('116.34') and show(plain * 24 - 2180) == D('612.14') and show(promo_payment(2180, '0.2499', 24, 24)) == D('90.83')
    # P2: a goal already done (Gift fund, 1,500 set aside of 1,000) is skipped; the Car fund gives instead (pur-0020).
    done = [{'name': 'Gift fund', 'priority': 3, 'due': '2027-06-30', 'target': 1000, 'set_aside': 1500, 'monthly': 50,
             'growth': '0.01'}, dict(SOFA_GOALS[1])]
    rd = big_purchase_case(dict(SOFA, goals=done), SOFA_INPUTS)
    gs, ga = rd['save']['give_way'], rd['save']['give_way_done_gives']
    assert gs['goals'][0]['gives'] == 0 and gs['goals'][0]['skipped_done'] and gs['goals'][1]['gives'] == 200
    assert gs['goals'][1]['paused'] and show(gs['shortfall']) == D('24.99') and gs['more_than_you_have']
    assert ga['goals'][0]['gives'] == 50 and ga['goals'][0]['paused'] and show(ga['goals'][1]['gives']) == D('174.99') and ga['shortfall'] == 0
    gf = rd['finance']['give_way']
    assert gf['goals'][0]['gives'] == 0 and show(gf['goals'][1]['gives']) == D('16.79') and gf['goals'][1]['new_months'] == 37
    assert show(rd['finance']['give_way_done_gives']['goals'][0]['gives']) == D('16.79')
    n += 26
    # B5 (fourth revision, pur-0033): the sofa with spare -150, counted as 0: save up needs the whole 304.99 (Holiday
    # 150, paused; Car fund 154.99 -> 45.01 a month, 116 months); finance 96.79 (Holiday -> 53.21 a month, 29 months). The
    # earlier literal reading: 454.99 (every goal gives all, 4.99 more than you have) and 246.79.
    rb = big_purchase_case(SOFA, dict(SOFA_INPUTS, spare=-150))
    gb, gl = rb['save']['give_way'], rb['save']['give_way_spare_literal']
    assert show(gb['need']) == D('304.99') and gb['shortfall'] == 0 and [show(x['gives']) for x in gb['goals']] == [D('150.00'), D('154.99'), D('0.00')]
    assert gb['goals'][0]['paused'] and show(gb['goals'][1]['monthly_new']) == D('45.01') and gb['goals'][1]['new_months'] == 116
    assert show(gl['need']) == D('454.99') and show(gl['shortfall']) == D('4.99') and [x['gives'] for x in gl['goals']] == [150, 200, 100]
    fb, fl = rb['finance']['give_way'], rb['finance']['give_way_spare_literal']
    assert show(fb['need']) == D('96.79') and show(fb['goals'][0]['monthly_new']) == D('53.21') and fb['goals'][0]['new_months'] == 29
    assert show(fl['need']) == D('246.79') and fl['goals'][0]['gives'] == 150 and show(fl['goals'][1]['gives']) == D('96.79')
    rc = big_purchase_case(dict(SOFA, set_aside=4000), dict(SOFA_INPUTS, spare=-150))          # pur-0034: nothing needed
    assert rc['save']['give_way']['need'] == rc['finance']['give_way']['need'] == 0
    assert rc['save']['give_way_spare_literal']['need'] == rc['finance']['give_way_spare_literal']['need'] == 150
    n += 7
    # 8.3 Cy and Dee's kitchen: cash, line, refinance, personal loan at a 5% plan return.
    r = renovation_case(KITCHEN, KITCHEN_INPUTS)
    assert r['value_added'] == 21000 and r['equity_change'] == -9000
    c, ln, rf, pl = (r['ways'][x] for x in WAY_ORDER_C)
    assert c['fits'] and c['cushion'] == 10000 and c['cushion_months'] == F(5, 2) and c['todays_money'] == 0
    assert ln['borrowable'] == 58000 and ln['fits'] and show(ln['payment']) == D('363.98') and show(ln['interest']) == D('13677.93')
    assert show(ln['pv_payments']) == D('34316.79') and show(ln['todays_money_before_tax']) == D('4316.79')
    assert ln['law_share'] == 1 and show(ln['tax_saved']) == D('3282.70') and ln['alt_tax_saved_no_limit'] == ln['tax_saved']   # R1
    assert show(ln['pv_interest']) == D('11511.44') and show(ln['pv_tax_saved']) == D('2762.74')
    assert show(ln['todays_money']) == D('1554.04') and show_rate(ln['cltv_after']) == D('0.776316')                         # R2
    assert rf['new_loan'] == 303850 and rf['closing_costs'] == 8850 and show(rf['payment']) == D('1870.86')   # C1
    assert rf['old_months_left'] == 266 and show(rf['old_interest']) == D('115861.11') and show(rf['pv_old']) == D('230312.77')
    assert show(rf['payment_change']) == D('433.86') and show(rf['new_interest']) == D('369658.42')
    assert show(rf['extra_interest']) == D('253797.31')
    assert rf['law_share'] == F(100, 103) and rf['old_law_share'] == 1 and show(rf['tax_saved']) == D('58327.33')            # R1
    assert show(rf['alt_tax_saved_extra_interest']) == D('60911.35') and show(rf['tax_saved_whole_new_interest']) == D('88718.02')
    assert show(rf['pv_new']) == D('348506.21') and show(rf['todays_money_before_tax']) == D('88193.44')
    assert show(rf['pv_interest_new']) == D('223281.07') and show(rf['pv_interest_old']) == D('80936.87')
    assert show(rf['pv_tax_saved']) == D('32601.81') and show(rf['todays_money']) == D('55591.64')                            # R2
    assert show_rate(rf['ltv_after']) == D('0.799605') and not rf['above_fha_cash_out_limit'] and rf['fits']   # C4
    al = rf['alt_cost_of_new_loan']
    assert show(al['new_loan']) == D('304123.71') and show(al['closing_costs']) == D('9123.71') and show(al['payment']) == D('1872.54')
    assert show(al['todays_money']) == D('55905.57') and show(al['todays_money_before_tax']) == D('88507.38')
    assert show_rate(al['ltv_after']) == D('0.800326')
    assert show(pl['payment']) == D('667.33') and show(pl['interest']) == D('10040.01') and show(pl['todays_money']) == D('5362.47')
    assert r['ranking'] == ['cash', 'line', 'loan', 'refi'] and r['best'] == 'cash'
    assert r['alt_ranking_lowest_first'] == r['alt_ranking_before_tax'] == r['ranking'] and r['alt_ranking_refi_no_mortgage'] is None
    r2 = renovation_case(KITCHEN, dict(KITCHEN_INPUTS, usable_cash=25000, itemizes='no'))
    assert r2['ranking'] == ['line', 'loan', 'refi'] and r2['ways']['line']['tax_saved'] == 0 and r2['ways']['cash']['cushion'] == -5000
    assert r2['ways']['line']['todays_money'] == r2['ways']['line']['todays_money_before_tax']       # no itemizing, no tax
    r4 = renovation_case(dict(KITCHEN, home_value=330000), KITCHEN_INPUTS)                          # 295,000 x 1.03 > 80% of 330,000
    assert r4['ways']['line']['borrowable'] == 15500 and not r4['ways']['line']['fits'] and not r4['ways']['refi']['fits']
    assert r4['ranking'] == ['cash', 'loan']
    r5 = renovation_case(dict(KITCHEN, home_value=300000), KITCHEN_INPUTS)                          # 300,000 x 85% < 265,000
    assert r5['ways']['line']['borrowable'] == 0
    # R3: the kitchen on a home with no mortgage: no refinance way; the key's first reading is the contrast.
    r6 = renovation_case(dict(KITCHEN, mortgage_balance='', mortgage_rate='', mortgage_payment=''), KITCHEN_INPUTS)
    assert 'refi' not in r6['ways'] and r6['ways']['line']['borrowable'] == 323000 and r6['ranking'] == ['cash', 'line', 'loan']
    nm = r6['alt_refi_no_mortgage']
    assert nm['new_loan'] == 30900 and show(nm['payment']) == D('190.26') and show(nm['todays_money']) == D('150.46') and nm['fits']
    assert r6['alt_ranking_refi_no_mortgage'] == ['cash', 'refi', 'line', 'loan']
    # R5: the line 0.87 below cash (ren-0014): cash stays best; sorted plainly the line would be first.
    r7 = renovation_case(dict(KITCHEN, cost=2000, recoup='1.5'), dict(KITCHEN_INPUTS, blended_return='0.0801', itemizes='no'))
    assert show(r7['ways']['line']['todays_money']) == D('-0.87') and r7['best'] == 'cash'
    assert r7['ranking'] == ['cash', 'line', 'loan', 'refi'] and r7['alt_ranking_lowest_first'] == ['line', 'cash', 'loan', 'refi']
    n += 33
    # L1 (fourth revision; ren-0008, RULES.md 5.5): M 900,000 at 4% paying 5,000, C 120,000, L 750,000, top 24%. The
    # line's interest 54,711.74 x 750/1,020 less the mortgage's 305,500.39 over the line's 120 months x (750/900 -
    # 750/1,020), x 0.24 = 2,466.77 (R1: 9,655.01); today's money 14,878.56 (R1: 9,141.43).
    r8 = renovation_case(dict(KITCHEN, cost=120000, home_value=1400000, mortgage_balance=900000, mortgage_rate='0.04',
                              mortgage_payment=5000), dict(KITCHEN_INPUTS, usable_cash=150000))
    l8 = r8['ways']['line']
    assert show(l8['interest']) == D('54711.74') and show(l8['mortgage_interest_in_term']) == D('305500.39')
    assert show(l8['tax_saved']) == D('2466.77') and show(l8['alt_tax_saved_r1']) == D('9655.01')
    assert show(l8['todays_money']) == D('14878.56') and show(l8['alt_todays_money_r1']) == D('9141.43')
    assert r8['ranking'] == r8['alt_ranking_line_r1'] == ['cash', 'line', 'loan', 'refi']
    # D1 (ren-0016): the kitchen with the refinance rate blank: 6.5% over the typed 30 years, payment 1,920.54; the
    # earlier reading (no refinance unless rate and years are typed) ranks cash, line, loan.
    rr = renovation_case(dict(KITCHEN, refi_rate=''), KITCHEN_INPUTS)
    f6 = rr['ways']['refi']
    assert f6['new_loan'] == 303850 and show(f6['payment']) == D('1920.54') and f6['months'] == 360 and f6['fits']
    assert show(f6['tax_saved']) == D('62494.83') and show(f6['todays_money_before_tax']) == D('97448.28')
    assert show(f6['todays_money']) == D('62438.67')
    assert rr['ranking'] == ['cash', 'line', 'loan', 'refi'] and rr['alt_ranking_blank_refi_not_offered'] == ['cash', 'line', 'loan']
    n += 8
    return n


CHECKS = check_rules()

if __name__ == '__main__':
    print('rules.py: %d self-checks passed (sources read %s)' % (CHECKS, READ_ON))
