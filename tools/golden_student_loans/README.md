# Student loan answer key: the standard plan, IBR and RAP

One independent answer key for the student-loans page:

| Script | Writes | Rows | What it checks |
|---|---|---|---|
| `loans_key.py` | `tests/golden/student-loans/loans.csv` | 2,000 | one federal Direct Loan balance repaid three ways: the 10-year standard plan, Income-Based Repayment for new borrowers, and the Repayment Assistance Plan. For each it gives the first monthly payment, the number of months paid, the total paid and the amount forgiven, with income held flat for the life of the plan |

`rules.py` holds every figure as data, with its source and the date it was read on the same line,
plus the payment functions. `tests/golden/student-loans/RULES.md` gives each rule in plain words with
the statute text, and works one example per plan by hand. Those examples are rows `sl-edge-341` to
`sl-edge-348` of the CSV.

**Independence.** This key was written from the law (20 U.S.C. 1087e, 1098e, 1078; Pub. L. 119-21),
the regulations (34 CFR 685.202, 685.208, 685.209, 685.211), the Department of Education's May 1, 2026
final rule, studentaid.gov and the HHS poverty guideline notices. Nobody opened `modules/`, `core/` or
`tests/*.test.mjs` while writing it, and it never imports or runs the app. The only things taken from
`tools/golden_paycheck/` and `tools/golden_business/` are their layout and conventions; no figure or
code is shared. The script works every row in two separate ways, both in exact arithmetic. It refuses
to write the CSV if any column differs by more than a cent or any month count differs. In fact the two
agree exactly, before rounding, on every column of every row.

## Run

```
python3 tools/golden_student_loans/loans_key.py
```

Python 3 standard library only (made with 3.13; about 25 seconds). The run is deterministic
(`random.Random(20261031)`), so a second run writes a byte-identical file. The script sets
`sys.dont_write_bytecode` *before* it imports `rules.py`, so no `__pycache__` lands in the repo.
Importing `rules.py` runs its table checks. The run also checks the payments against RULES.md's
worked examples and the studentaid.gov RAP table, then prints its coverage.

## Sources

The figures and the payment rules are those of `rules.py`. Its author read every source below on
2026-10-31, and the `rules.py` docstring gives the sha256 of each copy. For this key, 34 CFR 685.209
was downloaded again on 2026-10-31 from the eCFR (version of 2026-10-29). Its sha256 is
`6c6316a8...178ac22ae1`, the same copy `rules.py` names. Paragraphs (h)(4)(i), (j)(2), (k)(2), (k)(4)(i)(A),
(k)(7) and (o)(2)(i) were read again in it.

| Tag | Source | URL | Used for |
|---|---|---|---|
| USC1087E | 20 U.S.C. 1087e (HEA s.455), Office of the Law Revision Counsel edition "current through Pub. L. 119-136 (Oct 22, 2026)" | https://uscode.house.gov/us/usc/119-136/t20/s1087e/ | (d)(1)(A), (d)(6)(A) standard plan; (q) RAP: (q)(1)(B) payment order, (q)(1)(E) forgiveness, (q)(2)(A) interest not charged, (q)(2)(B) matching principal payment, (q)(4)(B)(i)-(iv) payment, $10 minimum, final payment, base payment bands |
| USC1098E | 20 U.S.C. 1098e (HEA s.493C, IBR), same edition | https://uscode.house.gov/us/usc/119-136/t20/s1098e/ | (a)(3) 150% of the poverty line; (b)(1) divided by 12; (b)(2) payment order; (b)(3) unpaid interest and when it is capitalized; (b)(6)(A) standard cap; (e) 10% and 20 years for new borrowers |
| USC1078 | 20 U.S.C. 1078(b)(9)(A)(i), same edition | https://uscode.house.gov/us/usc/119-136/t20/s1078/ | the standard plan: fixed payments over at most 10 years |
| PL11921 | Pub. L. 119-21 (July 4, 2025), s.82001(d) RAP (139 Stat. 341-345), s.82001(f) IBR (139 Stat. 345-347) | https://www.govinfo.gov/content/pkg/PLAW-119publ21/html/PLAW-119publ21.htm | the 2025 text of both |
| CFR202 | 34 CFR 685.202(a) | https://www.ecfr.gov/current/title-34/section-685.202 | interest is charged "on the unpaid principal balance" |
| CFR208 | 34 CFR 685.208(b)(1) | https://www.ecfr.gov/current/title-34/section-685.208 | 10 years of fixed monthly payments; "at least $50 per month, except that a borrower's final payment may be less than $50" |
| CFR209 | 34 CFR 685.209 | https://www.ecfr.gov/current/title-34/section-685.209 | (f)(2) IBR payment and cap; (g)(1)(iii) $0 / $10; (h)(4)(i) RAP interest not charged; (k)(2) 240 IBR payments; (k)(4)(i)(A) a month with "a monthly payment obligation of $0" counts toward IBR forgiveness; (k)(7) 360 RAP payments; (o)(2)(i) the RAP match |
| CFR211 | 34 CFR 685.211(a) | https://www.ecfr.gov/current/title-34/section-685.211 | interest first, then fees, then principal |
| RISE | ED final rule, 91 FR 23768 (May 1, 2026), p.23838 | https://www.govinfo.gov/content/pkg/FR-2026-05-01/pdf/2026-08556.pdf | the RAP percent applies to the whole AGI, not a marginal slice |
| SADEF | studentaid.gov, "One Big Beautiful Bill Act - Important Definitions" (updated Aug. 24, 2026), Repayment Assistance Plan | https://studentaid.gov/announcements-events/big-updates/definitions#rap | the RAP payment table (rebuilt to the cent; it pins half-up rounding) |
| SAQA | studentaid.gov, "Questions and Answers About IDR Plans" | https://studentaid.gov/manage-loans/repayment/plans/income-driven/questions | the IBR worked example (226.625 rounds to 226.63) |
| PG25 | HHS poverty guidelines, 90 FR 5917 (Jan 17, 2025) | https://www.govinfo.gov/content/pkg/FR-2025-01-17/pdf/2025-01377.pdf | 2025 guideline, 48 states and DC |
| PG26 | HHS poverty guidelines, 91 FR 1797 (Jan 15, 2026), table p.1798; ASPE page the same | https://www.govinfo.gov/content/pkg/FR-2026-01-15/pdf/2026-00755.pdf | 2026 guideline, 48 states and DC |

## Figures

| Figure | Value | Source |
|---|---|---|
| Standard term | 120 monthly payments | USC1078 (b)(9)(A)(i); CFR208 (b)(1)(i) |
| Standard minimum | $50 a month (the last payment may differ) | CFR208 (b)(1)(ii) |
| IBR (new borrower) | 10% x max(0, AGI - 150% x poverty guideline) / 12, at most the 10-year standard payment; under $5 is $0, $5 to under $10 is $10 | USC1098E (a)(3), (b)(1), (b)(6)(A), (e)(1); CFR209 (f)(2), (g)(1)(iii) |
| IBR forgiveness | after 240 monthly payments | USC1098E (e)(2); CFR209 (k)(2) |
| RAP base payment | $120 if AGI is $10,000 or less; else 1% ... 10% of the whole AGI by $10,000 bands (each band is "more than" its lower edge and "not more than" its upper edge) | USC1087E (q)(4)(B)(iv); CFR209 (b)(2); RISE p.23838 |
| RAP payment | base / 12 - $50 per dependent, at least $10, no cap | USC1087E (q)(4)(B)(i)-(ii); CFR209 (f)(5), (g)(3) |
| RAP match | if the payment cuts principal by less than $50: min($50, amount paid) - the part that went to principal | USC1087E (q)(2)(B); CFR209 (o)(2)(i) |
| RAP forgiveness | after 360 qualifying monthly payments | USC1087E (q)(1)(E)(iii); CFR209 (k)(7) |
| Poverty guideline, 48 states + DC | 2025: $15,650 + $5,500 per extra person; 2026: $15,960 + $5,680 | PG25; PG26 |

## Who each row is

Every row is an invented borrower who:

- has only Direct Loans made before July 1, 2026. So the 10-year standard plan applies, not the
  Tiered Standard plan, and IBR is open (CFR208 (b)(1); CFR209 (d)(5));
- first borrowed on or after July 1, 2014, which makes them an IBR "new borrower" (10%, 20 years);
- has one balance (`balance`) at one rate (`annual_rate`), unsubsidized, entering repayment today, and
  enters IBR or RAP with that balance;
- lives in the 48 contiguous states or DC;
- has no spouse with eligible loans, so the IBR and RAP payments are not split (`share` = 1). `agi` is
  whatever AGI counts: a joint return's if married filing jointly, the borrower's own if filing
  separately;
- pays every bill on time and in full, never more, with no deferment or forbearance;
- keeps the same `agi`, `family_size` and `dependents` for the life of each plan. The poverty guideline
  of `guideline_year` is used for every year.

## How each row is worked (derivation 1: the statute, month by month)

Money is exact (`fractions.Fraction`). Nothing is rounded inside a schedule, the monthly payment
included: no statute or regulation says how a payment is rounded (see "Rounding"). Interest is principal x `annual_rate` / 12 each month,
exactly. It is never rounded and never charged on unpaid interest. Each payment goes to interest
first, then principal.

1. **The three payments** come from `rules.py`:
   - `standard_monthly` = `rules.standard_payment(..., to_cent=False)`: B r / (1 - (1 + r)^-120), r = rate / 12, at least $50;
   - `ibr_monthly` = `rules.ibr_payment(..., to_cent=False)` with the cap = the standard payment on the
     balance the borrower entered IBR with: min(raw, cap), then under $5 is $0 and $5 to under $10 is $10;
   - `rap_monthly` = `rules.rap_payment(..., to_cent=False)`: max($10, base / 12 - $50 x dependents).
   All three are exact; the columns show them half up to the cent.
2. **Standard.** Each month pays `standard_monthly`, except the payment that clears the loan, which
   is what is left: principal plus that month's interest. With the exact payment, payment 120 is
   exactly the level payment. With the $50 floor the loan is gone before month 120 (CFR208 lets the
   final payment be less). `standard_forgiven` is always 0.
3. **IBR.** Each month: interest accrues on principal. The payment goes first to the unpaid interest
   carried so far plus this month's interest, then to principal. Interest the payment does not cover
   is carried as unpaid interest. It is not capitalized (see the open points) and it is paid before
   any principal. If principal + unpaid interest + this month's interest is no more than the payment,
   that amount is paid and the loan is gone. A $0 bill still counts as a month. After the 240th month,
   `ibr_forgiven` = principal + unpaid interest left.
4. **RAP.** Each month: interest accrues on principal. If principal + this month's interest is less
   than the payment, that amount is paid and the loan is gone ((q)(4)(B)(iii)). Otherwise the payment
   goes to interest. Any interest it does not cover is not charged ((q)(2)(A)). The rest goes to
   principal. If that cuts principal by less than $50, the Secretary cuts it by min($50, payment)
   minus the part of the payment that went to principal ((q)(2)(B)), but never below 0. After the
   360th payment, `rap_forgiven` = the principal left. No unpaid interest can be left.
5. `*_months` counts the payments made, the last one included (240 or 360 when the plan ends in
   forgiveness). `*_total_paid` is what the borrower paid; RAP's matching payments are not in it.

### Rounding

- Payments: **exact inside the schedules** (changed 2026-10-31). An earlier version paid the payment
  rounded half up to the cent, on the grounds that a borrower pays whole cents. A check against the
  sources found that none of them rounds a payment: USC1087E (q)(4)(B), USC1098E (a)(3) and (b)(1),
  CFR208 (b)(1) and CFR209 (f)-(g) give the formulas and the $0 / $10 / $50 floors, and say nothing about
  cents (the only roundings in 1087e and 685.202 are consolidation interest rates, "rounded to the
  nearest higher one-eighth of one percent"). Half up stays the display rule: `rules.py`'s
  `to_cent=True` functions still rebuild the studentaid.gov tables to the cent, and the `*_monthly`
  columns are the exact payment half up. That earlier rounding was the whole cause of the old to-do
  lists `ibr-cap-121st-payment` (91 rows), `ibr-payment-not-rounded` (62) and `rap-payment-not-rounded`
  (252), which are gone.
- The IBR $0 / $10 test reads the exact calculated amount, as CFR209 (g)(1)(iii) words it ("the
  borrower's monthly payment amount calculated under paragraphs (f)(1) through (3) ... is less than
  $5"). So discretionary income of $599.40 gives 4.995, which is less than $5: $0 (`sl-edge-114` and the
  same offset for every family size and year). The earlier version rounded first and gave $10.
- Every other column is exact until it is written, then rounded half up to the cent once. 351 written
  values sit exactly on a half cent before rounding (most are `*_monthly` payments such as 54.375, and
  totals of a half-cent payment over an even number of months), for example `sl-edge-333`, whose
  `rap_total_paid` of 2,014.025 is written as 2,014.03. On those rows a binary float with
  `Math.round(x * 100) / 100` can be a cent off. The RAP or IBR payment itself is exactly on a half cent
  on 222 and 117 rows respectively (for example `sl-edge-093` to `-108`, `-269` to `-278`).
- **This differs from RULES.md's hand examples**, which round each month's interest to the cent
  (`rules.monthly_interest`, `rules.standard_schedule`). The key follows its brief instead: round only
  the outputs. If interest were rounded every month (with the cent-rounded payment of
  `rules.standard_schedule`), `standard_total_paid` would change on 1,895 rows, by at most $0.39. `standard_months` would change on none. The run prints both counts. For example,
  RULES.md example 1 totals $39,967.43; `sl-edge-341` has $39,967.45. RULES.md example 2's unpaid
  interest after 12 months is $2,847.96; exact interest gives 12 x (270.8333... - 33.50) = $2,848.00.

## The other way, run on every row before the CSV is written (derivation 2: closed forms)

Written separately from derivation 1 and from `rules.py`'s functions, also in exact Fractions:

- **Payments.**
  - The poverty line is the 1-person figure plus the per-person step (`rules.POVERTY_BASE_1`,
    `POVERTY_PER_PERSON`), not the table lookup.
  - The standard payment is B r g^120 / (g^120 - 1), with g = 1 + r, in exact Fractions.
  - IBR is max(0, AGI - 3/2 x line) / 120.
  - The RAP band comes from arithmetic: ceil(AGI / 10,000) - 1, at most 10, not from the band table.
  - Rounding is floor(100x + 1/2) / 100.
- **Standard and IBR schedules**, closed form.
  - Principal after i months is B g^i - P (g^i - 1) / r. The payoff month is the first i with
    principal x g <= P, found by bisection.
  - The standard plan stops at month 120.
  - For IBR, if P is no more than the first month's interest, principal never moves. That gives 240
    months, 240 P paid, and B + 240 (rB - P) forgiven.
- **RAP schedule**, closed form.
  - Principal falls by max(P - interest, min($50, P)) a month.
  - While principal is at least T = (P - 50) / r (always, when P <= $50), the fall is the constant
    c = min($50, P), a straight line. The loan ends on the line at month ceil(B / c), paying
    min(P, principal x g).
  - Below T it amortizes like a normal loan at P. The line's month count is found by arithmetic, the
    curve's by the geometric series and bisection.
  - Forgiveness is B - 360 c on the line, or the curve's principal after month 360.

The two derivations agree exactly on all 12 output columns of all 2,000 rows: 0 columns differ at all
before rounding. To show the guard works, three deliberate mistakes were run against it, each in only
one derivation:

| Mistake | Result |
|---|---|
| a $40 RAP match target | refused at `sl-edge-027` |
| IBR capitalizing every 12 months | refused at `sl-edge-001` |
| half-even RAP rounding | stopped by the studentaid.gov table check before any row |

In all three runs no CSV was written.

## The generator

348 edge rows (`sl-edge-001` to `sl-edge-348`), then 1,652 random rows (`sl-0001` to `sl-1652`).

| Rows | What they pin down |
|---|---|
| `sl-edge-001` to `-092` | every RAP band edge, each twice (once with 0 dependents, once random): AGI 0, 0.01, 1, 9,999.99, 10,000, 10,000.01, 10,001, 12,005, 12,006 (the last $10.00 / first $10.01 with no dependents), then for 20,000 ... 100,000 the edge - 0.01, the edge, + 0.01 and + 1 (studentaid.gov's rows), and 250,000 |
| `-093` to `-108` | RAP payments exactly on a half cent, 2 per band (none exist in the 4% and 8% bands: 4 x AGI or 8 x AGI is never 6 mod 12) |
| `-109` to `-268` | IBR at 150% of the poverty line, every family size 1-8, both years: discretionary income -0.01, 0, 0.01, 599, 599.39, 599.40, 600, 1,199, 1,199.40, 1,200 (raw payment 4.99 / 4.995 / 5.00 / 9.99 / 9.995 / 10.00) |
| `-269` to `-278` | IBR payments exactly on a half cent (discretionary income 3 mod 6) |
| `-279` to `-314` | IBR at the cap, 6 households x raw payment = cap - 0.00508, - 0.005, - 0.00008, + 0, + 0.00008, + 0.005 |
| `-315` to `-326` | the standard $50 floor: level payment 49.99 / 50.00 / 50.01 at 3.0%, 5.5%, 6.8%, 9.0% |
| `-327` to `-330` | balance exactly 1,000 and 200,000 |
| `-331` to `-340` | RAP at $50.20 and $50.10 ending on the line, $50.10 ending on the curve (with a half-cent last payment), exactly $50.00, payment = interest, principal part exactly $50, payment above the whole balance; IBR payment exactly equal to the interest (both years) |
| `-341` to `-348` | RULES.md's examples 1, 2 (2026 and 2025 lines), 3a, 3b, 3c (40,000 and 40,001), 3d |

Random rows:

- **Balance:** log-uniform from 1,000 to 200,000 in cents in 70% of rows, whole hundreds in 20%,
  whole thousands in 10%.
- **Rate:** uniform from 0.030 to 0.090 in steps of 0.001.
- **Guideline year:** 2025 or 2026, equal odds.
- **Family size:** 1-8, with weights 30/20/18/14/8/5/3/2.
- **Dependents:** uniform from 0 to family size - 1.
- **AGI**, whole dollars unless noted:
  - 10% of rows: under 150% of the poverty line for the household;
  - 20%: uniform 0 to 60,000;
  - 15%: uniform 60,000 to 120,000;
  - 40%: log-uniform 10,000 to 250,000;
  - 10%: uniform 0 to 250,000, with cents;
  - 5%: within $5 of a RAP band edge.

## Coverage (from the run)

| | Rows |
|---|---|
| total | 2,000 (348 edge, 1,652 random) |
| guideline year 2025 / 2026 | 1,003 / 997 |
| family size 1 / 2 / 3 / 4 / 5 / 6 / 7 / 8 | 569 / 343 / 378 / 285 / 166 / 120 / 85 / 54 |
| dependents 0 / 1 / 2 / 3 / 4 / 5 / 6 / 7 | 1,001 / 435 / 282 / 138 / 72 / 38 / 22 / 12 |
| rate exactly 0.030 / 0.090 | 49 / 44 |
| AGI with cents / balance with cents | 303 / 1,389 |
| AGI under 150% of the poverty line | 785 |
| **RAP band** flat $120 (AGI <= 10,000) | 125 |
| RAP band 1% / 2% / 3% / 4% / 5% | 290 / 222 / 202 / 166 / 134 |
| RAP band 6% / 7% / 8% / 9% / 10% | 128 / 110 / 109 / 96 / 418 |
| RAP $10 minimum applies | 387 |
| RAP dependents lower the payment | 911 |
| RAP month 1: interest not charged (payment < interest) / principal match | 987 / 1,168 |
| RAP payment more than principal + first month's interest (paid off in 1 payment) | 15 |
| RAP paid off / forgiven after 360 payments / paid off exactly at payment 360 | 1,025 / 975 / 2 |
| **IBR $0** | 877 |
| IBR $10 minimum (raw $5 to under $10) | 56 |
| IBR payment = the standard cap / raw payment above the cap | 535 / 535 |
| IBR 0 < payment < first month's interest (unpaid interest builds for 20 years) | 376 |
| IBR paid off / forgiven after 240 months / paid off exactly at month 240 | 658 / 1,342 / 1 |
| IBR at the cap needing a 121st payment | 0 |
| standard $50 floor / paid off before month 120 | 404 / 398 |
| standard 120th payment larger than the others | 0 |
| written values exactly on a half cent | 351 |
| largest RAP / IBR payment | 2,083.33 / 1,679.19 |

## CSV columns

`case_id, balance, annual_rate, agi, family_size, dependents, guideline_year, standard_monthly,
ibr_monthly, rap_monthly, standard_months, standard_total_paid, standard_forgiven, ibr_months,
ibr_total_paid, ibr_forgiven, rap_months, rap_total_paid, rap_forgiven`

- **Inputs:** `balance` and `agi` have two decimals. `annual_rate` is a fraction with three decimals
  (`0.065` = 6.5%). `family_size` is the IBR family size (1-8). `dependents` is the RAP dependents
  claimed on the return (0 to family size - 1). `guideline_year` is 2025 or 2026.
- **Payments:** the first month's payment of each plan.
  - `ibr_monthly` is after the cap and the $0 / $10 rule.
  - `rap_monthly` is after the dependent reduction and the $10 minimum. It is the scheduled amount,
    **not** limited by the balance: on 15 rows it is more than the whole debt, and the only payment
    made is smaller.
- **Schedules:** `*_months` are whole numbers. All money has two decimals. `standard_forgiven` is
  always `0.00`.

## Open points (judgement calls a reviewer should know)

1. **Only outputs are rounded, and the payment inside a schedule is exact.** No statute or regulation
   rounds a payment (see "Rounding"), so the key does not impose a rounding rule on the schedules.
   An app that pays a cent-rounded payment would differ on the totals: up to 120 x half a cent on the
   standard plan, more on 240 or 360 months, and an IBR payment at a cap rounded down would take a
   121st payment of a few cents.
2. **Monthly interest is rate / 12, exact, on principal only.** Servicers accrue daily. `rules.py` and
   RULES.md round each month's interest to the cent. See "Rounding" for the size of that difference.
3. **The last standard payment is whatever is left.** With the exact payment that is the level
   payment itself in month 120, or less in the month a $50-floor loan is paid off.
4. **IBR at the cap has no 120-month catch-all.** IBR may run past 10 years (CFR209 (f)(2)(ii)), so a
   borrower pays `ibr_monthly` until the loan is gone. At the exact cap that is 120 payments; a raw
   payment a fraction of a cent under the cap leaves a few cents for a 121st payment (21 rows have
   121 months).
5. **IBR unpaid interest is never capitalized in this key.** The statute capitalizes it when the
   borrower leaves IBR or starts paying the capped amount (USC1098E (b)(3)(B); CFR209 (j)(2)). With
   income flat the payment never changes, so the first event never happens. The second is moot: a
   payment at the cap from the start always covers the interest, so nothing is unpaid. `ibr_forgiven`
   is the principal plus the unpaid interest left after month 240. The loans are taken as
   unsubsidized, so the 3-year subsidy (CFR209 (h)(2)(i)) is not modelled.
6. **A $0 IBR bill counts toward the 240.** CFR209 (k)(4)(i)(A) credits "having a monthly payment
   obligation of $0". So a $0 row has `ibr_months` 240, `ibr_total_paid` 0.00, and `ibr_forgiven` =
   balance + 240 months of interest.
7. **The IBR cap includes the $50 floor.** The cap is the standard payment on this balance, the
   balance the borrower entered IBR with, floor included (`rules.py`'s reading). It matters only on
   balances under about $5,180 at 3% down to $3,950 at 9%.
8. **The IBR $0 / $10 test reads the exact amount** (CFR209 (g)(1)(iii)). See `sl-edge-114`: 4.995 is $0.
9. **The RAP final payment** ((q)(4)(B)(iii), "total outstanding balance of principal and interest")
   is taken as principal plus that month's interest. The **match never takes principal below 0**
   (`rules.py`'s assumption). On the last month the match can close the loan while the borrower pays
   the full `rap_monthly`.
10. **`rap_total_paid` excludes the Secretary's matching payments**, and `rap_forgiven` is principal
    only, because RAP leaves no unpaid interest when every payment is on time.
11. **Assumed household:** loans made before July 1, 2026, a new borrower, one loan, the 48 states and
    DC, no spouse with loans, on time and in full, and income, family and dependents flat. The poverty
    guideline year is a fixed input (see "Who each row is").

## What the key leaves out (on purpose)

The Tiered Standard plan (loans made on or after July 1, 2026), the 15% / 25-year IBR for older
borrowers, PAYE, ICR, SAVE, PSLF, subsidized-loan interest benefits, married couples who both have
loans (the `share` adjustment), Alaska and Hawaii guidelines, deferment, forbearance, late or extra
payments, payments credited to future months (CFR209 (o)(2)(ii)), recertification and income
changes, capitalization events, the autopay rate cut, and tax on forgiven balances.
