"""Federal student loan repayment figures for the student-loans answer key, as data plus small pure functions.

Written from the primary sources below, never from the app's code. Nobody opened modules/, core/ or
tests/*.test.mjs while writing this file, and it never imports or runs the app. Only the layout and
conventions of tools/golden_paycheck/ and tools/golden_business/ were looked at; no figure or code is
shared with them. Every figure names its source and the date it was read on the same line. Money is
Decimal; a rate is a Decimal fraction ("0.10" = 10%). Importing this file runs check_tables().

Plans covered:
  STANDARD  the 10-year standard plan for Direct Loans made before July 1, 2026 (34 CFR 685.208(b)(1)),
            plus the Tiered Standard term table for loans made on or after that date (data only).
  IBR       Income-Based Repayment, 20 U.S.C. 1098e as amended by Pub. L. 119-21 s.82001(f), for "new
            borrowers" (first loan on or after July 1, 2014 and before July 1, 2026): 10% and 20 years.
            The 15% / 25-year terms for older borrowers are kept as data for contrast.
  RAP       the Repayment Assistance Plan, 20 U.S.C. 1087e(q) as added by Pub. L. 119-21 s.82001(d)
            (the law put it in HEA s.455(q) = 20 U.S.C. 1087e(q); there is no 20 U.S.C. 1098e-1).

Sources (all read 2026-10-31; sha256 of the copy read: first 8 ... last 10 hex digits):
  USC1087E 20 U.S.C. 1087e, Office of the Law Revision Counsel, "current through Pub. L. 119-136 (Oct 22, 2026)"
           https://uscode.house.gov/us/usc/119-136/t20/s1087e/   (sha256 f6c4e8e8...dab1aa9299)
             (d)(1)(A), (d)(6), (d)(7)(A) standard / Tiered Standard; (q)(1)-(q)(4) the Repayment Assistance Plan
  USC1098E 20 U.S.C. 1098e (HEA s.493C), same edition
           https://uscode.house.gov/us/usc/119-136/t20/s1098e/   (sha256 ed6a16c8...717d148b18)
  USC1078  20 U.S.C. 1078(b)(9)(A)(i) (the standard plan 1087e(d)(1)(A) points to), same edition
           https://uscode.house.gov/us/usc/119-136/t20/s1078/    (sha256 9ed44a01...692f34d3b0)
  PL11921  Pub. L. 119-21 (July 4, 2025), title VIII: s.82001(d) RAP, 139 Stat. 341-345; s.82001(f) IBR,
           139 Stat. 345-347   https://www.govinfo.gov/content/pkg/PLAW-119publ21/html/PLAW-119publ21.htm (sha256 84000b07...c584e9004d)
  CFR202   34 CFR 685.202(a), (b) (interest on the unpaid principal; capitalization), eCFR up to date as of 2026-10-29
           https://www.ecfr.gov/current/title-34/section-685.202   (XML sha256 202dc23a...ca40dd056f)
  CFR208   34 CFR 685.208 (fixed payment plans), eCFR as of 2026-10-29, text [91 FR 23886, May 1, 2026]
           https://www.ecfr.gov/current/title-34/section-685.208   (XML sha256 da6575e3...80ba43f190)
  CFR209   34 CFR 685.209 (income-driven plans incl. IBR and RAP), eCFR as of 2026-10-29, text [91 FR 23887, May 1, 2026]
           https://www.ecfr.gov/current/title-34/section-685.209   (XML sha256 6c6316a8...178ac22ae1)
  CFR211   34 CFR 685.211(a) (order payments are applied in), eCFR as of 2026-10-29
           https://www.ecfr.gov/current/title-34/section-685.211   (XML sha256 f905a8d6...9dddbe4388)
  RISE     ED final rule "Reimagining and Improving Student Education", 91 FR 23768 (May 1, 2026), effective July 1, 2026
           https://www.govinfo.gov/content/pkg/FR-2026-05-01/pdf/2026-08556.pdf   (sha256 21ef3bab...71483f56ac); p.23838 marginal-rate answer
  SADEF    studentaid.gov "One Big Beautiful Bill Act - Important Definitions" (last updated Aug. 24, 2026), section "Repayment
           Assistance Plan" https://studentaid.gov/announcements-events/big-updates/definitions#rap
  SAIDR    studentaid.gov "Income-Driven Repayment Plans"  https://studentaid.gov/manage-loans/repayment/plans/income-driven
  SAQA     studentaid.gov "Questions and Answers About IDR Plans"  https://studentaid.gov/manage-loans/repayment/plans/income-driven/questions
  SASTD    studentaid.gov "Standard Repayment Plan"  https://studentaid.gov/manage-loans/repayment/plans/standard
  PG23     HHS, Annual Update of the HHS Poverty Guidelines, 88 FR 3424 (Jan 19, 2023)  (sha256 0a18dee4...2132639b48)
           https://www.govinfo.gov/content/pkg/FR-2023-01-19/pdf/2023-00885.pdf   (only to rebuild the SAQA worked example)
  PG25     HHS, Annual Update of the HHS Poverty Guidelines, 90 FR 5917 (Jan 17, 2025), effective Jan 15, 2025 (sha256 a239506c...92ee2cebce)
           https://www.govinfo.gov/content/pkg/FR-2025-01-17/pdf/2025-01377.pdf
  PG26     HHS, Annual Update of the HHS Poverty Guidelines, 91 FR 1797 (Jan 15, 2026), table p.1798, effective Jan 13, 2026 (sha256 67f71197...64d2d0f339)
           https://www.govinfo.gov/content/pkg/FR-2026-01-15/pdf/2026-00755.pdf
  ASPE     aspe.hhs.gov "Poverty Guidelines" page (2026 tables)  https://aspe.hhs.gov/topics/poverty-economic-mobility/poverty-guidelines

NOT VERIFIED on any official source (so the key states its own convention and says so):
  - Rounding. No statute or regulation says how a monthly payment is rounded. The key rounds to the cent,
    half up, because that is the only rule that reproduces both studentaid.gov tables (SADEF RAP table:
    60,001 -> 300.01 and 30,001 -> 75.00; SAQA IBR example: 226.625 -> 226.63). check_tables() proves it.
  - Monthly interest. Servicers accrue simple interest daily; no official monthly formula was found. The
    key uses rate / 12 on the unpaid principal each month (as its brief says) and rounds that to the cent.
  - Which year's poverty guideline a servicer uses for a given recertification is not fixed by the law
    (CFR209 (b)(14) says only "published annually"); the key takes the guideline year as an input.
"""
import sys
sys.dont_write_bytecode = True  # keep the repo free of __pycache__

from decimal import Decimal as D, ROUND_HALF_UP, ROUND_HALF_EVEN, ROUND_CEILING, localcontext
from fractions import Fraction as F

CENT = D('0.01')
MONTHS_PER_YEAR = 12  # USC1087E (q)(4)(B)(i)(I) "divided by 12"; USC1098E (b)(1) "divided by 12"; read 2026-10-31


def cents(x, rounding=ROUND_HALF_UP):
    """Round to the cent. Half up is the key's convention (not stated in any source; see the docstring)."""
    return D(x).quantize(CENT, rounding=rounding)


# ---- HHS poverty guidelines (42 U.S.C. 9902(2)), persons in family 1..8 -------------------------
# Each table: (amount for 1..8 persons), then "add $X for each additional person" above 8.
POVERTY = {
    2023: {'contiguous': ((14580, 19720, 24860, 30000, 35140, 40280, 45420, 50560), 5140)},  # PG23 88 FR 3424 table, "add $5,140"; read 2026-10-31
    2025: {
        'contiguous': ((15650, 21150, 26650, 32150, 37650, 43150, 48650, 54150), 5500),  # PG25 90 FR 5917 "48 contiguous states and the District of Columbia", "add $5,500"; read 2026-10-31
        'alaska':     ((19550, 26430, 33310, 40190, 47070, 53950, 60830, 67710), 6880),  # PG25 90 FR 5917 Alaska table, "add $6,880"; read 2026-10-31
        'hawaii':     ((17990, 24320, 30650, 36980, 43310, 49640, 55970, 62300), 6330),  # PG25 90 FR 5917 Hawaii table, "add $6,330"; read 2026-10-31
    },
    2026: {
        'contiguous': ((15960, 21640, 27320, 33000, 38680, 44360, 50040, 55720), 5680),  # PG26 91 FR 1798 "48 contiguous states and the District of Columbia", "add $5,680"; ASPE same; read 2026-10-31
        'alaska':     ((19950, 27050, 34150, 41250, 48350, 55450, 62550, 69650), 7100),  # PG26 91 FR 1798 Alaska table, "add $7,100"; ASPE same; read 2026-10-31
        'hawaii':     ((18360, 24890, 31420, 37950, 44480, 51010, 57540, 64070), 6530),  # PG26 91 FR 1798 Hawaii table, "add $6,530"; ASPE same; read 2026-10-31
    },
}
POVERTY_BASE_1 = {2025: D(15650), 2026: D(15960)}       # 48 states + DC, 1 person: PG25 p.5917; PG26 p.1798; read 2026-10-31
POVERTY_PER_PERSON = {2025: D(5500), 2026: D(5680)}     # 48 states + DC, each additional person (uniform steps 1..8 checked below); read 2026-10-31
# CFR209 (b)(14): a borrower not resident in a State listed in the guidelines uses the 48-contiguous-states figure.


def poverty_guideline(year, family_size, region='contiguous'):
    """HHS poverty guideline for the family size (PG25 / PG26 / PG23 tables)."""
    if family_size < 1:
        raise ValueError('family size is at least 1 (the borrower)')
    table, extra = POVERTY[year][region]
    if family_size <= len(table):
        return D(table[family_size - 1])
    return D(table[-1]) + D(extra) * (family_size - len(table))


# ---- Standard 10-year plan (loans made before July 1, 2026) -------------------------------------
STANDARD_YEARS = 10           # USC1078 (b)(9)(A)(i) "fixed annual repayment amount paid over a fixed period of time, not to exceed 10 years"; CFR208 (b)(1)(i) "within ten years"; read 2026-10-31
STANDARD_MONTHS = 120         # = 10 x 12; CFR208 (b)(1)(i) "by making fixed monthly payments"; read 2026-10-31
STANDARD_MIN_PAYMENT = D(50)  # CFR208 (b)(1)(ii) "at least $50 per month, except that a borrower's final payment may be less than $50"; SASTD "at least $50 each month"; read 2026-10-31
STANDARD_PLAN_CUTOFF = '2026-07-01'  # CFR208 (b): (b)(1) applies to borrowers "who have not received a Direct Loan on or after July 1, 2026"; USC1087E (d)(1), (d)(6)(A); read 2026-10-31

# Tiered Standard plan (loans made on or after July 1, 2026, and anyone who also has such a loan). Data only.
# (total outstanding principal at least, years). USC1087E (d)(7)(A)(i)(II)(aa)-(dd); CFR208 (c)(1)(iii)(A)-(D); read 2026-10-31
TIERED_STANDARD_YEARS = ((D(0), 10), (D(25000), 15), (D(50000), 20), (D(100000), 25))


def tiered_standard_years(total_principal):
    """Repayment period of the Tiered Standard plan: <25k 10y, 25k-<50k 15y, 50k-<100k 20y, 100k+ 25y."""
    years = None
    for floor, y in TIERED_STANDARD_YEARS:
        if D(total_principal) >= floor:
            years = y
    return years


def level_payment(balance, annual_rate, months=STANDARD_MONTHS):
    """Unrounded level payment that repays `balance` in `months` equal payments at annual_rate / 12 a month.

    The formula is the ordinary annuity: B r / (1 - (1 + r)^-n), r = rate / 12. The sources say only "fixed
    monthly payments" that repay "in full within ten years" (CFR208 (b)(1)(i)); the formula is that rule in math.
    """
    balance, annual_rate = D(balance), D(annual_rate)
    if balance <= 0:
        return D(0)
    with localcontext() as ctx:
        ctx.prec = 50
        if annual_rate == 0:
            return balance / months
        r = annual_rate / MONTHS_PER_YEAR
        return balance * r / (1 - (1 + r) ** -months)


def level_payment_exact(balance, annual_rate, months=STANDARD_MONTHS):
    """The same level payment in exact rational arithmetic (a Fraction), so a schedule paying it closes to 0 exactly."""
    b, rate = F(D(balance)), F(D(annual_rate))
    if b <= 0:
        return F(0)
    if rate == 0:
        return b / months
    g = (1 + rate / MONTHS_PER_YEAR) ** months
    return b * (rate / MONTHS_PER_YEAR) * g / (g - 1)


def standard_payment(balance, annual_rate, months=STANDARD_MONTHS, to_cent=True):
    """10-year standard monthly payment: the level payment, but at least $50 (CFR208 (b)(1)(ii)).

    to_cent=True (display): to the cent, half up, as Decimal. to_cent=False: exact, as a Fraction. No statute or
    regulation says how a payment is rounded, so the answer key's schedules use the exact figure (verified
    2026-10-31 against USC1087E, USC1098E, CFR208 and CFR209: none of them rounds a payment).
    """
    if D(balance) <= 0:
        return D(0) if to_cent else F(0)
    if not to_cent:
        return max(level_payment_exact(balance, annual_rate, months), F(STANDARD_MIN_PAYMENT))
    return max(cents(level_payment(balance, annual_rate, months)), STANDARD_MIN_PAYMENT)


def monthly_interest(principal, annual_rate):
    """One month's interest on the unpaid principal (CFR202 (a): "percent on the unpaid principal balance").

    Simple interest: never charged on unpaid interest. rate / 12 a month, to the cent (key convention).
    """
    return cents(D(principal) * D(annual_rate) / MONTHS_PER_YEAR)


def standard_schedule(balance, annual_rate, months=STANDARD_MONTHS):
    """Month-by-month payoff on the standard plan. Returns (payment, number_of_payments, total_paid, total_interest).

    The fixed payment is standard_payment(); the last payment is whatever is left (principal + that month's
    interest), so it may be smaller (CFR208 (b)(1)(ii)) or a few cents larger because of rounding.
    """
    pay = standard_payment(balance, annual_rate, months)
    principal, n, paid, interest_total = D(balance), 0, D(0), D(0)
    while principal > 0:
        n += 1
        interest = monthly_interest(principal, annual_rate)
        due = principal + interest
        this = due if (due <= pay or n == months) else pay
        principal = due - this
        paid += this
        interest_total += interest
        if n > 1200:
            raise RuntimeError('schedule does not converge')
    return pay, n, paid, interest_total


# ---- Income-Based Repayment (20 U.S.C. 1098e; 34 CFR 685.209) ------------------------------------
IBR_POVERTY_MULTIPLE = D('1.5')     # USC1098E (a)(3)(B) "150 percent of the poverty line applicable to the borrower's family size"; CFR209 (b)(4)(ii); read 2026-10-31
IBR_RATE_NEW = D('0.10')            # USC1098E (e)(1) substitutes "10 percent" for "15 percent" for "any loan made to a new borrower on or after July 1, 2014 and before July 1, 2026"; CFR209 (b)(1)(ii), (f)(2)(i); SAQA; read 2026-10-31
IBR_RATE_OLD = D('0.15')            # USC1098E (a)(3) "15 percent"; CFR209 (b)(1)(i), (f)(3)(i) (contrast only); read 2026-10-31
IBR_FORGIVE_YEARS_NEW = 20          # USC1098E (e)(2) substitutes "20 years" for "25 years"; CFR209 (k)(2) "240 monthly payments ... over a period of at least 20 years"; read 2026-10-31
IBR_FORGIVE_PAYMENTS_NEW = 240      # CFR209 (k)(2); SAQA "240 or 300 qualifying monthly payments"; read 2026-10-31
IBR_FORGIVE_YEARS_OLD = 25          # USC1098E (b)(7)(B) "not to exceed 25 years"; CFR209 (k)(1) 300 payments (contrast only); read 2026-10-31
IBR_FORGIVE_PAYMENTS_OLD = 300      # CFR209 (k)(1); read 2026-10-31
IBR_NEW_BORROWER_FROM = '2014-07-01'   # USC1098E (e); CFR209 (b)(13)(ii) no balance before July 1, 2014 (or when borrowing after it); read 2026-10-31
IBR_NEW_BORROWER_BEFORE = '2026-07-01' # USC1098E (e) "and before July 1, 2026" (PL11921 s.82001(f)(1)(E), 139 Stat. 347); CFR209 (b)(13)(ii), (d)(5); read 2026-10-31
IBR_ZERO_BELOW = D(5)               # CFR209 (g)(1)(iii)(A) "Less than $5, the monthly payment is $0"; SAQA; read 2026-10-31
IBR_TEN_BELOW = D(10)               # CFR209 (g)(1)(iii)(B) "Equal to or greater than $5 but less than $10, the monthly payment is $10"; read 2026-10-31
IBR_MIN_PAYMENT = D(10)             # CFR209 (g)(1)(iii)(B); read 2026-10-31
IBR_SUBSIDY_YEARS = 3               # USC1098E (b)(3)(A) unpaid interest on subsidized loans "paid by the Secretary for a period of not more than 3 years"; CFR209 (h)(2)(i) "first three consecutive years"; read 2026-10-31


def ibr_discretionary_income(agi, family_size, pg_year, region='contiguous'):
    """AGI minus 150% of the poverty guideline, not below 0 (USC1098E (a)(3); CFR209 (b)(4))."""
    return max(D(0), D(agi) - IBR_POVERTY_MULTIPLE * poverty_guideline(pg_year, family_size, region))


def ibr_payment(agi, family_size, pg_year, standard_cap, new_borrower=True, share=D(1), region='contiguous', to_cent=True):
    """IBR monthly payment.

    agi           borrower's AGI (plus spouse's only if married filing jointly: USC1098E (d); CFR209 (e)(1)(i))
    standard_cap  the 10-year standard payment on the eligible loans when the borrower began IBR
                  (USC1098E (b)(6)(A); CFR209 (f)(2)(ii)); pass standard_payment(balance_then, rate)
    share         borrower's share of the couple's eligible debt when the spouse's income is counted
                  (CFR209 (g)(1)(i)); 1 otherwise
    Steps: rate x discretionary / 12 -> lesser of that and the cap -> x share -> cent -> <$5 is $0, $5-<$10 is $10.
    to_cent=False: the same steps without the cent (a Fraction), so the $0 / $10 test reads the calculated amount
    itself, as CFR209 (g)(1)(iii) words it ("the borrower's monthly payment amount calculated under paragraphs
    (f)(1) through (3)"): 4.995 is less than $5, so $0.
    """
    rate = IBR_RATE_NEW if new_borrower else IBR_RATE_OLD
    if not to_cent:
        raw = F(rate) * F(ibr_discretionary_income(agi, family_size, pg_year, region)) / MONTHS_PER_YEAR
        pay = min(raw, F(standard_cap)) * F(D(share))
        if pay < IBR_ZERO_BELOW:
            return F(0)
        if pay < IBR_TEN_BELOW:
            return F(IBR_MIN_PAYMENT)
        return pay
    raw = rate * ibr_discretionary_income(agi, family_size, pg_year, region) / MONTHS_PER_YEAR
    pay = cents(min(raw, D(standard_cap)) * D(share))
    if pay < IBR_ZERO_BELOW:
        return D(0)
    if pay < IBR_TEN_BELOW:
        return IBR_MIN_PAYMENT
    return pay


def ibr_month(principal, unpaid_interest, annual_rate, payment, subsidized=False, in_subsidy_years=False):
    """One IBR month. Returns (principal, unpaid_interest, interest_accrued, interest_waived).

    Payment order: accrued interest, then fees (none here), then principal (USC1098E (b)(2); CFR211 (a)(1)(ii)).
    Interest the payment does not cover is not capitalized while the borrower stays on the income-based
    payment: it waits in unpaid_interest and is paid off before any principal. On a subsidized loan during
    the first 3 consecutive years it is not charged at all (USC1098E (b)(3)(A); CFR209 (h)(2)(i)).
    Capitalization happens only at the events in ibr_capitalize() (USC1098E (b)(3)(B); CFR209 (j)(2)).
    Principal not paid is deferred (USC1098E (b)(4)).
    """
    principal, unpaid_interest, payment = D(principal), D(unpaid_interest), D(payment)
    accrued = monthly_interest(principal, annual_rate)
    waived = D(0)
    interest_due = unpaid_interest + accrued
    to_interest = min(payment, interest_due)
    left_interest = interest_due - to_interest
    if subsidized and in_subsidy_years:
        # only this month's uncovered interest is waived; older unpaid interest stays owed
        waived = min(left_interest, max(D(0), accrued - min(payment, accrued)))
        left_interest -= waived
    to_principal = min(payment - to_interest, principal)
    return principal - to_principal, left_interest, accrued, waived


def ibr_capitalize(principal, unpaid_interest):
    """Add unpaid interest to principal: when the borrower leaves IBR or starts paying the standard cap
    (USC1098E (b)(3)(B)(i)-(ii) "ends the election" / "begins making payments of not less than the amount
    specified in paragraph (6)(A)"; CFR209 (j)(2)(ii)-(iii); SAIDR "IBR Plan Consequences of Not Recertifying")."""
    return D(principal) + D(unpaid_interest), D(0)


# ---- Repayment Assistance Plan (20 U.S.C. 1087e(q); 34 CFR 685.209) -------------------------------
RAP_START = '2026-07-01'            # USC1087E (q)(1) "beginning on July 1, 2026"; read 2026-10-31
# Base payment bands: (AGI more than, AGI not more than, rate). The rate applies to the WHOLE AGI, not the slice:
# USC1087E (q)(4)(B)(iv)(II)-(XI) "is N percent of such adjusted gross income"; CFR209 (b)(2); RISE p.23838
# refuses a "marginal-rate calculation" as "inconsistent with the statutory framework"; SADEF table "N% of your AGI".
RAP_FLAT_BASE_TOP = D(10000)        # USC1087E (q)(4)(B)(iv)(I) "not more than $10,000, is $120"; CFR209 (b)(2)(i); read 2026-10-31
RAP_FLAT_BASE = D(120)              # same; read 2026-10-31
RAP_BANDS = (                       # USC1087E (q)(4)(B)(iv)(II)-(XI); CFR209 (b)(2)(ii)-(xi); SADEF base payment table; read 2026-10-31
    (D(10000), D(20000), D('0.01')),
    (D(20000), D(30000), D('0.02')),
    (D(30000), D(40000), D('0.03')),
    (D(40000), D(50000), D('0.04')),
    (D(50000), D(60000), D('0.05')),
    (D(60000), D(70000), D('0.06')),
    (D(70000), D(80000), D('0.07')),
    (D(80000), D(90000), D('0.08')),
    (D(90000), D(100000), D('0.09')),
    (D(100000), None, D('0.10')),   # (XI) "more than $100,000, is 10 percent"
)
RAP_PER_DEPENDENT = D(50)           # USC1087E (q)(4)(B)(i)(II) "minus $50 for each dependent of the borrower"; CFR209 (f)(5)(ii); SADEF; read 2026-10-31
RAP_MIN_PAYMENT = D(10)             # USC1087E (q)(4)(B)(ii) "less than $10 ... shall be $10"; CFR209 (g)(3)(i)(B), (ii); SAIDR "may not be less than $10 a month"; read 2026-10-31
RAP_MATCH_TARGET = D(50)            # USC1087E (q)(2)(B) "reduces the total outstanding principal balance ... by less than $50"; CFR209 (o)(2)(i); read 2026-10-31
RAP_FORGIVE_PAYMENTS = 360          # USC1087E (q)(1)(D)(ii), (E)(iii) "360 qualifying monthly payments"; CFR209 (k)(7) "over a period of at least 30 years"; read 2026-10-31
RAP_FORGIVE_YEARS = 30              # CFR209 (k)(7); SAIDR table "30"; SADEF; read 2026-10-31
RAP_PAYMENT_CAP = None              # no cap: SAIDR "There is no cap on your monthly payment amount under RAP"; read 2026-10-31
# Dependents: IRC 152 dependents (USC1087E (q)(4)(B)(v)) claimed on the borrower's return; married filing
# separately counts only those on the borrower's own return (USC1087E (q)(4)(B)(i)(II); CFR209 (b)(3)).
# AGI: borrower's (and spouse's, as applicable) for the most recent taxable year; married filing separately
# excludes the spouse (USC1087E (q)(4)(A); CFR209 (e)(1)(i)).


def rap_base_payment(agi):
    """Annual base payment: $120 up to $10,000 of AGI, otherwise the band's percent of the whole AGI."""
    agi = D(agi)
    if agi <= RAP_FLAT_BASE_TOP:
        return RAP_FLAT_BASE
    for low, high, rate in RAP_BANDS:
        if agi > low and (high is None or agi <= high):
            return rate * agi
    raise AssertionError(agi)


def rap_payment(agi, dependents=0, share=D(1), balance=None, to_cent=True):
    """RAP monthly payment (USC1087E (q)(4)(B); CFR209 (f)(5), (g)(3)).

    base / 12 - $50 x dependents -> x share (borrower's part of the couple's eligible debt when a joint
    filer's spouse also has loans, CFR209 (g)(3)(i)) -> cent -> at least $10 -> never more than the balance
    left (USC1087E (q)(4)(B)(iii) final payment). No upper cap. to_cent=False: the same without the cent (a Fraction).
    """
    if not to_cent:
        raw = F(rap_base_payment(agi)) / MONTHS_PER_YEAR - F(RAP_PER_DEPENDENT) * int(dependents)
        pay = max(raw * F(D(share)), F(RAP_MIN_PAYMENT))
        if balance is not None and F(D(balance)) < pay:
            pay = F(D(balance))
        return pay
    raw = rap_base_payment(agi) / MONTHS_PER_YEAR - RAP_PER_DEPENDENT * int(dependents)
    pay = max(cents(raw * D(share)), RAP_MIN_PAYMENT)
    if balance is not None and D(balance) < pay:
        pay = D(balance)
    return pay


def rap_match(payment, to_principal):
    """Matching principal payment (USC1087E (q)(2)(B); CFR209 (o)(2)(i)):
    when the on-time payment cuts principal by less than $50, the Secretary cuts it by
    (lesser of $50 or the amount paid) minus the part of the payment that went to principal."""
    payment, to_principal = D(payment), D(to_principal)
    if to_principal >= RAP_MATCH_TARGET:
        return D(0)
    return max(D(0), min(RAP_MATCH_TARGET, payment) - to_principal)


def rap_month(principal, annual_rate, payment):
    """One on-time RAP month with no deferment or forbearance.
    Returns (principal, interest_accrued, interest_waived, match).

    Order: interest, then fees (none), then principal (USC1087E (q)(1)(B); CFR211 (a)(1)(ii)).
    Interest the on-time payment does not cover "shall not be charged" (USC1087E (q)(2)(A); CFR209 (h)(4)(i)),
    so unpaid interest never builds up and is never capitalized while the borrower pays on time.
    The match is capped at the principal that is left (key assumption: a balance cannot go below 0).
    """
    principal, payment = D(principal), D(payment)
    accrued = monthly_interest(principal, annual_rate)
    to_interest = min(payment, accrued)
    waived = accrued - to_interest
    to_principal = min(payment - to_interest, principal)
    match = min(rap_match(payment, to_principal), principal - to_principal)
    return principal - to_principal - match, accrued, waived, match


# ---- Self-checks ---------------------------------------------------------------------------------
# studentaid.gov SADEF "Monthly Payment Amount Based on Your AGI Range" (no dependents): AGI -> monthly payment.
SADEF_RAP_TABLE = (                 # SADEF (last updated Aug. 24, 2026); read 2026-10-31
    (0, '10.00'), (10000, '10.00'), (10001, '10.00'), (20000, '16.67'), (20001, '33.34'), (30000, '50.00'),
    (30001, '75.00'), (40000, '100.00'), (40001, '133.34'), (50000, '166.67'), (50001, '208.34'),
    (60000, '250.00'), (60001, '300.01'), (70000, '350.00'), (70001, '408.34'), (80000, '466.67'),
    (80001, '533.34'), (90000, '600.00'), (90001, '675.01'), (100000, '750.00'),
)
SADEF_RAP_ABOVE_100K = '833.33'     # SADEF "More than $100,000 | At least $833.33" (= 10% x 100,000 / 12; 100,001 itself gives 833.34)


def check_tables():
    """Cross-check the figures against each other and against the agencies' own worked numbers."""
    # Poverty tables: uniform steps, as the notices say ("add $X for each additional person").
    for year, regions in POVERTY.items():
        for region, (table, extra) in regions.items():
            for i, amount in enumerate(table):
                assert amount == table[0] + extra * i, (year, region, i)
            assert poverty_guideline(year, 9, region) == table[-1] + extra
    for year in (2025, 2026):
        assert poverty_guideline(year, 1) == POVERTY_BASE_1[year]
        assert poverty_guideline(year, 2) - poverty_guideline(year, 1) == POVERTY_PER_PERSON[year]
        for n in range(1, 13):  # 150% stays whole dollars, so discretionary income has no half-dollars
            assert (IBR_POVERTY_MULTIPLE * poverty_guideline(year, n)) % 1 == 0

    # RAP bands: contiguous $10,000 steps, 1%..10%, the $120 base equals the $10 floor x 12.
    assert RAP_BANDS[0][0] == RAP_FLAT_BASE_TOP
    for k, (low, high, rate) in enumerate(RAP_BANDS):
        assert rate == D(k + 1) / 100
        assert low == D(10000) * (k + 1)
        if high is not None:
            assert high == low + 10000 and RAP_BANDS[k + 1][0] == high
    assert RAP_FLAT_BASE / MONTHS_PER_YEAR == RAP_MIN_PAYMENT
    # The 1% band dips below $120 just above $10,000, but the $10 floor makes the payment continuous there.
    for agi in (10001, 11000, 11999, 12000):
        assert rap_base_payment(agi) <= RAP_FLAT_BASE and rap_payment(agi) == RAP_MIN_PAYMENT
    assert rap_payment(12001) == D('10.00') and rap_payment(12006) == D('10.01')

    # The studentaid.gov RAP table, rebuilt at every band edge. Half up is the only rounding that fits it:
    for agi, want in SADEF_RAP_TABLE:
        assert rap_payment(agi) == D(want), (agi, rap_payment(agi), want)
    assert cents(rap_base_payment(60001) / 12, ROUND_HALF_EVEN) != D('300.01')   # half-even gives 300.00
    assert cents(rap_base_payment(30001) / 12, ROUND_CEILING) != D('75.00')      # rounding up gives 75.01
    assert cents(D('0.10') * 100000 / 12) == D(SADEF_RAP_ABOVE_100K) and rap_payment(100001) == D('833.34')

    # RAP match, three ways a month can go (statute formula vs "principal falls by max(P - I, min(50, P))").
    for p, i in ((D(30), D('216.67')), (D(250), D('216.67')), (D('466.67'), D(325)), (D(10), D(0)), (D(40), D(5))):
        to_p = max(D(0), p - i)
        assert to_p + rap_match(p, to_p) == max(p - i, min(RAP_MATCH_TARGET, p))

    # studentaid.gov SAQA IBR example (2023 guideline, AGI 40,000, family of 1, 48 states):
    # 150% = 21,870; discretionary 18,130; 10% -> 1,813 -> 151.08 a month; 15% -> 2,719.50 -> 226.63 (226.625 half up).
    assert IBR_POVERTY_MULTIPLE * poverty_guideline(2023, 1) == D(21870)
    assert ibr_discretionary_income(40000, 1, 2023) == D(18130)
    assert ibr_payment(40000, 1, 2023, standard_cap=D(500), new_borrower=True) == D('151.08')
    assert ibr_payment(40000, 1, 2023, standard_cap=D(500), new_borrower=False) == D('226.63')
    assert cents(IBR_RATE_OLD * D(18130) / 12, ROUND_HALF_EVEN) == D('226.62')     # half-even would not match
    # Same page: "$500 under a 10-year Standard Repayment Plan (based on ... $45,000 at ... 6%)" -> 499.59, $500 to the dollar.
    assert standard_payment(45000, D('0.06')) == D('499.59')
    assert cents(level_payment(45000, D('0.06'))).quantize(D(1), rounding=ROUND_HALF_UP) == D(500)
    # IBR floors: $4.99 -> $0, $5.00 -> $10, $9.99 -> $10, cap binds.
    assert ibr_payment(0, 1, 2026, standard_cap=D(300)) == D(0)
    assert ibr_payment(D(15960) * D('1.5') + 599, 1, 2026, standard_cap=D(300)) == D(0)        # 59.9 / 12 = 4.99
    assert ibr_payment(D(15960) * D('1.5') + 600, 1, 2026, standard_cap=D(300)) == D(10)       # 60 / 12 = 5.00
    assert ibr_payment(500000, 1, 2026, standard_cap=D('333.06')) == D('333.06')
    # Exact variants: the $0 / $10 test reads the unrounded amount (59.94 / 12 = 4.995 -> $0; rounded first it would be $10).
    assert ibr_payment(D(15960) * D('1.5') + D('599.40'), 1, 2026, standard_cap=D(300), to_cent=False) == 0
    assert ibr_payment(D(15960) * D('1.5') + D('599.40'), 1, 2026, standard_cap=D(300)) == D(10)
    assert ibr_payment(D(15960) * D('1.5') + 600, 1, 2026, standard_cap=D(300), to_cent=False) == 10
    assert cents(D(rap_payment(60001, to_cent=False).numerator) / D(rap_payment(60001, to_cent=False).denominator)) == D('300.01')
    assert rap_payment(12005, to_cent=False) == F(12005, 1200) and rap_payment(5000, to_cent=False) == 10
    assert cents(D(standard_payment(30000, D('0.06'), to_cent=False).numerator) / D(standard_payment(30000, D('0.06'), to_cent=False).denominator)) == D('333.06')
    assert standard_payment(2000, D('0.05'), to_cent=False) == 50

    # Standard plan: $50 floor, the 120-payment schedule closes to the cent, tiered terms.
    assert standard_payment(2000, D('0.05')) == STANDARD_MIN_PAYMENT
    pay, n, paid, interest = standard_schedule(30000, D('0.06'))
    assert pay == D('333.06') and n == STANDARD_MONTHS and paid == D(30000) + interest
    assert [tiered_standard_years(x) for x in (24999.99, 25000, 49999, 50000, 99999, 100000)] == [10, 15, 15, 20, 20, 25]
    assert STANDARD_MONTHS == STANDARD_YEARS * MONTHS_PER_YEAR
    assert IBR_FORGIVE_PAYMENTS_NEW == IBR_FORGIVE_YEARS_NEW * 12 and RAP_FORGIVE_PAYMENTS == RAP_FORGIVE_YEARS * 12


check_tables()
