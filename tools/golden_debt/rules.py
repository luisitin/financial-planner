"""Rules for the debt answer key (pay off debts, credit cards, mortgage), as data plus small pure functions.

Written from the primary sources below, never from the app's code. Nobody opened modules/, core/ or
tests/*.test.mjs while writing this file, and it never imports or runs the app. Only the layout and
conventions of tools/golden_student_loans/ and tools/golden_paycheck/ were looked at; no figure or code
is shared with them. (On 2026-10-31 a verifier, who had read the pages' code and READMEs to decide which side
of each disagreement was wrong, changed two rules here: the balance-transfer payment when no required payment
is set, and the tie-break wording. No figure was taken from the app; each change follows the page README's text
or says that no source decides. See tests/golden/debt/RULES.md section 5.) Every figure names its source and the date it was read on the same line. Money is
Decimal; a rate is a Decimal fraction ("0.18" = 18% a year). Importing this file runs check_tables().

Calculators covered (the page READMEs are the spec; where a source says otherwise the key follows the
source and says so in tests/golden/debt/RULES.md):
  PLAN      Pay off debts: interest at APR / 12 on each month's opening balance, every debt gets its
            required payment, the rest of a fixed budget (sum of required payments + extra) goes to the
            target debts in order. Avalanche = highest rate first, snowball = smallest balance first.
            Baseline = required payments only, nothing rolls over. "Plus 100" = extra + 100.
  CARD      Credit card: payoff at the card's required payment (a fixed dollar amount), or, when none is
            set, at max(2% of the balance, $25) recomputed every month from the statement balance (as
            Regulation Z appendix M1/M2 compute a minimum payment estimate). Balance transfer.
  MORTGAGE  Months left (nper), interest to come, extra each month, every two weeks (payment x 13/12 each
            month), recast, months until the balance reaches 80% of the home's value.

Sources (all read 2026-10-31; sha256 of the copy read: first 8 ... last 10 hex digits):
  RZ7      12 CFR 1026.7(b)(12) Repayment disclosures, eCFR title 12 "up to date as of 2026-10-29"; text
           [76 FR 79772, Dec. 22, 2011, as amended at 81 FR 84369, Nov. 22, 2016]
           https://www.ecfr.gov/current/title-12/section-1026.7#p-1026.7(b)(12)   (XML sha256 cec7f74c...b68e7bce8d)
  RZM1     12 CFR part 1026, Appendix M1 "Repayment Disclosures", same eCFR edition
           https://www.ecfr.gov/current/title-12/part-1026/appendix-Appendix%20M1%20to%20Part%201026   (XML sha256 adcbde9e...21a08ce7b6)
  RZM2     12 CFR part 1026, Appendix M2 "Sample Calculations of Repayment Disclosures" (SAS code), same edition
           https://www.ecfr.gov/current/title-12/part-1026/appendix-Appendix%20M2%20to%20Part%201026   (XML sha256 5e9a20e3...5aa1a5f0e8)
  RZSUP    12 CFR part 1026, Supplement I (Official Interpretations), comments 7(b)(12)-1, 7(b)(12)(i)(F)-1,
           7(b)(12)(v)-1, same edition  https://www.ecfr.gov/current/title-12/part-1026/appendix-Supplement%20I%20to%20Part%201026
           (XML sha256 3419816d...e630f4dd0a)
  RZ53     12 CFR 1026.53(a) Allocation of payments, same edition
           https://www.ecfr.gov/current/title-12/section-1026.53   (XML sha256 b726fd01...2e17a13a82)
  RZ55     12 CFR 1026.55(b)(1) Temporary rate exception, same edition; text [76 FR 79772, as amended at 86 FR 69782; 88 FR 30622]
           https://www.ecfr.gov/current/title-12/section-1026.55   (XML sha256 0b755fb5...e64ff3d0b6)
  RZ36     12 CFR 1026.36(c)(1) Payment processing (mortgage servicers), same edition
           https://www.ecfr.gov/current/title-12/section-1026.36   (XML sha256 4aa8aa1f...642a107187)
  HPA1     12 U.S.C. 4901 (Homeowners Protection Act of 1998, s.2), OLRC edition "in effect through Public Law
           119-136 (October 22, 2026)"  https://uscode.house.gov/us/usc/119-136/t12/s4901/   (sha256 3909f9f5...1e0b788177)
  HPA2     12 U.S.C. 4902 (HPA s.3), same edition  https://uscode.house.gov/us/usc/119-136/t12/s4902/   (sha256 6fd33d9c...ee09c3cda1)
  FNMASVC  Fannie Mae Servicing Guide B-8.1-04 "Termination of Conventional Mortgage Insurance" (05/15/2019; guide
           PDF "Published: October 14 2026")  https://servicing-guide.fanniemae.com/svc/b-8.1-04/termination-conventional-mortgage-insurance
           (sha256 44a9bd6a...b026c4b8ae)
  FNMASEL  Fannie Mae Selling Guide B7-1-01 "Provision of Mortgage Insurance" (04/02/2025) and B7-1-02 "Mortgage
           Insurance Coverage Requirements" (08/07/2019), guide "Published: October 07 2026"; neither covers removal
           https://selling-guide.fanniemae.com/sel/b7-1-01/provision-mortgage-insurance   (sha256 6e547ec1...b64f79ffec)
  CFPBPMI  CFPB, "When can I remove private mortgage insurance (PMI) from my loan?" (page last modified Aug. 31, 2026)
           https://www.consumerfinance.gov/ask-cfpb/when-can-i-remove-private-mortgage-insurance-pmi-from-my-loan-en-202/   (sha256 fec87aef...59f73468ae)
  CFPBB15  CFPB Bulletin 2015-03 (Aug. 4, 2015), "Private Mortgage Insurance Cancellation and Termination"
           https://files.consumerfinance.gov/f/201508_cfpb_compliance-bulletin_private-mortgage-insurance-cancellation-and-termination.pdf   (sha256 80bd2b85...f8844390d5)
  CFPBRD   CFPB blog "How to reduce your debt" (Jul. 16, 2019; page last modified Jun. 25, 2026)
           https://www.consumerfinance.gov/archive/blog/how-reduce-your-debt/   (sha256 4f7ee163...6a71b0a14d)
  CFPBWS   CFPB "Your Money, Your Goals" toolkit, Module 6, Tool 3 "Reducing debt worksheet" (PDF dated Oct. 30, 2017), pp.211-212
           https://files.consumerfinance.gov/f/documents/cfpb_ymyg-toolkit_reducing-debt-worksheet.pdf   (sha256 a59e067e...a369e15009)
  CFPBNY   CFPB blog "Resolve to take control of your debt in the new year" (Dec. 27, 2018)
           https://www.consumerfinance.gov/archive/blog/resolve-take-control-your-debt-new-year/   (sha256 27fa23e5...1467be662b)
  CFPBKT   CFPB "Mortgage key terms", entry "Bi-weekly payment" (page last modified Dec. 28, 2022)
           https://www.consumerfinance.gov/consumer-tools/mortgages/answers/key-terms/   (sha256 a5d41c23...f2150488f0)
  CFPBPM   CFPB press release, Paymap / LoanCare "Equity Accelerator" action (Jul. 28, 2015)
           https://www.consumerfinance.gov/archive/newsroom/cfpb-takes-action-against-mortgage-payment-company-and-servicer-for-deceptive-ads/   (sha256 b20c8f25...7481b0c7d6)
  CFPBNW   CFPB press release, Nationwide Biweekly suit (May 11, 2015)
           https://www.consumerfinance.gov/archive/newsroom/cfpb-files-suit-against-nationwide-biweekly-for-luring-consumers-with-false-promises-of-mortgage-savings/   (sha256 e0e5784b...d474bc9c98)
  CFPBBT   CFPB "What is a balance transfer fee? ..." (last reviewed Sep. 23, 2024)
           https://www.consumerfinance.gov/ask-cfpb/what-is-a-balance-transfer-fee-can-a-balance-transfer-fee-be-charged-on-a-zero-percent-interest-rate-offer-en-53/   (sha256 e815f822...a0cbd6f966)
  CFPBCT   CFPB "Credit cards key terms", entry "Balance transfer" (page last modified Dec. 28, 2022)
           https://www.consumerfinance.gov/consumer-tools/credit-cards/answers/key-terms/   (sha256 5ea0f705...1827598b57)

NOT VERIFIED on any official source (so the key states its own convention and says so):
  - The page's default minimum "2% of the balance, $25 floor" is the page's own assumption. No law sets a
    minimum payment formula; RZM1 (b)(1) says the issuer must use "the minimum payment formula(s) that apply
    to a cardholder's account". RZM1 and RZM2 use "2 percent of the outstanding balance or $20" only as an
    example. What real issuers charge was not checked.
  - Monthly interest at APR / 12. Real cards use a daily rate on an average daily balance; RZM1 (b)(4)(vi)-(vii)
    lets an issuer assume equal months, and RZM2 computes (APR / 365) x (365 / 12) = APR / 12. For mortgages
    no source read here fixes the monthly method; the key uses APR / 12 as the page does.
  - Rounding. RZM1 (b)(4)(xi) only says monthly amounts "may be rounded to the nearest cent". The key's main
    track keeps full precision (60 significant digits) and rounds outputs half up to the cent at the end; a
    second track rounds every payment and interest charge to the cent each month, as RZM2's SAS round()
    does. That SAS round() sends halves away from zero is from SAS's own documentation, not read for this key.
  - Tie-breaks in avalanche / snowball, and whether the snowball order is fixed at the start or re-sorted
    each month: no source decides (see order_debts(); the payoff page breaks a tie by the debt's name, the
    key's figures by input order, and both are valid).
  - The balance-transfer payment with no required payment set: no source sets a floor for this comparison.
    The key pays B / P, as the page README's max(required, B / P) reads with nothing set; the page's usual
    2% / $25 minimum as a floor is written as a contrast (see balance_transfer()).
  - How a servicer applies half-payments every two weeks, and how a recast is priced: no rule found beyond
    RZ36 (c)(1); the key follows the page's own model and says so.
"""
import sys
sys.dont_write_bytecode = True  # keep the repo free of __pycache__

from decimal import Decimal as D, ROUND_HALF_UP, ROUND_FLOOR, Context, localcontext
from fractions import Fraction as F

READ_ON = '2026-10-31'  # every source above was read on this date
CTX = Context(prec=60)  # 60 significant digits: far below a cent on any balance this key handles
DUST = D('1e-30')       # a full-precision balance at or below this is zero (only arithmetic noise is that small)
CENT = D('0.01')
MAX_MONTHS = 6000       # 500 years; a schedule still open here is a generator bug, not a "never"

# ---- Calendar ----------------------------------------------------------------------------------------
MONTHS_PER_YEAR = 12  # page README: "annual rate / 12"; RZM2 "days = 365/12" and "perrate = (apr/365) * days" = apr / 12; read 2026-10-31

# ---- Credit cards: Regulation Z ------------------------------------------------------------------------
PAGE_MIN_PCT = D('0.02')     # page README "2% of the balance" (the page's own default; NOT a legal figure); read 2026-10-31
PAGE_MIN_FLOOR = D('25')     # page README "$25 floor" (the page's own default; NOT a legal figure); read 2026-10-31
REGZ_EXAMPLE_PCT = D('0.02')  # RZM1 (b)(1) and RZM2 example: "2 percent of the outstanding balance or $20, whichever is greater"; read 2026-10-31
REGZ_EXAMPLE_FLOOR = D('20')  # RZM2 "dollar minimum payment; dmin = 20"; read 2026-10-31
REGZ_MONTHS_BELOW = 24        # RZ7 (b)(12)(i)(B) "If the minimum payment repayment estimate is less than 2 years ... disclose the estimate in months. Otherwise ... in years and rounded to the nearest whole year"; read 2026-10-31
REGZ_TOLERANCE_MONTHS = 2     # RZM1 (b)(5) "accurate if it is not more than 2 months above or below"; read 2026-10-31
REGZ_36 = 36                  # RZ7 (b)(12)(i)(F)(1)(i) "estimated monthly payment for repayment in 36 months"; RZM1 (d)(1); read 2026-10-31
REGZ_36_TOLERANCE = D('0.10')  # RZM1 (d)(4) "not more than 10 percent above or below"; read 2026-10-31
REGZ_PROMO_MIN_MONTHS = 6     # RZ55 (b)(1) "upon the expiration of a specified period of six months or longer"; read 2026-10-31
# RZM1 (b)(4): (i) "Only minimum monthly payments are made each month"; (ii) "No additional extensions of credit
# ... fees, charges"; (iii) the APR "will not change"; (iv) "There is no grace period"; (v) "The final payment
# pays the account in full"; (viii) "Payments are credited either on the last day of the month or the last day
# of the billing cycle"; (xi) amounts "may be rounded to the nearest cent". RZM1 (b)(3): the beginning balance is
# the balance "as of the closing date of the last billing cycle" and "may" be rounded to the whole dollar. Read 2026-10-31.
# RZ7 (b)(12)(ii): when "negative or no amortization occurs" the statement says "you will never pay off the balance
# ... because your payment will be less than the interest charged each month". Read 2026-10-31.

# ---- Mortgage insurance: Homeowners Protection Act and Fannie Mae ------------------------------------
HPA_CANCEL_LTV = D('0.80')     # HPA1 4901(2)(A): balance "first scheduled to reach 80 percent of the original value" (initial schedule) or "based solely on actual payments, reaches 80 percent"; HPA2 4902(a) on written request; read 2026-10-31
HPA_TERMINATE_LTV = D('0.78')  # HPA1 4901(18)(A) "first scheduled to reach 78 percent of the original value" (initial amortization schedule, "irrespective of the outstanding balance"); HPA2 4902(b); read 2026-10-31
HPA_HIGH_RISK_LTV = D('0.77')  # HPA2 4902(g)(1)(B)(i) high-risk non-conforming loans: "first scheduled to reach 77 percent of the original value"; read 2026-10-31
HPA_MIDPOINT_FRACTION = F(1, 2)  # HPA1 4901(7) "halfway through the period"; HPA2 4902(c) not "beyond the first day of the month immediately following the date that is the midpoint"; read 2026-10-31
HPA_FIRST_LOAN_DATE = '1999-07-29'  # HPA1 4901(15) consummated "on or after the date that is 1 year after July 29, 1998"; CFPBPMI "closed on or after July 29, 1999"; read 2026-10-31
HPA_NO_PAYMENTS_AFTER_DAYS = 30  # HPA2 4902(e) no premiums "more than 30 days after" cancellation / termination; read 2026-10-31
HPA_REFUND_DAYS = 45             # HPA2 4902(f)(1) unearned premiums returned "Not later than 45 days"; read 2026-10-31
# HPA1 4901(12) "original value": "the lesser of the sales price ... or the appraised value at the time" (refinance:
# "only the appraised value relied upon by the mortgagee"). HPA1 4901(13): private MI excludes National Housing Act
# (FHA), title 38 (VA) and Housing Act of 1949 title V insurance. HPA1 4901(14): single-family principal residence.
# HPA2 4902(a)(1)-(4): written request, good payment history, current, value not below original value, no
# subordinate lien. HPA1 4901(4): no payment 60+ days late in the 12 months starting 24 months before, none 30+
# days late in the 12 months before. CFPBB15: "a borrower cannot advance the 'termination date' by making
# additional payments". Read 2026-10-31.
FNMA_CURRENT_VALUE_LTV = (  # FNMASVC "Based on Current Value", one-unit principal residence or second home; read 2026-10-31
    (24, 60, D('0.75')),    # "75% or less, if the seasoning of the mortgage loan is between two and five years."
    (60, None, D('0.80')),  # "80% or less, if the seasoning of the mortgage loan is greater than five years."
)
FNMA_IMPROVEMENTS_LTV = D('0.80')  # FNMASVC "If ... two-year seasoning requirement is waived because the property improvements ... the LTV ratio must be 80% or less"; read 2026-10-31
FNMA_MULTI_UNIT_LTV = D('0.70')    # FNMASVC investment or 2-4 unit principal residence: "70% or less and the seasoning ... greater than two years"; read 2026-10-31
FNMA_ORIGINAL_VALUE_LTV = D('0.80')  # FNMASVC original value, one-unit principal / second home: "first scheduled to reach 80% (or actually reaches 80%) of the original value"; read 2026-10-31
FNMA_AUTO_LTV = D('0.78')            # FNMASVC automatic: "first scheduled to reach 78% of the original value", or the mid-point; read 2026-10-31

# ---- Biweekly ----------------------------------------------------------------------------------------
BIWEEKLY_PAYMENTS_PER_YEAR = 26   # CFPBKT "collecting half of your monthly payment every two weeks, resulting in 26 payments over the course of the year (totaling one extra monthly payment per year)"; read 2026-10-31
BIWEEKLY_MONTHLY_FACTOR = F(13, 12)  # page README "payment x 13/12 each month" = 26 x 1/2 / 12; matches CFPBKT's "one extra monthly payment per year"; read 2026-10-31
# CFPBPM: Paymap "holds the collected payments in custodial accounts, and then pays consumers' mortgages on their
# original monthly schedule". RZ36 (c)(1)(ii): a servicer may hold a payment smaller than a periodic payment in a
# suspense account and must treat it as a periodic payment once enough accumulates. Read 2026-10-31.


# =========================================================================================================
# Small helpers
# =========================================================================================================
def _d(x):
    """Decimal from int, str, Decimal, Fraction or float (a float goes through repr, so 0.1 -> Decimal('0.1'))."""
    if isinstance(x, D):
        return x
    if isinstance(x, F):
        with localcontext(CTX):
            return D(x.numerator) / D(x.denominator)
    if isinstance(x, float):
        return D(repr(x))
    return D(x)


def cents(x):
    """Round to the cent, half up (the key's convention; RZM1 (b)(4)(xi) only says 'may be rounded')."""
    return _d(x).quantize(CENT, rounding=ROUND_HALF_UP)


def monthly_rate(apr):
    """APR / 12 (page README; RZM2 (apr/365) x (365/12))."""
    with localcontext(CTX):
        return _d(apr) / MONTHS_PER_YEAR


def _interest(balance, r, round_cents):
    with localcontext(CTX):
        i = balance * r
    return cents(i) if round_cents else i


def _whole_months(n):
    """Whole months for a fractional nper: a part month is one more payment (RZM2 counts every payment)."""
    f = n.to_integral_value(rounding=ROUND_FLOOR)
    return int(f) if n - f <= D('1e-20') else int(f) + 1


# =========================================================================================================
# Annuity: level payment, nper, balance after k payments (closed forms)
# =========================================================================================================
def level_payment(balance, apr, months):
    """Unrounded level payment that repays `balance` in `months` equal payments: B r / (1 - (1 + r)^-n), r = APR / 12.

    r = 0 gives B / n. This is the ordinary annuity; RZM2 computes its 36-month payment the same way
    ("pvaf = (1-(1 + perrate36) ** -dmonths)/perrate36; pmt01 = round(tbal/pvaf,0.01)").
    """
    balance = _d(balance)
    if balance <= 0:
        return D(0)
    with localcontext(CTX):
        r = monthly_rate(apr)
        if r == 0:
            return balance / months
        return balance * r / (1 - (1 + r) ** -months)


def level_payment_exact(balance, apr, months):
    """The same annuity in exact rational arithmetic (a Fraction), used to check level_payment()."""
    b, r = F(str(balance)), F(str(apr)) / MONTHS_PER_YEAR
    if b <= 0:
        return F(0)
    if r == 0:
        return b / months
    g = (1 + r) ** months
    return b * r * g / (g - 1)


def nper(balance, apr, payment):
    """Fractional number of months to repay `balance` at a fixed `payment` (closed form), or None for never.

    n = -ln(1 - r B / P) / ln(1 + r); r = 0 gives B / P. None when P <= r B: the payment does not cover the first
    month's interest ("negative or no amortization", RZ7 (b)(12)(ii)).
    """
    b, p = _d(balance), _d(payment)
    if b <= 0:
        return D(0)
    with localcontext(CTX):
        r = monthly_rate(apr)
        if r == 0:
            return b / p if p > 0 else None
        if p <= r * b:
            return None
        return -((1 - r * b / p).ln()) / (1 + r).ln()


def months_closed_form(balance, apr, payment):
    """Whole months (the last one may be a smaller payment) from nper(); None for never."""
    n = nper(balance, apr, payment)
    return None if n is None else _whole_months(n)


def last_month_fraction(balance, apr, payment):
    """Fractional part of nper(): the last payment as a share of a full one (None for never, 0 if exact).

    A generator should keep this between 0.01 and 0.99 except in labelled edge rows: near 0 the last payment
    is a few cents that a cent-rounded app may fold into the month before; near 1 a cent of rounding can add
    a month.
    """
    n = nper(balance, apr, payment)
    if n is None:
        return None
    with localcontext(CTX):
        return n - n.to_integral_value(rounding=ROUND_FLOOR)


def balance_after(balance, apr, payment, k):
    """Balance after k payments at a fixed payment (closed form): B (1+r)^k - P ((1+r)^k - 1) / r."""
    b, p = _d(balance), _d(payment)
    with localcontext(CTX):
        r = monthly_rate(apr)
        if r == 0:
            return b - p * k
        g = (1 + r) ** k
        return b * g - p * (g - 1) / r


def interest_closed_form(balance, apr, payment):
    """Total interest of a fixed-payment payoff (closed form), or None for never.

    With N = whole months, the first N-1 payments are P and the last pays what is left:
    total paid = (N-1) P + balance_after(N-1) (1 + r); interest = total paid - B.
    """
    n = months_closed_form(balance, apr, payment)
    if n is None:
        return None
    b, p = _d(balance), _d(payment)
    if n == 0:
        return D(0)
    with localcontext(CTX):
        r = monthly_rate(apr)
        last = balance_after(b, apr, p, n - 1) * (1 + r)
        return (n - 1) * p + last - b


def months_to_target_closed_form(balance, apr, payment, target):
    """Whole months until the balance after a payment is at or below `target` (closed form); None for never.

    Solves B_k <= T: k = ln((P - r T) / (P - r B)) / ln(1 + r), rounded up; r = 0: (B - T) / P rounded up.
    """
    b, p, t = _d(balance), _d(payment), _d(target)
    if b <= t:
        return 0
    with localcontext(CTX):
        r = monthly_rate(apr)
        if r == 0:
            return _whole_months((b - t) / p) if p > 0 else None
        if p <= r * b:
            return None
        if t <= 0:
            return months_closed_form(b, apr, p)
        return _whole_months(((p - r * t) / (p - r * b)).ln() / (1 + r).ln())


# =========================================================================================================
# One balance, stepped month by month (the amortization schedule)
# =========================================================================================================
def schedule(balance, apr, payment_rule, round_cents=False, max_months=MAX_MONTHS, stop_after=None,
             target=None, keep_rows=False):
    """Step one balance month by month.

    Each month: interest = r x opening balance (rounded to the cent on the cents track); the payment is
    payment_rule(opening balance) (a number or a function of the opening balance, as RZM2 computes its
    minimum from the balance before the month's interest); the payment goes to interest first, the rest to
    principal; if it is at least opening + interest it is the final payment and pays exactly what is left.
    A payment at or below the month's interest is "never" (RZ7 (b)(12)(ii) "negative or no amortization").

    stop_after: stop after this many months (balance-transfer promo window).
    target:     also report the first month whose closing balance is at or below `target` (mortgage insurance).
    Returns a dict: months (int, or None for never), interest, paid, final_payment, balance (closing),
    target_month, rows (opening, interest, payment, principal, closing) if keep_rows.
    """
    rule = payment_rule if callable(payment_rule) else (lambda _b, _p=_d(payment_rule): _p)
    b = _d(balance)
    r = monthly_rate(apr)
    tgt = None if target is None else _d(target)
    out = {'months': 0, 'interest': D(0), 'paid': D(0), 'final_payment': None, 'balance': b,
           'target_month': (0 if tgt is not None and b <= tgt else None), 'never': False, 'rows': []}
    m = 0
    with localcontext(CTX):
        while b > 0:
            if stop_after is not None and m >= stop_after:
                break
            if m >= max_months:
                raise RuntimeError('schedule still open after %d months' % max_months)
            m += 1
            i = _interest(b, r, round_cents)
            due = b + i
            pay = _d(rule(b))
            if round_cents:
                pay = cents(pay)
            if pay >= due - (0 if round_cents else DUST):
                pay = due
                closing = D(0)
                out['final_payment'] = pay
            elif pay <= i:
                out.update(months=None, never=True, interest=None, paid=None, balance=b)
                return out
            else:
                closing = due - pay
            out['interest'] += i
            out['paid'] += pay
            if keep_rows:  # interest is paid first, the rest of the payment is principal
                out['rows'].append((b, i, pay, pay - i, closing))
            b = closing
            if tgt is not None and out['target_month'] is None and b <= tgt:
                out['target_month'] = m
    out['months'] = m
    out['balance'] = b
    return out


def amortize(balance, apr, payment, round_cents=False, keep_rows=False):
    """Fixed-payment payoff: months, interest, total paid (or never)."""
    return schedule(balance, apr, payment, round_cents=round_cents, keep_rows=keep_rows)


# =========================================================================================================
# Credit card
# =========================================================================================================
def card_minimum(balance, pct=PAGE_MIN_PCT, floor=PAGE_MIN_FLOOR, round_cents=False):
    """Minimum payment from a 'pct of the balance or floor, whichever is greater' formula.

    The page's default is 2% / $25 (its own figures). RZM2 applies its 2% / $20 example to the balance at the
    start of each month: "pmt = round(pmin * tbal,0.01)" then "if pmt lt dmin then pmt = dmin".
    """
    with localcontext(CTX):
        p = _d(pct) * _d(balance)
    if round_cents:
        p = cents(p)
    return max(p, _d(floor))


def card_payoff(balance, apr, required=None, pct=PAGE_MIN_PCT, floor=PAGE_MIN_FLOOR, round_cents=False,
                frozen=False, keep_rows=False):
    """Minimum-payment payoff of a card.

    required set:  that fixed dollar amount every month (what the person says they pay; held level).
    required None: max(pct x balance, floor) recomputed EVERY month from that month's opening (statement)
                   balance, as RZM1 (b)(1) ("the minimum payment formula(s) that apply") and RZM2's loop do.
    frozen=True:   contrast only: the formula applied once to the starting balance and then held level.
    """
    if required is not None:
        return schedule(balance, apr, _d(required), round_cents=round_cents, keep_rows=keep_rows)
    if frozen:
        fixed = card_minimum(balance, pct, floor, round_cents)
        return schedule(balance, apr, fixed, round_cents=round_cents, keep_rows=keep_rows)
    return schedule(balance, apr, lambda b: card_minimum(b, pct, floor, round_cents),
                    round_cents=round_cents, keep_rows=keep_rows)


def regz_m2_single(balance, apr, pmin=REGZ_EXAMPLE_PCT, dmin=REGZ_EXAMPLE_FLOOR, max_months=MAX_MONTHS):
    """A line-by-line transliteration of RZM2's SAS minimum-payment loop for ONE balance at ONE APR.

    SAS: month = month + 1; pmt = round(pmin * tbal,0.01); if pmt lt dmin then pmt = dmin;
         xxxbal = round(cbal * (1 + perrate),0.01); fc = xxxbal - tbal;
         if pmt gt (tbal + fc) then pmt = round(cbal * (1 + perrate),0.01);
         cbal = xxxbal - pmt; sumpmts = sumpmts + pmt; tbal = cbal; if tbal gt 0 then go to eins.
    RZM2 has no stop for a payment below interest (it would loop forever); this copy returns None there.
    Used only to check card_payoff(..., round_cents=True). Returns (months, total paid, total interest).
    """
    with localcontext(CTX):
        perrate = monthly_rate(apr)  # RZM2: (apr/365) * (365/12)
        tbal = cbal = _d(balance)
        month, sumpmts = 0, D(0)
        while True:
            month += 1
            if month > max_months:
                raise RuntimeError('RZM2 loop did not end')
            pmt = cents(pmin * tbal)
            if pmt < dmin:
                pmt = dmin
            xxxbal = cents(cbal * (1 + perrate))
            fc = xxxbal - tbal
            if pmt > tbal + fc:
                pmt = cents(cbal * (1 + perrate))
            elif pmt <= fc:
                return None
            cbal = xxxbal - pmt
            sumpmts += pmt
            tbal = cbal
            if not tbal > 0:
                return month, sumpmts, sumpmts - _d(balance)


def regz_disclosed_estimate(months):
    """How a statement shows the minimum payment repayment estimate (RZ7 (b)(12)(i)(B)).

    Under 24 months: in months. Otherwise in years "rounded to the nearest whole year"; RZSUP 7(b)(12)(i)(F)-1
    shows "2 years 6 months to 3 years 5 months" all disclosed as 3 years, so a half year rounds up.
    """
    if months is None:
        return ('never', None)
    if months < REGZ_MONTHS_BELOW:
        return ('months', months)
    return ('years', int((D(months) / 12 + D('0.5')).to_integral_value(rounding=ROUND_FLOOR)))


def regz_36_month_payment(balance, apr):
    """RZM1 (d)(1) / RZM2: the same payment each month that repays the balance in 36 months, rounded to the cent."""
    return cents(level_payment(balance, apr, REGZ_36))


def balance_transfer(balance, apr, promo_months, fee_rate, required=None, min_floor=False, pct=PAGE_MIN_PCT,
                     floor=PAGE_MIN_FLOOR, round_cents=False):
    """Balance transfer against staying put (page model).

    Staying put: the interest the old card charges over the promo months when paying max(required, B / P)
    each month, B = the starting balance (B / P is the straight-line payment that clears B in P months at 0%).
    'required' is the required payment the person set; with none set the payment is B / P (the page README's
    formula has nothing else to floor it at; no source sets one for this comparison).
    min_floor=True (contrast only, column bt_interest_with_min_floor): with no required payment set, pay at
    least the page's usual minimum, max(2% x the opening balance, $25), recomputed each month. Changed
    2026-10-31 after the verification against the page: the key used to make this the answer.
    Transfer: fee = B x f (the page's model; CFPBCT says a fee is "usually a certain percentage of the amount
    you transfer or a fixed amount, whichever is more", so a real fee can be higher on a small balance).
    saves = interest - fee; pay_to_clear = B (1 + f) / P, the level payment that clears balance + fee at 0%.
    """
    b, p, f = _d(balance), int(promo_months), _d(fee_rate)
    with localcontext(CTX):
        straight = b / p
        fee = b * f
        pay_to_clear = b * (1 + f) / p
    if required is not None:
        rule = lambda _b, _x=max(_d(required), straight): _x
    elif min_floor:
        rule = lambda ob: max(card_minimum(ob, pct, floor, round_cents), straight)
    else:
        rule = lambda _b, _x=straight: _x
    s = schedule(b, apr, rule, round_cents=round_cents, stop_after=p)
    if s['never']:  # cannot happen: B / P pays more than one month's interest whenever r < 1 / P
        raise RuntimeError('balance transfer: payment below interest')
    with localcontext(CTX):
        return {'interest': s['interest'], 'fee': fee, 'saves': s['interest'] - fee,
                'pay_to_clear': pay_to_clear, 'months_run': s['months'], 'left_on_old_card': s['balance']}


# =========================================================================================================
# Pay off debts: avalanche and snowball with rollover
# =========================================================================================================
def order_debts(debts, method):
    """Target order. Avalanche: highest APR first (CFPBWS "List your debts from highest interest rate to lowest").
    Snowball: smallest balance first (CFPBWS "List your debts from smallest to largest in terms of the amount you owe").

    TIE-BREAK: no source decides. The key's figures put equal rates (avalanche) or equal balances (snowball) in
    input order (a stable sort). That is one valid choice, not a rule an app must follow: the payoff page sorts a
    tie by the debt's name (found when the key was verified against the page on 2026-10-31), which is equally
    valid. A tie row is therefore only a check where the app's tie order is the input order (debts named
    "Debt 1".."Debt n" in input order); with the names the other way round it has no single right answer.
    Generators should avoid exact ties except in a few labelled edge rows.
    """
    idx = list(range(len(debts)))
    if method == 'avalanche':
        return sorted(idx, key=lambda i: -_d(debts[i]['apr']))
    if method == 'snowball':
        return sorted(idx, key=lambda i: _d(debts[i]['balance']))
    raise ValueError('method is avalanche or snowball')


def payoff_plan(debts, method='avalanche', extra=0, rollover=True, round_cents=False, dynamic_order=False,
                max_months=MAX_MONTHS, keep_rows=False, decide_never=True):
    """Pay off several debts with a fixed monthly budget.

    debts: list of {'name', 'balance', 'apr', 'required'} (required = that debt's required monthly payment).
    Budget = sum of every debt's required payment + extra, the same every month: when a debt is finished its
    required payment stays in the budget and rolls to the targets (CFPBWS step 3 "allocate the entire payment
    (monthly payment + extra payment) you were making to the next debt on the list"; CFPBRD "dedicate that
    freed up money to the next smallest debt").
    Each month: (1) every open debt adds r x opening balance; (2) every open debt gets min(required, what it
    owes); (3) the rest of the budget goes to the open debts in target order, each up to what it owes, in the
    same month. rollover=False is the baseline: each debt gets only its own required payment, extra must be 0
    and a finished debt's payment is not reused.
    dynamic_order=True (contrast only): re-sort snowball by the current opening balance every month.
    decide_never=False (self-check only): skip the never test and just step until max_months.

    Never: the key decides exactly, phase by phase (static order). While no debt finishes, a non-target debt
    whose required payment is above its interest will finish; one at or below its interest never shrinks. If no
    non-target shrinks and the target's payment (budget - the others' required payments) is at or below the
    target's interest, nothing will ever finish: never. Without rollover, any debt whose required payment is at
    or below its interest is never.
    Returns months (None = never), interest, paid, payoff_month per debt (by input index), order.
    """
    n = len(debts)
    bal = [_d(x['balance']) for x in debts]
    rate = [monthly_rate(x['apr']) for x in debts]
    req = [_d(x['required']) for x in debts]
    extra = _d(extra)
    if not rollover and extra != 0:
        raise ValueError('the baseline (rollover=False) pays required payments only; extra must be 0')
    budget = sum(req, D(0)) + extra
    order = order_debts(debts, method)
    payoff = [0 if bal[i] <= 0 else None for i in range(n)]
    total_i, total_p, rows = D(0), D(0), []
    m = 0
    with localcontext(CTX):
        while any(b > 0 for b in bal):
            if m >= max_months:
                raise RuntimeError('plan still open after %d months' % max_months)
            if dynamic_order and method == 'snowball':
                order = sorted(range(n), key=lambda i: bal[i])  # stable: ties keep input order
            open_ = [i for i in order if bal[i] > 0]
            ints_now = {i: _interest(bal[i], rate[i], round_cents) for i in open_}
            # ---- never? ----
            if not decide_never:
                pass
            elif not rollover:
                if any(req[i] <= ints_now[i] and req[i] < bal[i] + ints_now[i] for i in open_):
                    return _never(order)
            elif not dynamic_order:
                t, others = open_[0], open_[1:]
                if not any(req[i] > ints_now[i] for i in others):
                    pay_t = budget - sum((req[i] for i in others), D(0))
                    if pay_t <= ints_now[t] and pay_t < bal[t] + ints_now[t]:
                        return _never(order)
            m += 1
            month_pay = {}
            for i in open_:  # (1) interest
                bal[i] += ints_now[i]
                total_i += ints_now[i]
            left = budget
            for i in open_:  # (2) required payments
                x = min(req[i], bal[i])
                if bal[i] - x <= (0 if round_cents else DUST):
                    x = bal[i]
                month_pay[i] = x
                bal[i] -= x
                left -= x
            if rollover:  # (3) the rest to the targets, in order
                for i in open_:
                    if left <= 0:
                        break
                    if bal[i] <= 0:
                        continue
                    x = min(left, bal[i])
                    if bal[i] - x <= (0 if round_cents else DUST):
                        x = bal[i]
                    month_pay[i] += x
                    bal[i] -= x
                    left -= x
            for i in open_:
                total_p += month_pay[i]
                if bal[i] <= 0 and payoff[i] is None:
                    bal[i] = D(0)
                    payoff[i] = m
            if keep_rows:
                rows.append({i: (ints_now[i], month_pay[i], bal[i]) for i in open_})
            if dynamic_order and m > 1200 * 4:
                raise RuntimeError('dynamic order: undecided after %d months; skip this row' % m)
    return {'months': m, 'interest': total_i, 'paid': total_p, 'payoff_month': payoff, 'order': order,
            'never': False, 'rows': rows}


def _never(order):
    return {'months': None, 'interest': None, 'paid': None, 'payoff_month': None, 'order': order,
            'never': True, 'rows': []}


def baseline(debts, round_cents=False):
    """Required payments only, nothing rolls over (page: 'the baseline pays required payments only')."""
    return payoff_plan(debts, 'avalanche', 0, rollover=False, round_cents=round_cents)


# =========================================================================================================
# Mortgage
# =========================================================================================================
def mortgage_months_left(balance, apr, payment, round_cents=False):
    """nper(rate/12, payment, balance) as whole months, by stepping (checked against months_closed_form)."""
    return amortize(balance, apr, payment, round_cents)['months']


def mortgage_interest_to_come(balance, apr, payment, round_cents=False):
    """Interest still to pay at this payment, summed over the amortization schedule."""
    return amortize(balance, apr, payment, round_cents)['interest']


def biweekly_monthly_payment(payment):
    """Page model: half the payment 26 times a year = payment x 13/12 every month (CFPBKT: 'one extra monthly
    payment per year')."""
    with localcontext(CTX):
        return _d(payment) * 13 / 12


def thirteenth_payment_schedule(balance, apr, payment, round_cents=False):
    """Contrast only (NOT the page's model): the monthly payment, plus one extra full payment every 12th month
    (CFPBKT: 'You may be able to accomplish the same goal ... by making an extra monthly mortgage payment each
    year'). Saves a little less interest than x 13/12 because the extra arrives later."""
    p = _d(payment)
    count = {'m': 0}

    def rule(_b):
        count['m'] += 1
        return p * 2 if count['m'] % 12 == 0 else p
    return schedule(balance, apr, rule, round_cents=round_cents)


def recast_payment(balance, apr, payment, lump, months=None):
    """Level payment that repays (balance - lump) over the months left at the current pace (page model).

    months defaults to the WHOLE months left at the current payment (mortgage_months_left), because a loan is
    repaid in whole monthly installments; pass months=nper(...) to see the fractional reading. No federal
    rule on recasts was found; lenders' fees and minimum lump sums were not checked.
    """
    b, lump = _d(balance), _d(lump)
    if lump >= b:
        return D(0)
    n = mortgage_months_left(b, apr, payment) if months is None else months
    if n is None:
        return None
    with localcontext(CTX):
        r = monthly_rate(apr)
        if r == 0:
            return (b - lump) / n
        return (b - lump) * r / (1 - (1 + r) ** -_d(n))


def months_to_ltv(balance, apr, payment, home_value, ltv=HPA_CANCEL_LTV, extra=0, round_cents=False):
    """Months until the balance after a payment is at or below ltv x home_value, paying payment + extra.

    0 when it is already there; None for never. 'Reach' counts the balance equal to the limit (HPA1 4901(2)
    'reaches 80 percent'). Checked against months_to_target_closed_form.
    """
    with localcontext(CTX):
        target = _d(ltv) * _d(home_value)
        pay = _d(payment) + _d(extra)
    s = schedule(balance, apr, pay, round_cents=round_cents, target=target)
    return s['target_month']


def hpa_dates(original_principal, apr, term_months, original_value, scheduled_payment=None):
    """Dates fixed by the HPA for a fixed-rate loan, in scheduled payments from the start of the loan.

    cancel_month:    first payment after which the INITIAL schedule's balance is at or below 80% of the original
                     value (HPA1 4901(2)(A)(i)); the borrower may ask then, or earlier if actual payments get
                     there first (4901(2)(A)(ii)); conditions in HPA2 4902(a).
    terminate_month: the same at 78% (HPA1 4901(18)(A)); automatic if current (HPA2 4902(b)); extra payments do
                     not move it (CFPBB15).
    midpoint_months: term / 2 (HPA1 4901(7)); PMI ends by the first day of the month after it (HPA2 4902(c));
                     CFPBB15: for 30 years "the first day of the month following the 180th payment". The exact
                     payment that last carries PMI is not settled by these sources; test only the midpoint.
    scheduled_payment defaults to the level payment rounded half up to the cent (the note's own rounding was
    not verified).
    """
    p = cents(level_payment(original_principal, apr, term_months)) if scheduled_payment is None else _d(scheduled_payment)
    ov = _d(original_value)
    with localcontext(CTX):
        s80 = schedule(original_principal, apr, p, target=HPA_CANCEL_LTV * ov, round_cents=True)
        s78 = schedule(original_principal, apr, p, target=HPA_TERMINATE_LTV * ov, round_cents=True)
    return {'scheduled_payment': p, 'cancel_month': s80['target_month'], 'terminate_month': s78['target_month'],
            'midpoint_months': F(term_months) * HPA_MIDPOINT_FRACTION}


def fannie_current_value_max_ltv(seasoning_months, improvements=False, one_unit_principal_or_second=True):
    """Highest LTV on CURRENT value at which Fannie Mae lets a borrower ask to drop MI (FNMASVC).

    One-unit principal residence or second home: 75% when seasoning is 24-60 months ("between two and five
    years"), 80% when over 60 months, 80% when the two-year minimum is waived for improvements; None (not
    eligible) under 24 months otherwise. Investment / 2-4 units: 70% and over 24 months. Whether exactly 24 or
    60 months falls on one side or the other is the key's reading of "between" (24 and 60 inclusive -> 75%);
    generators should avoid those exact values.
    """
    s = int(seasoning_months)
    if not one_unit_principal_or_second:
        return FNMA_MULTI_UNIT_LTV if s > 24 else None
    if s > 60:
        return D('0.80')
    if s >= 24:
        return D('0.75')
    return FNMA_IMPROVEMENTS_LTV if improvements else None


def mortgage_compare(balance, apr, payment, extra=0, lump=0, home_value=None, mi_ltv=HPA_CANCEL_LTV,
                     round_cents=False):
    """Everything the mortgage page shows, in one call (unrounded unless round_cents)."""
    base = amortize(balance, apr, payment, round_cents)
    ext = amortize(balance, apr, _d(payment) + _d(extra), round_cents)
    bw = amortize(balance, apr, biweekly_monthly_payment(payment), round_cents)
    out = {'base_months': base['months'], 'base_interest': base['interest'],
           'extra_months': ext['months'], 'extra_interest': ext['interest'],
           'biweekly_months': bw['months'], 'biweekly_interest': bw['interest'],
           'recast_payment': recast_payment(balance, apr, payment, lump) if _d(lump) > 0 else None,
           'mi_months': None}
    with localcontext(CTX):
        if base['months'] is not None:
            out['extra_saves'] = base['interest'] - ext['interest']
            out['biweekly_saves'] = base['interest'] - bw['interest']
            out['extra_months_saved'] = base['months'] - ext['months']
            out['biweekly_months_saved'] = base['months'] - bw['months']
    if home_value is not None:
        out['mi_months'] = months_to_ltv(balance, apr, payment, home_value, mi_ltv, extra, round_cents)
    return out


# =========================================================================================================
# Self-checks (run on import)
# =========================================================================================================
def _close(a, b, tol='1e-25'):
    with localcontext(CTX):
        return abs(_d(a) - _d(b)) <= D(tol)


def check_tables():
    """Prove the functions agree with their closed forms, with RZM2's own loop, and with RULES.md's examples."""
    # 1. Level payment: Decimal against exact Fraction.
    for b, apr, n in (('200000', '0.06', 360), ('3000', '0.24', 36), ('18000', '0.0699', 60), ('5000', '0', 24)):
        e = level_payment_exact(b, apr, n)
        assert _close(level_payment(b, apr, n), _d(e), '1e-40'), (b, apr, n)
    # 2. Stepped schedule against the closed forms (months on both tracks, interest on the full-precision track).
    cases = (('200000', '0.06', '1200'), ('200000', '0.06', '1400'), ('200000', '0.06', '1300'),
             ('12500', '0.199', '400'), ('950', '0.2999', '25'), ('8000', '0', '333'), ('40000', '0.0725', '612.34'))
    for b, apr, p in cases:
        s = amortize(b, apr, p)
        assert s['months'] == months_closed_form(b, apr, p), (b, apr, p, s['months'])
        assert _close(s['interest'], interest_closed_form(b, apr, p), '1e-20'), (b, apr, p)
        assert _close(s['paid'], _d(b) + s['interest'], '1e-20')
        assert amortize(b, apr, p, round_cents=True)['months'] == s['months'], (b, apr, p)
    assert amortize('2000', '0.30', '50')['never'] and nper('2000', '0.30', '50') is None  # 50 = 2.5% of 2000: no amortization
    # 3. Card minimum (cents track) against the transliteration of RZM2's SAS loop.
    for b, apr in (('1000', '0.17'), ('1000', '0.21'), ('3000', '0.18'), ('527.43', '0.2499'), ('12000', '0.1499')):
        m2 = regz_m2_single(b, apr, REGZ_EXAMPLE_PCT, REGZ_EXAMPLE_FLOOR)
        k = card_payoff(b, apr, None, REGZ_EXAMPLE_PCT, REGZ_EXAMPLE_FLOOR, round_cents=True)
        assert m2 == (k['months'], k['paid'], k['interest']), (b, apr, m2, k['months'])
    assert regz_m2_single('2000', '0.30', REGZ_EXAMPLE_PCT, REGZ_EXAMPLE_FLOOR) is None
    # 4. A one-debt plan is the fixed-payment payoff at required + extra; the baseline is required only.
    one = [{'name': 'a', 'balance': '4321.50', 'apr': '0.1899', 'required': '95'}]
    for method in ('avalanche', 'snowball'):
        pl = payoff_plan(one, method, extra='55')
        am = amortize('4321.50', '0.1899', '150')
        assert pl['months'] == am['months'] and _close(pl['interest'], am['interest'], '1e-20')
    assert baseline(one)['months'] == amortize('4321.50', '0.1899', '95')['months']
    # 4b. Never is decided phase by phase: a plan whose total owed rises at first can still finish; a stuck one cannot.
    rec = [{'name': 'H', 'balance': '10000', 'apr': '0.30', 'required': '300'},
           {'name': 'L', 'balance': '100000', 'apr': '0.03', 'required': '100'}]
    r = payoff_plan(rec, 'avalanche', 0)  # month 1 interest 500 > budget 400, yet H shrinks, then L does
    assert not r['never'] and r['payoff_month'][0] < r['payoff_month'][1] == r['months']
    stuck = [{'name': 'A', 'balance': '5000', 'apr': '0', 'required': '100'},
             {'name': 'H', 'balance': '10000', 'apr': '0.30', 'required': '100'}]
    assert payoff_plan(stuck, 'avalanche', 50)['never'] and payoff_plan(stuck, 'snowball', 50)['never']
    assert not payoff_plan(stuck, 'avalanche', 200)['never']  # budget 400 beats H's 250 interest
    _check_never_against_brute_force()
    # 5. Disclosure rounding and the HPA / Fannie Mae figures.
    assert regz_disclosed_estimate(23) == ('months', 23) and regz_disclosed_estimate(24) == ('years', 2)
    assert regz_disclosed_estimate(30) == ('years', 3) and regz_disclosed_estimate(41) == ('years', 3)  # RZSUP "2 years 6 months to 3 years 5 months" -> 3
    assert regz_disclosed_estimate(42) == ('years', 4)
    assert hpa_dates('200000', '0.06', 360, '240000')['midpoint_months'] == 180
    assert fannie_current_value_max_ltv(30) == D('0.75') and fannie_current_value_max_ltv(61) == D('0.80')
    assert fannie_current_value_max_ltv(12) is None and fannie_current_value_max_ltv(12, improvements=True) == D('0.80')
    # 6. RULES.md worked examples (exact figures; see that file).
    _check_examples()
    return True


def _check_never_against_brute_force(plans=40, cap=1500):
    """Random plans (fixed seed): the phase-by-phase never verdict agrees with plain stepping to `cap` months,
    and every finished plan pays exactly what it owed plus its interest."""
    import random
    rnd = random.Random(20261031)
    checked = 0
    while checked < plans:
        debts = []
        for k in range(rnd.randint(2, 4)):
            bal = D(rnd.randint(200, 20000))
            apr = D(rnd.choice((0, 499, 999, 1499, 1999, 2499, 2999))) / 10000
            req = D(rnd.randint(0, 400))
            debts.append({'name': 'd%d' % k, 'balance': bal, 'apr': apr, 'required': req})
        extra = D(rnd.randint(0, 300))
        method = rnd.choice(('avalanche', 'snowball'))
        try:
            verdict = payoff_plan(debts, method, extra, max_months=cap)
        except RuntimeError:
            continue  # finite but slower than the cap: not a useful case
        try:
            brute = payoff_plan(debts, method, extra, max_months=cap, decide_never=False)
        except RuntimeError:
            brute = None
        if verdict['never']:
            assert brute is None, ('never, yet stepping finished', debts, extra, method)
        else:
            assert brute is not None and brute['months'] == verdict['months'], (debts, extra, method)
            with localcontext(CTX):
                owed = sum((_d(x['balance']) for x in debts), D(0))
                assert abs(verdict['paid'] - owed - verdict['interest']) <= D('1e-20')
        checked += 1
    return True


EX_DEBTS = [  # RULES.md example 1 (invented numbers)
    {'name': 'Store card', 'balance': '500', 'apr': '0.24', 'required': '40'},
    {'name': 'Bank loan', 'balance': '300', 'apr': '0.12', 'required': '30'},
]
EX_EXTRA = '130'  # budget = 40 + 30 + 130 = 200 a month


def _check_examples():
    """RULES.md's three worked examples, to the cent (full-precision track unless marked)."""
    av = payoff_plan(EX_DEBTS, 'avalanche', EX_EXTRA)
    sn = payoff_plan(EX_DEBTS, 'snowball', EX_EXTRA)
    assert av['order'] == [0, 1] and sn['order'] == [1, 0]
    assert (av['months'], av['payoff_month'], cents(av['interest'])) == (5, [4, 5], D('31.22')), av
    assert (sn['months'], sn['payoff_month'], cents(sn['interest'])) == (5, [5, 2], D('37.69')), sn
    assert cents(payoff_plan(EX_DEBTS, 'avalanche', EX_EXTRA, round_cents=True)['interest']) == D('31.23')
    assert cents(payoff_plan(EX_DEBTS, 'snowball', EX_EXTRA, round_cents=True)['interest']) == D('37.70')
    pa, ps = (payoff_plan(EX_DEBTS, m, D(EX_EXTRA) + 100) for m in ('avalanche', 'snowball'))
    assert (pa['months'], cents(pa['interest']), ps['months'], cents(ps['interest'])) == (3, D('22.74'), 3, D('27.29'))
    base = baseline(EX_DEBTS)
    assert (base['months'], base['payoff_month'], cents(base['interest'])) == (15, [15, 11], D('98.89')), base
    r0 = payoff_plan(EX_DEBTS, 'avalanche', 0)  # the other reading of "baseline": extra 0 but freed payments roll over
    assert (r0['months'], cents(r0['interest'])) == (13, D('96.19')), r0
    # Example 2: credit card, no required payment set: max(2%, $25) recomputed every month.
    c = card_payoff('3000', '0.18', keep_rows=True)
    assert [tuple(cents(x) for x in row) for row in c['rows'][:3]] == [
        (D('3000.00'), D('45.00'), D('60.00'), D('15.00'), D('2985.00')),
        (D('2985.00'), D('44.78'), D('59.70'), D('14.93'), D('2970.08')),  # exact 44.775, 14.925, 2970.075
        (D('2970.08'), D('44.55'), D('59.40'), D('14.85'), D('2955.22'))], c['rows'][:3]  # exact 44.551125, 59.4015, 14.850375, 2955.224625
    assert (c['months'], cents(c['interest']), cents(c['final_payment'])) == (268, D('6327.77'), D('19.14'))
    cc = card_payoff('3000', '0.18', round_cents=True)
    assert (cc['months'], cc['interest']) == (268, D('6327.65'))
    assert regz_m2_single('3000', '0.18', PAGE_MIN_PCT, PAGE_MIN_FLOOR) == (268, D('9327.65'), D('6327.65'))
    assert regz_disclosed_estimate(268) == ('years', 22) and regz_36_month_payment('3000', '0.18') == D('108.46')
    cf = card_payoff('3000', '0.18', frozen=True)
    assert (cf['months'], cents(cf['interest'])) == (94, D('2586.71'))
    assert card_payoff('2000', '0.30')['never']  # 2% = 40.00 < 50.00 interest
    c9 = card_payoff('900', '0.30')
    assert (c9['months'], cents(c9['interest'])) == (94, D('1431.31'))
    bt = balance_transfer('3000', '0.24', 12, '0.03', required='75')
    assert (cents(bt['interest']), bt['fee'], cents(bt['saves']), bt['pay_to_clear']) == (D('451.70'), D('90.00'), D('361.70'), D('257.5'))
    # Example 3: mortgage, $200,000 left at 6%, paying $1,250; extra $200; lump $20,000; home value $240,000.
    mc = mortgage_compare('200000', '0.06', '1250', extra='200', lump='20000', home_value='240000')
    assert (mc['base_months'], mc['extra_months'], mc['biweekly_months'], mc['mi_months']) == (323, 235, 269, 18), mc
    assert (cents(mc['base_interest']), cents(mc['extra_interest']), cents(mc['biweekly_interest'])) == (
        D('203365.21'), D('140169.13'), D('164142.23')), mc
    assert cents(mc['recast_payment']) == D('1124.57'), mc
    assert cents(recast_payment('200000', '0.06', '1250', '20000', months=nper('200000', '0.06', '1250'))) == D('1125.00')
    assert months_to_target_closed_form('200000', '0.06', '1450', '192000') == 18
    hd = hpa_dates('216000', '0.06', 360, '240000')
    assert (hd['scheduled_payment'], hd['cancel_month'], hd['terminate_month']) == (D('1295.03'), 89, 103), hd


check_tables()

if __name__ == '__main__':
    print('rules.py: all self-checks passed (read on %s)' % READ_ON)
