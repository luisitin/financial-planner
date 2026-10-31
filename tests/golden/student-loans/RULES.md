# Student loan repayment: the rules behind the answer key

This page backs `tools/golden_student_loans/rules.py`. It covers three ways to repay a federal Direct Loan:

1. **The standard 10-year plan** (loans made before July 1, 2026).
2. **Income-Based Repayment (IBR) for new borrowers** (first loan on or after July 1, 2014 and before July 1, 2026).
3. **The Repayment Assistance Plan (RAP)** (new in 2025 law, open from July 1, 2026).

For each rule you get the plain-words version, the exact source text, the link and the date it was read.
At the end there is one example per plan, worked by hand.

**Independence.** This was written from the law, the regulations, studentaid.gov and the HHS poverty
guideline notices only. Nobody opened `modules/`, `core/` or `tests/*.test.mjs` while writing it, and
`rules.py` never imports or runs the app. The only things taken from `tools/golden_paycheck/` and
`tools/golden_business/` are their layout and conventions; no figure or code is shared.

Run the self-checks with `python3 tools/golden_student_loans/rules.py` (Python 3 standard library
only). Importing the file runs the same checks.

## Sources (all read 2026-10-31)

| Tag | Source | URL |
|---|---|---|
| USC1087E | 20 U.S.C. 1087e (Higher Education Act s.455), Office of the Law Revision Counsel edition "current through Public Law 119-136 (October 22, 2026)" | https://uscode.house.gov/us/usc/119-136/t20/s1087e/ |
| USC1098E | 20 U.S.C. 1098e (HEA s.493C, Income-based repayment), same edition | https://uscode.house.gov/us/usc/119-136/t20/s1098e/ |
| USC1078 | 20 U.S.C. 1078(b)(9)(A)(i) (the standard plan that 1087e(d)(1)(A) points to), same edition | https://uscode.house.gov/us/usc/119-136/t20/s1078/ |
| PL11921 | Public Law 119-21 (July 4, 2025), title VIII: s.82001(d) adds RAP (139 Stat. 341-345); s.82001(f) amends IBR (139 Stat. 345-347) | https://www.govinfo.gov/content/pkg/PLAW-119publ21/html/PLAW-119publ21.htm |
| CFR202 | 34 CFR 685.202 (interest; capitalization), eCFR up to date as of 2026-10-29 | https://www.ecfr.gov/current/title-34/section-685.202 |
| CFR208 | 34 CFR 685.208 (fixed payment plans), eCFR as of 2026-10-29, text from 91 FR 23886 (May 1, 2026) | https://www.ecfr.gov/current/title-34/section-685.208 |
| CFR209 | 34 CFR 685.209 (income-driven plans, including IBR and RAP), eCFR as of 2026-10-29, text from 91 FR 23887 (May 1, 2026) | https://www.ecfr.gov/current/title-34/section-685.209 |
| CFR211 | 34 CFR 685.211(a) (the order a payment is applied in), eCFR as of 2026-10-29 | https://www.ecfr.gov/current/title-34/section-685.211 |
| RISE | Department of Education final rule "Reimagining and Improving Student Education", 91 FR 23768 (May 1, 2026), effective July 1, 2026; p.23838 | https://www.govinfo.gov/content/pkg/FR-2026-05-01/pdf/2026-08556.pdf |
| SADEF | studentaid.gov, "One Big Beautiful Bill Act – Important Definitions" (page says "last updated on Aug. 24, 2026"), section "Repayment Assistance Plan" | https://studentaid.gov/announcements-events/big-updates/definitions#rap |
| SAIDR | studentaid.gov, "Income-Driven Repayment Plans" | https://studentaid.gov/manage-loans/repayment/plans/income-driven |
| SAQA | studentaid.gov, "Questions and Answers About IDR Plans" | https://studentaid.gov/manage-loans/repayment/plans/income-driven/questions |
| SASTD | studentaid.gov, "Standard Repayment Plan" | https://studentaid.gov/manage-loans/repayment/plans/standard |
| PG25 | HHS, "Annual Update of the HHS Poverty Guidelines", 90 FR 5917 (Jan 17, 2025) | https://www.govinfo.gov/content/pkg/FR-2025-01-17/pdf/2025-01377.pdf |
| PG26 | HHS, "Annual Update of the HHS Poverty Guidelines", 91 FR 1797 (Jan 15, 2026), table on p.1798 | https://www.govinfo.gov/content/pkg/FR-2026-01-15/pdf/2026-00755.pdf |
| ASPE | aspe.hhs.gov "Poverty Guidelines" (shows the 2026 tables) | https://aspe.hhs.gov/topics/poverty-economic-mobility/poverty-guidelines |
| PG23 | HHS, 88 FR 3424 (Jan 19, 2023). Used only to rebuild the studentaid.gov IBR example | https://www.govinfo.gov/content/pkg/FR-2023-01-19/pdf/2023-00885.pdf |

The sha256 of every copy read is in the `rules.py` docstring.

Where RAP sits in the code: the 2025 law put RAP in HEA section 455(q), which is **20 U.S.C. 1087e(q)**.
There is no 20 U.S.C. 1098e-1 (uscode.house.gov returns "Page Not Found" for it).

## Things no official source states (the key's own conventions)

| Question | What the key does | Why |
|---|---|---|
| How is a monthly payment rounded? | For display, to the cent, half up (`rules.py`'s `to_cent=True` functions and the `*_monthly` columns). Inside the answer key's schedules, not at all: `loans_key.py` pays the exact payment (`to_cent=False`) and tests IBR's $0 / $10 rule on the exact amount, so 4.995 is under $5 and is $0 (changed 2026-10-31) | No law or regulation says (USC1087E (q), USC1098E, CFR208, CFR209 re-read 2026-10-31: no payment is rounded anywhere in them), so the key imposes no rounding on what is paid. Half up is the only rule that reproduces both studentaid.gov tables. SADEF lists AGI 60,001 as $300.01 (300.005 exactly, so half-even would give 300.00) and AGI 30,001 as $75.00 (75.0025, so rounding up would give 75.01). SAQA rounds 226.625 to $226.63. `check_tables()` asserts all of this. |
| How does interest accrue? | annual rate / 12 on the unpaid principal each month, rounded to the cent | Servicers accrue simple interest daily, and no official monthly formula was found. The brief asks for rate/12. The regulation does say interest is charged "on the unpaid principal balance" (CFR202 (a)(4)), so interest never earns interest unless it is capitalized. |
| Which poverty guideline year applies? | An input to the functions | CFR209 (b)(14) says only "published annually". |
| Last standard payment | Whatever is left (principal plus that month's interest) | CFR208 (b)(1)(ii) allows a smaller final payment. Rounding the fixed payment down can make the last one a few cents larger instead. |

## 1. The standard 10-year plan

**In plain words.** You pay the same amount every month for 120 months. The amount is set so that the
loan and all its interest are gone at the end. The payment is never less than $50; only the last payment
may be smaller. Monthly interest is the annual rate divided by 12.

Payment = B × r / (1 − (1 + r)^−120), with r = annual rate / 12, rounded to the cent, then at least $50.

- USC1078 (b)(9)(A)(i): "a standard repayment plan, with a fixed annual repayment amount paid over a fixed period of time, not to exceed 10 years;"
- USC1087E (d)(1)(A): "a standard repayment plan, consistent with subsection (a)(1) of this section and with section 1078(b)(9)(A)(i) of this title;"
- CFR208 (b)(1)(i): "Under this repayment plan, a borrower must repay a loan in full within ten years from the date the loan entered repayment by making fixed monthly payments."
- CFR208 (b)(1)(ii): "A borrower's payments under this repayment plan are at least $50 per month, except that a borrower's final payment may be less than $50."
- SASTD: "On the Standard Plan, your monthly payments are a fixed amount of **at least $50 each month**. The exact payment amount is calculated so that you pay off the entire loan amount (including the interest that accrues) before the end of your repayment period."
- CFR202 (a)(4)(i) (one example of the wording used for every rate): "the interest rate is 6.8 percent on the unpaid principal balance of the loan."

**Who can still use it.** CFR208 (b)(1) covers borrowers "who have not received a Direct Loan on or after
July 1, 2026". USC1087E (d)(6)(A): "Paragraphs (1) through (4) of this subsection shall only apply to loans
made under this part before July 1, 2026." Anyone with a loan made on or after that date gets the
**Tiered Standard** plan instead, for all their Direct Loans. Its term depends on total principal.
USC1087E (d)(7)(A)(i)(II): "(aa) for a borrower with total outstanding principal of less than $25,000, a
period of 10 years; (bb) ... not less than $25,000 and less than $50,000, a period of 15 years; (cc) ... not
less than $50,000 and less than $100,000, a period of 20 years; and (dd) ... $100,000 or more, a period of 25
years". CFR208 (c)(1)(iii) says the same. The key keeps this table as data (`TIERED_STANDARD_YEARS`).

## 2. Income-Based Repayment (IBR) for new borrowers

**In plain words.** Each year, start from your adjusted gross income (AGI). Take away 1.5 times the HHS
poverty guideline for your family size. What is left is your "discretionary income" (never below $0).
Your monthly payment is 10% of it, divided by 12. It is never more than the 10-year standard payment
figured when you started IBR. A result under $5 means you pay $0; from $5 up to $10 you pay $10. If
interest is more than your payment, the unpaid interest waits on the side. It is not added to the loan
while you stay on the income-based payment. On subsidized loans the government pays it for your first 3
years on the plan. It is added to the loan if you leave IBR or your payment reaches the standard cap.
Whatever is left after 20 years (240 qualifying payments) is forgiven.

Payment = cent( min( 0.10 × max(0, AGI − 1.5 × poverty guideline) / 12 , standard cap ) ), then the $0/$10 rule.

- USC1098E (a)(3), as rewritten by PL11921 s.82001(f)(1)(B): "The term 'applicable amount' means 15 percent of the result obtained by calculating, on at least an annual basis, the amount by which— (A) the borrower's, and the borrower's spouse's (if applicable), adjusted gross income; exceeds (B) 150 percent of the poverty line applicable to the borrower's family size as determined under section 9902(2) of title 42."
- USC1098E (b)(1): "a borrower of any loan made, insured, or guaranteed under part B or D (other than an excepted PLUS loan or excepted consolidation loan), may elect to have the borrower's aggregate monthly payment for all such loans not exceed the applicable amount divided by 12;"
- USC1098E (e): "With respect to any loan made to a new borrower on or after July 1, 2014 and before July 1, 2026— (1) subsection (a)(3)(B) shall be applied by substituting '10 percent' for '15 percent'; and (2) subsection (b)(7)(B) shall be applied by substituting '20 years' for '25 years'."
- CFR209 (b)(1)(ii): "For a new borrower under the IBR plan, 10 percent of the result obtained by calculating on at least an annual basis, the amount of the borrower's adjusted gross income, and the borrower's spouse's adjusted gross income if married filing jointly, that exceeds 150 percent of the poverty guideline;"
- CFR209 (b)(13)(ii) (who is a new borrower): "an individual who has no outstanding balance on a Direct Loan or FFEL program loan before July 1, 2014, and obtains no new loan on or after July 1, 2026, or who has no outstanding balance on such a loan on the date the borrower obtains a loan after July 1, 2014, but before July 1, 2026."
- CFR209 (f)(2): "For new borrowers under the IBR plan and for all borrowers on the PAYE plan, the borrower's monthly payments are the lesser of— (i) 10 percent of the borrower's discretionary income, divided by 12; or (ii) What the borrower would have paid on a 10-year standard repayment plan based on the eligible loan balances and interest rates on the loans at the time the borrower began paying under the IBR or PAYE plans, except that the borrower may repay such loans in excess of 10 years."
- USC1098E (b)(6)(A) (the cap): "the maximum monthly payment required to be paid for all loans made to the borrower under part B or D ... shall be the standard monthly repayment amount".
- CFR209 (g)(1)(iii): "(A) Less than $5, the monthly payment is $0; or (B) Equal to or greater than $5 but less than $10, the monthly payment is $10."
- Married couples. USC1098E (d): "In the case of a married borrower who files a separate Federal income tax return, the Secretary shall calculate the amount of the borrower's income-based repayment under this section solely on the basis of the borrower's student loan debt and adjusted gross income." When a joint filer's spouse also has loans, CFR209 (g)(1)(i) multiplies the payment by "the outstanding principal and interest balance of the borrower's eligible loans" divided by "the couple's combined outstanding principal and interest balance on eligible loans" (the `share` argument).
- SAQA (the agency's own worked example, 2023 guideline): "150% of the 2023 HHS poverty guideline amount is $21,870. The difference between your AGI and 150% of the poverty guideline amount is $18,130 ... Start with 10% of your discretionary income, which in this case is $1,813, then divide that number by 12. This results in a monthly payment of $151.08." The 15% version is "$2,719.50 ... a monthly payment of $226.63". `check_tables()` rebuilds both numbers.

**Unpaid interest.**

- USC1098E (b)(2): "the holder of such a loan shall apply the borrower's monthly payment under this subsection first toward interest due on the loan, next toward any fees due on the loan, and then toward the principal of the loan;". CFR211 (a)(1)(ii) gives the same order for IBR.
- USC1098E (b)(3): "any interest due and not paid under paragraph (2)— (A) shall, on subsidized loans, be paid by the Secretary for a period of not more than 3 years after the date of the borrower's election under paragraph (1), except that such period shall not include any period during which the borrower is in deferment due to an economic hardship ...; and (B) be capitalized— ... (ii) in the case of an unsubsidized loan, at the time the borrower— (I) ends the election to make income-based repayment under this subsection; or (II) begins making payments of not less than the amount specified in paragraph (6)(A);"
- CFR209 (h)(2)(i): "the Secretary does not charge the borrower's account with an amount equal to the amount of accrued interest on the borrower's Direct Subsidized Loans and Direct Subsidized Consolidation Loans that is not covered by the borrower's payment for the first three consecutive years of repayment under the plan".
- CFR209 (j)(2): "Under the IBR plan, the Secretary capitalizes unpaid accrued interest— (i) In accordance with § 685.202(b); (ii) When a borrower's payment is the amount described in paragraphs (f)(2)(ii) and (f)(3)(ii) of this section; and (iii) When a borrower leaves the IBR plan."
- SAQA: "interest that you're responsible for paying but that is not covered by your monthly payment will continue to accumulate and will be capitalized (added to your loan principal balance) if you no longer qualify to make payments based on income. Additionally, the interest will capitalize if you leave the IBR Plan."

**Forgiveness.** CFR209 (k)(2): "a borrower repaying under the IBR plan who is a new borrower ... receives
forgiveness of the remaining balance of the borrower's loans after the borrower has satisfied 240 monthly
payments or the equivalent ... over a period of at least 20 years". SAIDR's table lists "IBR Plan (first
borrowed after July 1, 2014, and before July 1, 2026) | 10% of discretionary income | 20".

**Changes made by the 2025 law (PL11921 s.82001(f)), worth knowing:**

- The "partial financial hardship" entry test is gone. USC1098E's amendment note: "Subsec. (a)(3) ... Prior to amendment, par. (3) defined 'partial financial hardship'". The new (b)(1) has no hardship condition.
- New loans end IBR. CFR209 (d)(5): "only Direct Loans made before July 1, 2026, may be repaid under the PAYE, IBR, and ICR plans". USC1087E (d)(7)(A) gives a borrower with any loan made on or after July 1, 2026 only two choices, the Tiered Standard plan or RAP, "including such a borrower who also has a loan made under this part before such date". SAQA: "if you receive a disbursement on a new loan, including a new consolidation loan, on or after July 1, 2026, then you won't have access to the IBR, ICR, and PAYE plans".
- **A drafting slip, noted but not followed.** USC1098E (e)(1) still says to substitute "10 percent" for "15 percent" in "subsection (a)(3)(B)". In the rewritten (a)(3), however, "15 percent" sits in the lead-in; (a)(3)(B) now reads "150 percent of the poverty line". Read word for word, the substitution has nothing to act on. The regulation (CFR209 (b)(1)(ii), (f)(2)(i)) and studentaid.gov (SAIDR, SAQA) both apply 10% to new borrowers, and the key does the same.
- On-time payments. SADEF: "Starting in spring 2027, payments under the IBR and PAYE plans must be made on time and in full in order for you to receive the interest subsidy." SAQA: "late payments no longer count toward IDR discharge or PSLF starting on July 1, 2026." The key assumes every payment is on time and in full.

**One interpretation.** The cap is "what the borrower would have paid on a 10-year standard repayment plan".
The key computes it with `standard_payment()`, which includes the standard plan's $50 floor. That only
matters for small balances: the level payment is under $50 below about $4,500 at 6%. The caller passes the cap figured on the balance and rates at
the time the borrower entered IBR.

## 3. The Repayment Assistance Plan (RAP)

**In plain words.** Find your AGI's band. Take that band's percent of your **whole** AGI (not just the part
inside the band); that is the yearly "base payment". AGI of $10,000 or less has a flat $120 base. Divide
by 12, then take off $50 for each dependent you claim on your tax return. You never pay less than $10 a
month, and there is no upper cap. If an on-time payment does not cover the month's interest, the rest of
that interest is simply not charged. If an on-time payment cuts your principal by less than $50, the
government cuts it further. It tops up to $50, or to the amount you paid if you paid less than $50.
Whatever is left after 360 qualifying monthly payments (30 years) is cancelled.

Payment = max( $10 , cent( (base / 12 − $50 × dependents) × share ) ), and never more than the balance left.

**Base payment bands** (USC1087E (q)(4)(B)(iv); CFR209 (b)(2); SADEF table). Each band's lower edge is
"more than" and its upper edge is "not more than":

| AGI | Base payment (per year) |
|---|---|
| not more than $10,000 | $120 |
| more than $10,000 and not more than $20,000 | 1% of AGI |
| more than $20,000 and not more than $30,000 | 2% of AGI |
| more than $30,000 and not more than $40,000 | 3% of AGI |
| more than $40,000 and not more than $50,000 | 4% of AGI |
| more than $50,000 and not more than $60,000 | 5% of AGI |
| more than $60,000 and not more than $70,000 | 6% of AGI |
| more than $70,000 and not more than $80,000 | 7% of AGI |
| more than $80,000 and not more than $90,000 | 8% of AGI |
| more than $90,000 and not more than $100,000 | 9% of AGI |
| more than $100,000 | 10% of AGI |

Statute text for each piece (USC1087E (q); the same words are in PL11921 s.82001(d), 139 Stat. 341-345):

- Payment, (q)(1)(A): "The total monthly repayment amount owed by a borrower for all of the loans of the borrower that are repaid pursuant to the Repayment Assistance Plan shall be equal to the applicable monthly payment of a borrower calculated under paragraph (4)(B), except that the borrower may not be precluded from repaying an amount that exceeds such amount for any month."
- Formula, (q)(4)(B)(i): "the term 'applicable monthly payment' means, when used with respect to a borrower, the amount equal to— (I) the applicable base payment of the borrower, divided by 12; minus (II) $50 for each dependent of the borrower (which, in the case of a married borrower filing a separate Federal income tax return, shall include only each dependent that the borrower claims on that return)."
- Minimum, (q)(4)(B)(ii): "In the case of a borrower with an applicable monthly payment amount calculated under clause (i) that is less than $10, the applicable monthly payment of the borrower shall be $10."
- Final payment, (q)(4)(B)(iii): "... is less than the applicable monthly payment calculated pursuant to clause (i) or (ii), as applicable, then the applicable monthly payment of the borrower shall be the total outstanding balance of principal and interest on all such loans."
- Base payment, (q)(4)(B)(iv): "(I) not more than $10,000, is $120; (II) more than $10,000 and not more than $20,000, is 1 percent of such adjusted gross income; ... (XI) more than $100,000, is 10 percent of such adjusted gross income."
- Whole AGI, not a marginal rate. RISE p.23838 answers a request for "a marginal-rate calculation, similar to the U.S. Federal income tax system": "The Department does not have the authority to make such a change. ... Replacing the base payment system envisioned in the Repayment Assistance Plan with a marginal rate calculation as the commenter suggests is inconsistent with the statutory framework of the plan."
- Dependent, (q)(4)(B)(v): "the term 'dependent' means an individual who is a dependent under section 152 of title 26." CFR209 (b)(3) adds "and who were claimed on the borrower's Federal income tax return". SAQA: "To receive the $50 reduction in your monthly payment amount per dependent under RAP, you must have claimed each dependent on your tax return."
- AGI, (q)(4)(A): "the adjusted gross income ... of the borrower (and the borrower's spouse, as applicable) for the most recent taxable year, except that, in the case of a married borrower who files a separate Federal income tax return, the term does not include the adjusted gross income of the borrower's spouse."
- Married, both with loans. CFR209 (g)(3)(i) multiplies the (f)(5) payment by the borrower's share of the couple's eligible loan balance. Then "(B) If a borrower's adjusted monthly payment, as calculated under paragraph (g)(3)(i), is less than $10, the monthly payment is $10."
- Order of application, (q)(1)(B): "The Secretary shall apply the borrower's applicable monthly payment under this paragraph first toward interest due on each such loan, next toward any fees due on each loan, and then toward the principal of each loan." (q)(1)(C): "Any principal due and not paid under subparagraph (B) or paragraph (2)(B) shall be deferred."
- Interest waiver, (q)(2)(A): "for each month for which such a borrower makes an on-time applicable monthly payment required under paragraph (1)(A) and such monthly payment is insufficient to pay the total amount of interest that accrues for the month on all loans of the borrower repaid pursuant to the Repayment Assistance Plan under this subsection, the amount of interest accrued and not paid for the month shall not be charged to the borrower." CFR209 (h)(4)(i) says the same. SADEF: "your total outstanding balance will never go higher than your total outstanding balance when you entered RAP" (for on-time, full payments with no breaks).
- Principal match, (q)(2)(B): "for each month for which a borrower makes an on-time applicable monthly payment required under paragraph (1)(A) and such monthly payment reduces the total outstanding principal balance of all loans of the borrower repaid pursuant to the Repayment Assistance Plan under this subsection by less than $50, the Secretary shall reduce such total outstanding principal balance of the borrower by an amount that is equal to— (i) the amount that is the lesser of— (I) $50; or (II) the total amount paid by the borrower for such month pursuant to paragraph (1)(A); minus (ii) the total amount paid by the borrower for such month pursuant to paragraph (1)(A) that is applied to such total outstanding principal balance." SADEF in plain words: "When a borrower's on-time payment reduces their principal by less than $50, we make a matching payment to ensure the principal is reduced by $50 for the month. However, if the borrower's scheduled monthly payment is less than $50, we make a matching payment to ensure the principal is reduced by an amount equal to the borrower's payment."
- Forgiveness, (q)(1)(E): "The Secretary shall cancel any outstanding balance of principal and interest due on a loan ... to a borrower— (i) who, for any period of time, participated in the Repayment Assistance Plan under this subsection; (ii) whose most recent payment for such loan prior to the loan cancellation under this subparagraph was made under such Repayment Assistance Plan; and (iii) who has made 360 qualifying monthly payments on such loan." CFR209 (k)(7): "after the borrower has satisfied 360 monthly payments or the equivalent ... over a period of at least 30 years."
- No cap. SAIDR: "There is no cap on your monthly payment amount under RAP. For example, you could pay more per month under RAP than you would under the Standard Repayment Plan or the Tiered Standard Plan."
- If income is not provided, (q)(4)(B)(vi): the payment becomes "the sum of the monthly payment amounts the borrower would have paid for each of the borrower's loans ... under a standard repayment plan with a fixed monthly repayment amount, paid over a period of 10 years, based on the outstanding principal due on such loan when such loan entered repayment". This is not modelled.

**studentaid.gov's own payment table** (SADEF, "Monthly Payment Amount Based on Your AGI Range", no
dependents). `check_tables()` rebuilds every edge to the cent:
$0–$10,000 → $10.00 · $10,001–$20,000 → $10.00–$16.67 · $20,001–$30,000 → $33.34–$50.00 ·
$30,001–$40,000 → $75.00–$100.00 · $40,001–$50,000 → $133.34–$166.67 · $50,001–$60,000 → $208.34–$250.00 ·
$60,001–$70,000 → $300.01–$350.00 · $70,001–$80,000 → $408.34–$466.67 · $80,001–$90,000 → $533.34–$600.00 ·
$90,001–$100,000 → $675.01–$750.00 · more than $100,000 → "At least $833.33".
The last row is 10% × 100,000 / 12. That figure is a lower bound, not a payment anyone makes, because
AGI of $100,001 gives $833.34.

**A quirk of the bands.** Just above $10,000 the 1% band gives a smaller base than the flat $120
($100.01 at $10,001). The $10 floor hides this, so the payment is $10.00 all the way to AGI $12,005 and
first reaches $10.01 at $12,006. Above that, every band edge jumps. At $40,000 one dependent pays $50.00;
at $40,001 the same person pays $83.34.

## HHS poverty guidelines, 48 contiguous states and DC

| Persons | 2025 (PG25, 90 FR 5917) | 2026 (PG26, 91 FR 1798; ASPE) |
|---|---|---|
| 1 | $15,650 | $15,960 |
| 2 | 21,150 | 21,640 |
| 3 | 26,650 | 27,320 |
| 4 | 32,150 | 33,000 |
| 5 | 37,650 | 38,680 |
| 6 | 43,150 | 44,360 |
| 7 | 48,650 | 50,040 |
| 8 | 54,150 | 55,720 |
| each additional person | $5,500 | $5,680 |

- PG25: "For families/households with more than 8 persons, add $5,500 for each additional person." Effective "January 15, 2025 unless an office administering a program using the guidelines specifies a different effective date for that particular program."
- PG26 / ASPE: "For families/households with more than 8 persons, add $5,680 for each additional person." Effective date: January 13, 2026. ASPE notes that because of the October 2025 shutdown, the 2026 figures compare "the average CPI-U for the 11 available months of 2025 (excluding October) with the average CPI-U for all 12 months of 2024."
- Both years step by exactly the per-person amount from 1 to 8 persons, so the 1-person base plus the step rebuilds every row (`check_tables()` asserts this). `rules.py` also has the Alaska and Hawaii tables for both years. 2025: Alaska $19,550 + $6,880, Hawaii $17,990 + $6,330. 2026: Alaska $19,950 + $7,100, Hawaii $18,360 + $6,530. CFR209 (b)(14): a borrower not resident in a listed State uses the 48-contiguous-states figure.

## Worked by hand

Every household here is invented. Interest is rate/12 on principal, rounded to the cent each month.

### Example 1: standard 10-year plan

A $30,000 Direct Loan at 6.00%, made before July 1, 2026, entering repayment. (A loan made on or after
July 1, 2026 would get the Tiered Standard plan, which for $30,000 is 15 years.)

1. r = 0.06 / 12 = 0.005. (1.005)^120 = 1.8193967.
2. Payment = 30,000 × 0.005 × 1.8193967 / (1.8193967 − 1) = 150 × 2.2204100 = 333.0615. To the cent: **$333.06**. That is above $50, so the floor does not apply.
3. Month 1: interest 30,000 × 0.005 = $150.00; principal paid 333.06 − 150.00 = $183.06; balance $29,816.94.
4. Month 2: interest 29,816.94 × 0.005 = 149.0847, which is $149.08; principal paid $183.98; balance $29,632.96.
5. After 119 payments of $333.06 ($39,634.14), month 120 owes the rest plus $1.66 of interest: **$333.29**. The extra 23 cents comes from rounding the payment down by 0.15 cents each month. Total paid **$39,967.43**, of which interest is **$9,967.43**.
6. Check against the agency: SAQA quotes "$500 under a 10-year Standard Repayment Plan (based on a loan debt amount of $45,000 at an interest rate of 6%)". The formula gives $499.59, which is $500 to the dollar.

### Example 2: IBR, new borrower

A borrower who first borrowed in 2016, filing single, family size 3 (the borrower and two children who get
more than half their support from the borrower). AGI $45,000. Lives in the 48 contiguous states. Owes
$50,000 of unsubsidized Direct Loans at 6.50%, and entered IBR with that same balance.

1. Poverty guideline, 2026, 3 persons: $27,320 (= 15,960 + 2 × 5,680). 150% of it = **$40,980**.
2. Discretionary income = 45,000 − 40,980 = **$4,020**.
3. 10% = $402.00; ÷ 12 = **$33.50**.
4. Cap = the 10-year standard payment on $50,000 at 6.50%. r = 0.0054167, (1 + r)^120 = 1.912181, payment = 270.8333 × 1.912181 / 0.912181 = 567.7399, which is $567.74. $33.50 is less, so the cap does not bind.
5. $33.50 is $10 or more, so the $0/$10 rule does not apply. Payment: **$33.50 a month**.
6. With the 2025 guideline instead: 26,650 × 1.5 = 39,975; 45,000 − 39,975 = 5,025; 10% = 502.50; ÷ 12 = 41.875, which is **$41.88** (half up).
7. Interest. Month 1 accrues 50,000 × 0.065 / 12 = 270.8333, which is $270.83. The $33.50 goes entirely to interest. $237.33 stays unpaid, and principal stays $50,000.00. Month 2 accrues another $270.83, on the principal only, not on the $237.33. Unpaid interest reaches $474.66. After 12 months: principal **$50,000.00**, unpaid interest **$2,847.96** (12 × 237.33), not added to the loan. If the borrower then leaves IBR (or the payment reaches the $567.74 cap), it is capitalized: principal becomes **$52,847.96**. If these were subsidized loans, the $237.33 a month would not be charged at all for the first 3 years on the plan.
8. Forgiveness: whatever is left after 240 qualifying monthly payments over at least 20 years.

### Example 3: RAP

**(a) Low income, one dependent.** Single parent filing as head of household, 1 dependent claimed, AGI
$32,000. Owes $40,000 at 6.50%.

1. Band: more than $30,000 and not more than $40,000, so 3% of the whole AGI: 0.03 × 32,000 = **$960** base payment.
2. 960 / 12 = $80.00; minus $50 × 1 = **$30.00**. That is at least $10, so the payment is **$30.00**.
3. Month 1: interest 40,000 × 0.065 / 12 = 216.6667, which is $216.67. The $30.00 goes to interest. The other **$186.67 is not charged** (q)(2)(A). The payment put $0 on principal, which is less than $50, so the match is min(50, 30) − 0 = **$30.00**. Principal falls to **$39,970.00**.
4. Month 2: interest 39,970 × 0.065 / 12 = 216.5042, which is $216.50. $186.50 is waived, the match is $30.00, and principal is **$39,940.00**. Principal falls by exactly what the borrower pays, and the balance never grows.

**(b) Payment just above the interest.** Same loan, AGI $60,000, no dependents.

1. $60,000 is "not more than $60,000", so the 5% band: 3,000 / 12 = **$250.00**.
2. Month 1: interest $216.67; principal paid 250.00 − 216.67 = $33.33, which is less than $50. Match = min(50, 250) − 33.33 = **$16.67**. Principal falls by exactly $50, to **$39,950.00**.

**(c) The cliff at a band edge.** One dependent. AGI $40,000: 3% → 1,200 / 12 = 100.00 − 50 = **$50.00**.
AGI $40,001: 4% → 1,600.04 / 12 = 133.3367 − 50 = 83.3367, which is **$83.34**.

**(d) Married filing jointly.** AGI $85,000, 2 dependents. 8% band: 6,800 / 12 = 566.6667; minus $100 =
466.6667, which is **$466.67**. If the spouse also has eligible loans and this borrower owes 60% of the
couple's eligible balance: 0.6 × 466.6667 = **$280.00** (CFR209 (g)(3)(i)). With no spouse loans and a
$60,000 balance at 6.50%: interest $325.00, principal paid $141.67 (at least $50, so no match), new
principal $59,858.33.

Forgiveness: whatever is left after 360 qualifying monthly payments, over at least 30 years.

## Out of scope (named so nobody assumes they are covered)

Public Service Loan Forgiveness. Deferment and forbearance months. Late or partial payments (RAP's waiver
and match need an on-time payment). Payments larger than the amount due, which can shrink the match
(CFR209 (o)(2)(ii) and (o)(3)). PAYE, ICR and SAVE. Parent PLUS and "excepted" loans. FFEL loans. The
autopay rate cut. Tax on forgiven balances. On that last point, studentaid.gov's "Top FAQs About Income-Driven Repayment Plans"
(https://studentaid.gov/articles/faqs-idr-plan/, "Published: August 2026", read 2026-10-31) says a
discharge "On or after Jan. 1, 2026" is "Taxed as income".
