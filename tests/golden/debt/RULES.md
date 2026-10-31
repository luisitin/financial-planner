# Debt calculators: the rules behind the answer key

This page backs `tools/golden_debt/rules.py`. It covers three pages:

1. **Pay off debts**: several debts paid from one monthly budget, highest rate first (avalanche) or smallest
   balance first (snowball), with the payment of a finished debt rolling to the next one.
2. **Credit cards**: how long the minimum payment takes and what it costs, and whether a balance transfer pays.
3. **Mortgage**: months and interest left, paying extra, paying every two weeks, a recast, and when mortgage
   insurance can come off.

For each rule you get the plain-words version, the exact source text, the link and the date it was read.
At the end there is one example per calculator, worked by hand. The page READMEs are the spec. Where a law or
a regulation says something different, the key follows the source and the difference is written down in
"Where the pages and the sources differ".

**Independence.** This was written from Regulation Z, the Homeowners Protection Act, Fannie Mae's guides and
the CFPB's consumer pages only. Nobody opened `modules/`, `core/` or `tests/*.test.mjs` while writing it, and
`rules.py` never imports or runs the app. The only things taken from `tools/golden_student_loans/` and
`tools/golden_paycheck/` are their layout and conventions; no figure or code is shared. On 2026-10-31 the key was
verified against the pages. To decide which side of each disagreement was wrong, the verifier read the pages' code
and READMEs, and changed two of the key's rules: the balance-transfer payment when no required payment is set, and
the tie-break, which no source decides. Neither change takes a figure from the app (section 5, items 7 to 10).

Run the self-checks with `python3 tools/golden_debt/rules.py` (Python 3 standard library only, under a second).
Importing the file runs the same checks. A script that imports `rules.py` must set `sys.dont_write_bytecode = True`
*before* the import, or Python writes a `__pycache__` folder next to it.

## Sources (all read 2026-10-31)

| Tag | Source | URL |
|---|---|---|
| RZ7 | 12 CFR 1026.7(b)(12), Repayment disclosures (Regulation Z). eCFR title 12 "up to date as of 2026-10-29"; text from 76 FR 79772 (Dec. 22, 2011), as amended at 81 FR 84369 (Nov. 22, 2016) | https://www.ecfr.gov/current/title-12/section-1026.7#p-1026.7(b)(12) |
| RZM1 | 12 CFR part 1026, Appendix M1, "Repayment Disclosures", same eCFR edition | https://www.ecfr.gov/current/title-12/part-1026/appendix-Appendix%20M1%20to%20Part%201026 |
| RZM2 | 12 CFR part 1026, Appendix M2, "Sample Calculations of Repayment Disclosures" (SAS code), same edition | https://www.ecfr.gov/current/title-12/part-1026/appendix-Appendix%20M2%20to%20Part%201026 |
| RZSUP | 12 CFR part 1026, Supplement I (Official Interpretations), comments 7(b)(12)-1, 7(b)(12)(i)(F)-1, 7(b)(12)(v)-1 | https://www.ecfr.gov/current/title-12/part-1026/appendix-Supplement%20I%20to%20Part%201026 |
| RZ53 | 12 CFR 1026.53(a), Allocation of payments | https://www.ecfr.gov/current/title-12/section-1026.53 |
| RZ55 | 12 CFR 1026.55(b)(1), Temporary rate exception | https://www.ecfr.gov/current/title-12/section-1026.55 |
| RZ36 | 12 CFR 1026.36(c)(1), Payment processing by mortgage servicers | https://www.ecfr.gov/current/title-12/section-1026.36 |
| HPA1 | 12 U.S.C. 4901 (Homeowners Protection Act of 1998, s.2, Definitions), Office of the Law Revision Counsel, "in effect through Public Law 119-136 (October 22, 2026)" | https://uscode.house.gov/us/usc/119-136/t12/s4901/ |
| HPA2 | 12 U.S.C. 4902 (HPA s.3, Termination of private mortgage insurance), same edition | https://uscode.house.gov/us/usc/119-136/t12/s4902/ |
| FNMASVC | Fannie Mae **Servicing** Guide B-8.1-04, "Termination of Conventional Mortgage Insurance" (05/15/2019); guide "Published: October 14 2026" | https://servicing-guide.fanniemae.com/svc/b-8.1-04/termination-conventional-mortgage-insurance |
| FNMASEL | Fannie Mae **Selling** Guide B7-1-01 "Provision of Mortgage Insurance" (04/02/2025) and B7-1-02 "Mortgage Insurance Coverage Requirements" (08/07/2019); guide "Published: October 07 2026" | https://selling-guide.fanniemae.com/sel/b7-1-01/provision-mortgage-insurance |
| CFPBPMI | CFPB, "When can I remove private mortgage insurance (PMI) from my loan?" (page last modified Aug. 31, 2026) | https://www.consumerfinance.gov/ask-cfpb/when-can-i-remove-private-mortgage-insurance-pmi-from-my-loan-en-202/ |
| CFPBB15 | CFPB Bulletin 2015-03 (Aug. 4, 2015), "Private Mortgage Insurance Cancellation and Termination" | https://files.consumerfinance.gov/f/201508_cfpb_compliance-bulletin_private-mortgage-insurance-cancellation-and-termination.pdf |
| CFPBRD | CFPB blog, "How to reduce your debt" (Jul. 16, 2019) | https://www.consumerfinance.gov/archive/blog/how-reduce-your-debt/ |
| CFPBWS | CFPB "Your Money, Your Goals" toolkit, Module 6, Tool 3, "Reducing debt worksheet", pp. 211-212 | https://files.consumerfinance.gov/f/documents/cfpb_ymyg-toolkit_reducing-debt-worksheet.pdf |
| CFPBNY | CFPB blog, "Resolve to take control of your debt in the new year" (Dec. 27, 2018) | https://www.consumerfinance.gov/archive/blog/resolve-take-control-your-debt-new-year/ |
| CFPBKT | CFPB, "Mortgage key terms", entry "Bi-weekly payment" | https://www.consumerfinance.gov/consumer-tools/mortgages/answers/key-terms/ |
| CFPBPM | CFPB press release on Paymap and LoanCare's "Equity Accelerator" (Jul. 28, 2015) | https://www.consumerfinance.gov/archive/newsroom/cfpb-takes-action-against-mortgage-payment-company-and-servicer-for-deceptive-ads/ |
| CFPBNW | CFPB press release on Nationwide Biweekly (May 11, 2015) | https://www.consumerfinance.gov/archive/newsroom/cfpb-files-suit-against-nationwide-biweekly-for-luring-consumers-with-false-promises-of-mortgage-savings/ |
| CFPBBT | CFPB, "What is a balance transfer fee? Can a balance transfer fee be charged on a zero percent interest rate offer?" (last reviewed Sep. 23, 2024) | https://www.consumerfinance.gov/ask-cfpb/what-is-a-balance-transfer-fee-can-a-balance-transfer-fee-be-charged-on-a-zero-percent-interest-rate-offer-en-53/ |
| CFPBCT | CFPB, "Credit cards key terms", entry "Balance transfer" | https://www.consumerfinance.gov/consumer-tools/credit-cards/answers/key-terms/ |

The `rules.py` docstring gives the sha256 of every copy read.

---

## 1. What every calculator shares: one balance, month by month

**Interest each month is the yearly rate divided by 12, times what was owed at the start of the month.**
The page READMEs say so. Regulation Z's own sample calculation does the same arithmetic for a card:

> RZM2: "days = 365/12; * calculate days in month;" ... "perrate(I) = (apr(I)/365) * days; * calculate periodic rate;"

That is APR / 365 x 365 / 12 = APR / 12. RZM1 (b)(4)(vii) allows it: "All months are the same length and leap
year is ignored. A monthly or daily periodic rate may be assumed."

**The payment pays the month's interest first, then the balance. The last payment is exactly what is left**
(that month's opening balance plus that month's interest).

> RZM1 (b)(4)(v): "The final payment pays the account in full (i.e., there is no residual finance charge after
> the final month in a series of payments)."
>
> RZM2: "if pmt gt (tbal + fc) then do; ... pmt = round(cbal(I) * (1 + perrate(I)),0.01); * set final payment amount;"

**A part month counts as a whole month.** The last, smaller payment is one more month. RZM2's loop adds one
to its month counter for every payment, the last one included ("month = month + 1; * increment month
counter;" ... "if tbal gt 0 then go to eins;"). So the key reports whole months: the closed form
`nper = -ln(1 - r B / P) / ln(1 + r)` rounded up, and stepping gives the same count.

**A payment that does not beat the month's interest never pays the debt off.** "Equal" is never too, because
the balance then stays where it is:

> RZ7 (b)(12)(ii): "If negative or no amortization occurs when calculating the minimum payment repayment
> estimate ... 'Minimum Payment Warning: Even if you make no more charges using this card, if you make only the
> minimum payment each month we estimate you will never pay off the balance shown on this statement because
> your payment will be less than the interest charged each month'".

Functions: `level_payment` (the annuity `B r / (1 - (1 + r)^-n)`, checked against an exact-fraction copy),
`nper`, `months_closed_form`, `balance_after`, `interest_closed_form`, and `schedule` / `amortize` (stepping).
The self-checks prove that stepping and the closed forms agree on months and on interest.

## 2. Pay off debts (avalanche and snowball)

### The two orders

**Avalanche: the highest interest rate first.**

> CFPBRD: "Highest interest rate method. This approach focuses on your debts like credit card and student loan
> debts with the highest rate of interest. The goal is to pay off the highest interest rate debt as quickly as
> possible, because it's costing you the most."
>
> CFPBWS: "Focus on the unsecured debt with the highest rate of interest, and eliminate it as quickly as
> possible, because it is costing you the most. Once it is paid off, focus on the next most expensive debt."
> Step 1: "Highest interest rate method: List your debts from highest interest rate to lowest."

**Snowball: the smallest balance first.**

> CFPBRD: "Snowball method. This approach focuses on your smallest debt. ... You keep on making the minimum
> payments on all of your debts, and you put any extra funds you have toward paying off the smallest debt. ...
> Once you've paid one smaller debt in full, dedicate that freed up money to the next smallest debt. This way,
> you create a 'snowball' of payments as you eliminate each debt."
>
> CFPBWS Step 1: "Snowball method: List your debts from smallest to largest in terms of the amount you owe."

**The rollover.** A finished debt's payment moves to the next debt on the list:

> CFPBWS Step 3: "When this debt is paid off, allocate the entire payment (monthly payment + extra payment)
> you were making to the next debt on the list."

CFPBNY gives the trade-off in the same words: the highest-rate method "can save you money in the long run",
while the snowball means "you may pay more in the long run as more costly debts continue to add up".

### The key's model (the page README, made exact)

* **Budget** = every debt's required payment + the fixed extra. It stays the same every month, so the payment
  of a finished debt stays in the budget and rolls on.
* **Each month**: (1) every open debt adds APR / 12 x its opening balance; (2) every open debt gets its
  required payment, or what it owes if that is less; (3) whatever is left of the budget goes to the open debts
  in target order, each up to what it owes, in the same month. So a debt finished mid-month passes its unused
  money on at once.
* **Outputs**: months until every debt is paid, total interest, total paid (= what was owed + interest), the
  month each debt is paid off, or "never".
* **Plus 100** = the same plan with extra + 100.
* **Baseline** = required payments only, and nothing rolls over (`baseline()`): each debt is paid by its own
  required payment, as if alone. The page says only "the baseline pays required payments only". The other
  possible reading, extra = 0 *with* rollover, is `payoff_plan(debts, method, 0)`. A generator should write
  both, so the verifier can tell which one the app means.

### Rules no source decides (the key's own)

* **Ties: no source decides.** The key's figures put equal rates (avalanche) or equal balances (snowball) in the
  order the debts were entered in (a stable sort). That is one valid choice, not a rule: the payoff page sorts a
  tie by the debt's name, which is just as valid. So a tie row checks an app only where its tie order is the
  entry order (debts named "Debt 1".."Debt n" in entry order); with other names a tie has no single right answer.
  A generator should avoid exact ties, except in a few rows labelled as edge cases.
* **The order is set once, at the start.** The CFPB worksheet makes the list once and works down it. A
  snowball that re-sorts by today's balance every month (`dynamic_order=True`) can differ when a debt that is
  not being targeted grows past another one. A generator should keep rows where both orders give the same
  answer, or label the ones where they do not.
* **"Never", decided exactly.** In a plan, "payments do not cover interest" is not a one-month test. The total
  owed can rise for a while and still be paid off. For example, $10,000 at 30% needing $300 plus $100,000 at
  3% needing $100: the first month's interest is $500 against a $400 budget, yet the 30% debt shrinks and the
  plan finishes. So the key decides phase by phase. While no debt finishes, a debt that is not the target
  and whose required payment is above its interest will finish. A debt whose required payment is at or below
  its interest never shrinks. If no debt other than the target is shrinking, and the target's payment (budget
  minus the others' required payments) is at or below the target's interest, nothing can ever finish: never.
  The self-check tests this verdict against plain stepping on 40 random plans. With the baseline (no
  rollover), any debt whose required payment is at or below its own interest is never.

## 3. Credit cards

### The minimum payment

**No law sets a minimum payment formula.** The card's own formula applies:

> RZM1 (b)(1): "When calculating the minimum payment repayment estimate, card issuers must use the minimum
> payment formula(s) that apply to a cardholder's account."

The page's default, **2% of the balance with a $25 floor**, is the page's own assumption. Regulation Z's
example is a similar formula with a $20 floor: "the minimum payment is calculated as 2 percent of the
outstanding balance on the account or $20 whichever is greater" (RZM1 (b)(1)); "dollar minimum payment;
dmin = 20; ... percent minimum payment; pmin = 0.02; * (0.02 + perrate);" (RZM2; the comment shows that a
formula can also add the month's interest rate).

**Recomputed every month: the key's decision, from Regulation Z.** A minimum payment *formula* applied
"each month" (RZM1 (b)(4)(i): "Only minimum monthly payments are made each month") is worked out again from
each month's balance. RZM2's loop does exactly that. At the top of every month it takes the percentage of
the balance owed before that month's interest, then applies the dollar floor:

> RZM2: "pmt = round(pmin * tbal,0.01); * calculate payment as percentage of balance;" ... "if pmt lt dmin then
> pmt = dmin; * set dollar minimum payment;"

(The eCFR page runs SAS's comparison words into their neighbours, "if pmtltdmin" and "if pmtgt (tbal + fc)".
They are quoted here with the spaces put back: `lt` means less than, `gt` greater than.)

So the key's minimum each month is `max(2% x opening balance, $25)`, never more than what is owed. Interest is
added for the month, and the payment is credited at the end of the month (RZM1 (b)(4)(viii): "Payments are
credited either on the last day of the month or the last day of the billing cycle"). The floor applies every
month. Once 2% of the balance falls below $25 (a balance under $1,250), the payment is a flat $25 until the
last one. `card_payoff(..., frozen=True)` computes the formula once on the starting balance and holds it level.
It is there only as a contrast: it pays off much sooner (example 2).

**A required payment that is set is a fixed dollar amount.** When the person types the card's required
payment, the key holds that number level every month. That is "paying this amount", not a Regulation Z
estimate, which would shrink with the balance (see "Where the pages and the sources differ").

**What else Regulation Z assumes** (RZM1 (b)(4)): no new purchases, fees or charges ((ii)); the APR does not
change ((iii)); "There is no grace period" ((iv)); amounts "may be rounded to the nearest cent" ((xi)). RZM1
(b)(3): the starting balance is the statement balance "as of the closing date of the last billing cycle", and
the issuer "may round the beginning balance ... to the nearest whole dollar".

**How a statement shows it** (`regz_disclosed_estimate`). Under 2 years, in months; otherwise in years
rounded to the nearest year:

> RZ7 (b)(12)(i)(B): "If the minimum payment repayment estimate is less than 2 years, the card issuer must
> disclose the estimate in months. Otherwise, the estimate must be disclosed in years and rounded to the
> nearest whole year".
>
> RZSUP 7(b)(12)(i)(F)-1: "if the minimum payment repayment estimate is 2 years 6 months to 3 years 5 months,
> issuers would be required ... to disclose that it would take 3 years". So a half year rounds up.

Tolerance: an estimate "is not more than 2 months above or below" is accurate (RZM1 (b)(5)). The 36-month
payment is "the same amount each month for 36 months" (RZM1 (d)(1)), computed as RZM2's
"pmt01 = round(tbal/pvaf,0.01)" (`regz_36_month_payment`). Its tolerance is 10% (RZM1 (d)(4)).

`regz_m2_single` copies RZM2's SAS loop line by line for one balance at one rate. The self-check proves that
`card_payoff(..., round_cents=True)` gives the same months, total paid and interest on five cards.

### Balance transfer

**The page's model.** B = the balance, P = the promo months, f = the fee rate, r = the card's APR / 12.

* Staying put costs the interest the *old* card charges over the P months while you pay
  `max(required, B / P)` each month. B / P comes from the starting balance; it is the payment that would
  clear B in P months at 0%. "required" is the required payment the person set. With none set, the payment is
  B / P, as the page README's formula reads; no source sets a floor for this comparison. Paying at least the
  page's usual minimum (2%, at least $25) instead is written as a contrast, `bt_interest_with_min_floor`
  (section 5, item 9).
* The transfer costs the fee, `B x f`.
* `saves = interest - fee`. `payToClear = B x (1 + f) / P` is the level payment that clears the balance plus
  the fee within the promo at 0%.

**What the sources add:**

> CFPBBT: "A credit card company is permitted to charge you a balance transfer fee on a zero percent rate offer."
>
> CFPBCT: "The fee is usually a certain percentage of the amount you transfer or a fixed amount, whichever is
> more. ... The promotional interest rate for most balance transfers lasts for a limited time."
>
> RZ55 (b)(1): a card issuer may raise a rate "upon the expiration of a specified period of six months or
> longer". So a promotional rate lasts at least 6 months.
>
> RZ53 (a): a payment above the minimum goes "first to the balance with the highest annual percentage rate".
> So new purchases on the transfer card (at a higher rate) take any extra first.

The key's model assumes a 0% promotional rate, no new purchases, and the fee added to the new balance.
Generators should use P of 6 or more; a shorter promo is valid arithmetic but not a lawful promotional period.

## 4. Mortgage

**Months left** = `nper(rate/12, payment, balance)` in whole months (part month = one more payment).
**Interest to come** = the sum of the schedule's interest at that payment, = total paid - balance. Both come
from stepping and are checked against the closed forms. With P / r written as K, the balance after k payments
is `B_k = K - (K - B)(1 + r)^k`. That makes hand checks easy (example 3).

**Extra each month**: the same at payment + extra. Savings = base interest - interest with extra, and base
months - months with extra.

**Every two weeks: the page's model, payment x 13/12 each month.**

> CFPBKT: "In a bi-weekly payment plan, the mortgage servicer is collecting half of your monthly payment
> every two weeks, resulting in 26 payments over the course of the year (totaling one extra monthly payment
> per year). By making additional payments and applying your payments to the principal, you may be able to
> pay off your loan early. ... You may be able to accomplish the same goal without the fee by making an extra
> monthly mortgage payment each year."

26 half payments = 13 monthly payments a year = 13/12 of a payment each month. **When the lender applies
them is not fixed by any rule read here.** A half payment is less than a "periodic payment", and a servicer
may hold it:

> RZ36 (c)(1)(ii): "Any servicer that retains a partial payment, meaning any payment less than a periodic
> payment, in a suspense or unapplied funds account shall ... On accumulation of sufficient funds to cover a
> periodic payment in any suspense or unapplied funds account, treat such funds as a periodic payment".
>
> CFPBPM: Paymap "does not actually make more frequent payments on consumers' mortgages. Instead, Paymap
> holds the collected payments in custodial accounts, and then pays consumers' mortgages on their original
> monthly schedule. ... Any interest savings that consumers may achieve ... is because they make a higher
> annual mortgage payment".
>
> CFPBNW: Nationwide Biweekly charged "a setup fee of up to $995" and "between $84 and $101 in payment
> processing fees each year".

So the 13/12 model credits the extra twelfth every month. A program that holds the money and pays one extra
payment a year saves a little less interest: `thirteenth_payment_schedule()` is that contrast, not the page's
model. A lender that credits each half on receipt would save a little more. The key models neither as the
answer.

**Recast** = the level payment that repays (balance - lump) over the months left at the current pace. The key
takes "months left" as the **whole** months at the current payment (without extra), because a loan is repaid
in whole monthly installments. If an app uses the fractional nper instead, the recast payment comes out as
exactly `payment x (balance - lump) / balance` (the annuity scales with the balance), a few cents to dollars
away. No federal rule on recasts was found; lenders' fees and minimum lump sums were not checked. A lump at or
above the balance pays the loan off (payment 0).

### Mortgage insurance: when it can come off

**The law (Homeowners Protection Act), for private mortgage insurance on a single-family principal home,
loans closed on or after July 29, 1999:**

* **On request at 80% of the original value**, reached either by the original schedule or by actual payments:

  > HPA1 4901(2)(A): "the date on which the principal balance of the mortgage— (i) based solely on the initial
  > amortization schedule for that mortgage, and irrespective of the outstanding balance for that mortgage on
  > that date, is first scheduled to reach 80 percent of the original value of the property securing the loan;
  > or (ii) based solely on actual payments, reaches 80 percent of the original value of the property securing
  > the loan".

  HPA2 4902(a) adds the conditions: a written request, a good payment history, being current, evidence "that
  the value of the property securing the mortgage has not declined below the original value", and no second
  lien. HPA1 4901(4) defines a good history: no payment 60 or more days late in the 12 months that start 24
  months before, and none 30 or more days late in the last 12 months.
* **Automatically at 78% of the original value**, by the original schedule only:

  > HPA1 4901(18)(A): "the date on which the principal balance of the mortgage, based solely on the initial
  > amortization schedule for that mortgage, and irrespective of the outstanding balance for that mortgage on
  > that date, is first scheduled to reach 78 percent of the original value". HPA2 4902(b)(1): it terminates
  > "on the termination date if, on that date, the mortgagor is current".
  >
  > CFPBB15: "a borrower cannot advance the 'termination date' by making additional payments to lower the
  > principal balance of the mortgage."
* **At the midpoint at the latest**:

  > HPA2 4902(c): "in no case may such a requirement be imposed ... beyond the first day of the month
  > immediately following the date that is the midpoint of the amortization period of the loan if the
  > mortgagor is current". HPA1 4901(7): the midpoint is "halfway through" the scheduled amortization period.
  > CFPBPMI: "For 30-year loans, the midpoint is after 15 years have passed." CFPBB15: for a standard 30-year
  > loan it "would be the first day of the month following the 180th payment."

  Which payment is the last one with mortgage insurance depends on payment dates that these sources do not
  settle. Test only that the midpoint is half the term (180 payments for 30 years).
* **"Original value"** = "the lesser of the sales price of the property ... or the appraised value at the time"
  (for a refinance, "only the appraised value relied upon by the mortgagee") (HPA1 4901(12)).
* **Not covered**: FHA, VA and rural housing insurance (HPA1 4901(13) excludes "mortgage insurance made
  available under the National Housing Act ..., title 38, or title V of the Housing Act of 1949"). CFPBPMI:
  "Mortgages through the Federal Housing Administration (FHA) or Department of Veterans Affairs (VA) have
  different requirements." The CFPB also says lender-paid mortgage insurance follows "different rules". High-risk
  loans have their own 77% date (HPA2 4902(g)(1)(B)).
* **Lenders may be kinder, never stricter**: "Loan investors, including Fannie Mae and Freddie Mac, often create
  their own PMI cancellation guidelines. But these guidelines cannot be less favorable to the borrower than the
  ones above." (CFPBPMI)

**Fannie Mae: removal based on today's value.** This rule is in the **Servicing Guide**, not the Selling Guide.
The Selling Guide pages read (B7-1-01, B7-1-02) cover getting the insurance at closing, not removing it.

> FNMASVC, "Borrower-Initiated Termination ... Based on Current Value of the Property", one-unit principal
> residence or second home: "the LTV ratio must be 75% or less, if the seasoning of the mortgage loan is
> between two and five years. 80% or less, if the seasoning of the mortgage loan is greater than five years.
> If Fannie Mae's minimum two-year seasoning requirement is waived because the property improvements made by
> the borrower increased the property value, the LTV ratio must be 80% or less." Investment property or 2-4
> units: "the LTV ratio must be 70% or less and the seasoning of the mortgage loan must be greater than two
> years." The servicer "must not solicit a borrower for MI termination based on current value".
>
> FNMASVC, based on original value: "on the date the mortgage loan balance is first scheduled to reach 80% (or
> actually reaches 80%) of the original value of the property"; automatic: "the date the principal balance of
> the mortgage loan is first scheduled to reach 78% of the original value of the property, or the first day of
> the month following the date the mid-point of the mortgage loan amortization period is reached".

`fannie_current_value_max_ltv(seasoning_months)` gives 75% for 24-60 months, 80% over 60 months, 80% with
improvements, and none under 24 months. Whether exactly 24 or 60 months counts as "between two and five
years" is the key's reading (yes); generators should avoid those exact values.

**The page's number** = months until the balance falls to 80% of "the home's value", paying payment + extra
(`months_to_ltv`). "Reaches" counts a balance equal to the limit. The verdict on the page's wording is in the
next section.

## 5. Where the pages and the sources differ

1. **"80% of the home's value".** It is right when "the home's value" means the **original value** (the lower
   of the price paid and the appraisal at closing). Then the page's months are the HPA's request date "based
   solely on actual payments". It is **not** what the law says if it means today's market value. On today's
   value, Fannie Mae allows 80% only after more than five years, and 75% between two and five years. It also
   needs a new valuation and the borrower's request. The page's "usually removable" should also say: the
   insurance comes off on its own at 78% of the original value on the original schedule (extra payments do not
   bring that date closer), and at the latest at the midpoint. FHA and VA loans are not covered. The key
   computes the page's number with whatever value it is given, and gives the HPA dates separately (`hpa_dates`).
2. **The 2% / $25 minimum** is the page's own default, not a legal formula. Regulation Z's estimate uses the
   card's real formula, recomputed every month. The key recomputes the page's formula every month, as RZM2 does.
3. **A set required payment held level** pays off much sooner than a real minimum, which shrinks with the
   balance. Example 2: the same $3,000 card takes 268 months at the recomputed minimum but 94 months at its
   first minimum ($60) held level. The page's months at a fixed required payment are "paying this amount",
   not a Regulation Z minimum-payment estimate.
4. **Statements show years, the page shows months.** Not a conflict, because the page is not a statement.
   `regz_disclosed_estimate` gives the statement's wording if the verifier wants it.
5. **Balance transfer fee.** The page uses `B x f`. Real fees are often "a certain percentage ... or a fixed
   amount, whichever is more" (CFPBCT), so on a small balance the real fee can be higher. Promotional periods
   last at least 6 months (RZ55).
6. **Every two weeks.** The page credits 13/12 of a payment every month. A servicer may hold half payments
   until a full payment has built up (RZ36), and some programs paid only monthly (CFPBPM). So 13/12 is an
   approximation of "one extra payment a year", not a description of any lender.

Found when the key was verified against the pages (2026-10-31). Items 7 and 8 were where the page was wrong; both
were fixed the same day in `core/math/payoff.js` `minimumOnly`, so `todo.json` is empty. Items 9 and 10 were the
key's mistakes and are fixed here.

7. **The 2% minimum was taken after the month's interest on the page (fixed 2026-10-31).** With no required payment set, the page
   takes 2% of the balance *plus* that month's interest. Regulation Z takes the percentage of the balance owed at
   the start of the month: the statement balance (RZM1 (b)(3)), with the payment credited at the end of the month
   (RZM1 (b)(4)(viii)). RZM2's loop does "pmt = round(pmin * tbal,0.01)" before that month's interest is added.
   The page's minimum is a little higher, so it finishes sooner and charges less interest. At 24% to 24.49% it can
   pay off a card that Regulation Z says never pays off (`cc-0431`: 454 months on the page). That contradicts
   RZ7 (b)(12)(ii). The key keeps the opening balance.
8. **The page stopped at 1,200 months and said "never" (fixed 2026-10-31).** RZ7 (b)(12)(ii) keeps "never" for "negative or no
   amortization". A card that amortizes, however slowly, is paid off (`cc-edge-009`, 1,350 months). The key
   gives the month.
9. **The balance transfer with no required payment set (the key was wrong).** The key used to floor the payment at
   the page's usual 2% / $25 minimum. The page README's formula is max(required, B / P) with nothing set, no
   source decides, and the default is the README, so the key now pays B / P. The old reading is the contrast
   column. On 115 rows (a balance under $25 x the promo months) it is $0.06 to $43.60 less interest. It is the
   owner's call whether "staying put" should pay at least the usual minimum the page shows for the same card.
10. **Ties (the key was wrong to call its order the rule).** See section 2. The page sorts ties by name.

## 6. Conventions the key adopts where no source decides

1. **Monthly interest** = APR / 12 x the opening balance. No daily interest, no grace period, no new charges.
2. **Order inside a month**: interest first, then payment; the payment covers interest, then principal; the
   last payment is exactly what is left.
3. **Months** are whole payments; a last, smaller payment is a month.
4. **Never** = a payment at or below the month's interest. For a single balance this is checked every month
   (with a percentage-plus-floor minimum, if the first month shrinks the balance, every later month does). For
   a plan it is decided phase by phase (section 2).
5. **Rounding.** The main track keeps 60 significant digits and rounds results half up to the cent at the end.
   A second track (`round_cents=True`) rounds every interest charge and every computed payment to the cent,
   half up, each month, as RZM2 does. A figure from the app matches if it is within $0.01 of either track.
   Months must match the key on both tracks; a row where the two tracks disagree on months is an edge row.
6. **The 2% minimum** is `max(2% x the month's opening balance, $25)`, recomputed every month, never more than
   what is owed. The $25 floor applies every month.
7. **A required payment that is set** is a fixed dollar amount every month.
8. **Balance transfer**: 0% promotional rate, the fee added to the new balance, no new purchases, and B / P
   from the starting balance. The payment is max(the required payment set, B / P), or B / P with none set.
9. **Plans**: the budget is fixed (sum of required payments + extra); the order is fixed at the start; the figures
   put a tie in input order (one valid choice, section 2); the baseline has no rollover.
10. **Recast** uses the whole months left at the current payment, without the extra.
11. **Mortgage insurance** months count the first month whose closing balance is at or below the limit (0 if
    already there). `hpa_dates` builds the original schedule with the level payment rounded half up to the
    cent; a real note's payment may round differently.
12. **Inputs** are strings, ints or Decimals; a float goes through `repr` (0.1 becomes Decimal("0.1")).

## 7. Not verified (said plainly, not invented)

* What minimum payment formulas real card issuers use. Regulation Z's 2% / $20 is only an example.
* That SAS `round()` sends exact halves away from zero (SAS's documentation; not read for this key). For
  positive amounts that is the same as the key's half up.
* How any particular servicer applies half payments every two weeks, beyond RZ36 and the CFPB actions.
* Recast rules and fees: no federal rule found.
* The exact payment that is the last to carry mortgage insurance at the midpoint.
* Whether the app re-sorts snowball each month, how it breaks ties, and which reading of "baseline" it uses.
  (Found on verification: the payoff page fixes the order at the start, sorts ties by name, and its "required
  payments only" is `baseline_rollover`.)
* That US mortgages charge interest monthly at rate / 12: it is the page's model and common practice, but no
  regulation read here says so.

## 8. Worked examples (invented numbers)

All three are rows the self-check reproduces (`_check_examples` in `rules.py`).

### Example 1: pay off debts

Two debts. The budget is $40 + $30 + $130 extra = **$200 a month**.

| Debt | Owed | Rate | Monthly rate | Required |
|---|---|---|---|---|
| Store card | $500 | 24% | 2% | $40 |
| Bank loan | $300 | 12% | 1% | $30 |

**Avalanche** (store card first: 24% > 12%):

| Month | Store card: interest | paid | owed after | Bank loan: interest | paid | owed after |
|---|---|---|---|---|---|---|
| 1 | 10.00 | 40 + 130 = 170.00 | 340.00 | 3.00 | 30.00 | 273.00 |
| 2 | 6.80 | 170.00 | 176.80 | 2.73 | 30.00 | 245.73 |
| 3 | 3.536 | 170.00 | 10.336 | 2.4573 | 30.00 | 218.1873 |
| 4 | 0.20672 | 10.54272 (paid off) | 0 | 2.181873 | 30 + 159.45728 = 189.45728 | 30.911893 |
| 5 | | | | 0.30911893 | 31.22101193 (paid off) | 0 |

In month 4 the store card needs only 10.54272, so 200 - 10.54272 - 30 = 159.45728 rolls to the bank loan in the
same month. Result: **5 months**; store card paid off in month 4, bank loan in month 5. Interest
10 + 3 + 6.80 + 2.73 + 3.536 + 2.4573 + 0.20672 + 2.181873 + 0.30911893 = 31.22101193 = **$31.22**. Total paid
**$831.22**. The cents track gives $31.23.

**Snowball** (bank loan first: $300 < $500):

| Month | Bank loan: interest | paid | owed after | Store card: interest | paid | owed after |
|---|---|---|---|---|---|---|
| 1 | 3.00 | 30 + 130 = 160.00 | 143.00 | 10.00 | 40.00 | 470.00 |
| 2 | 1.43 | 144.43 (paid off) | 0 | 9.40 | 40 + 15.57 = 55.57 | 423.83 |
| 3 | | | | 8.4766 | 200.00 | 232.3066 |
| 4 | | | | 4.646132 | 200.00 | 36.952732 |
| 5 | | | | 0.73905464 | 37.69178664 (paid off) | 0 |

Result: **5 months**; bank loan in month 2, store card in month 5. Interest 3 + 10 + 1.43 + 9.40 + 8.4766 +
4.646132 + 0.73905464 = 37.69178664 = **$37.69**, total paid **$837.69**. The cents track gives $37.70.
Avalanche saves $6.47 here.

**Plus 100** (budget $300): avalanche 3 months, $22.74; snowball 3 months, $27.29.

**Baseline** (required payments only, no rollover). Each debt is paid alone:
store card at $40: `nper = -ln(1 - 0.02 x 500 / 40) / ln 1.02 = -ln 0.75 / ln 1.02 = 0.287682 / 0.019803 = 14.53`,
so **15 months**, interest $81.20 (last payment $21.20). Bank loan at $30:
`-ln(1 - 0.01 x 300 / 30) / ln 1.01 = 0.105361 / 0.009950 = 10.59`, so **11 months**, interest $17.70 (last
payment $17.70). Baseline: **15 months, $98.89** (unrounded sum 98.892957). The other reading (extra 0 *with*
rollover) gives 13 months, $96.19.

### Example 2: credit cards

**Minimum payments**: $3,000 at 18% (1.5% a month), no required payment set, so the minimum is
max(2%, $25), recomputed each month:

| Month | Owed at start | Interest | Minimum | To the balance | Owed after |
|---|---|---|---|---|---|
| 1 | 3,000.00 | 45.00 | 2% = 60.00 | 15.00 | 2,985.00 |
| 2 | 2,985.00 | 44.775 | 2% = 59.70 | 14.925 | 2,970.075 |
| 3 | 2,970.075 | 44.551125 | 2% = 59.4015 | 14.850375 | 2,955.224625 |
| ... | | | | | |
| 175 | 1,254.11 | 18.81 | 2% = 25.08 | 6.27 | 1,247.84 |
| 176 | 1,247.84 | 18.72 | floor 25.00 | 6.28 | 1,241.56 |
| ... | | | | | |
| 268 | 18.86 | 0.28 | last payment 19.14 | | 0 |

(Rows 175 onward are shown to the cent.) Result: **268 months** (22 years 4 months), interest **$6,327.77**,
total paid $9,327.77. The cents track gives 268 months and $6,327.65. That is exactly what the line-by-line
copy of Regulation Z's own SAS loop gives with a $25 floor. A statement would show "22 years". The 36-month
payment would be $108.46.

The first minimum held level instead ($60 every month, `frozen=True`):
`nper = -ln(1 - 0.015 x 3000 / 60) / ln 1.015 = -ln 0.25 / ln 1.015 = 1.386294 / 0.014889 = 93.11`, so **94
months**, interest $2,586.71. That is why the key must say which one it computes.

**Never**: $2,000 at 30% (2.5% a month). Interest is $50.00; the minimum is max(2% = $40.00, $25) = $40.00,
which is less than $50, so **never**. At $900 the same card works: interest $22.50, minimum $25 (2% is only
$18), `nper(900, 30%, 25) = 93.25`, so **94 months**, interest $1,431.31.

**Balance transfer**: $3,000 at 24% (2% a month), a 12-month promo, a 3% fee, card's required payment $75.
The payment is max($75, $3,000 / 12 = $250) = **$250**. After 12 months on the old card:
`B_12 = 3000 x 1.02^12 - 250 x (1.02^12 - 1) / 0.02 = 3,804.7254 - 3,353.0224 = 451.7030`.
You paid 12 x 250 = $3,000, so the balance fell by 3,000 - 451.70 = 2,548.30. The interest is
3,000 - 2,548.30 = **$451.70**. Fee = 3,000 x 0.03 = **$90.00**. Saves = 451.70 - 90.00 = **$361.70**.
Pay to clear = 3,000 x 1.03 / 12 = **$257.50** a month.

### Example 3: mortgage

**$200,000** left at **6%** (r = 0.005), paying **$1,250**; extra $200; lump $20,000; home value $240,000.
With K = P / r, the balance after k payments is `B_k = K - (K - B)(1.005)^k`.

* **Months left.** K = 250,000: `n = ln(250,000 / 50,000) / ln 1.005 = ln 5 / ln 1.005 = 1.6094379 / 0.0049875415 = 322.69`,
  so **323 months**. B_322 = 250,000 - 50,000 x 1.005^322 = 860.90; last payment 860.90 x 1.005 = $865.21.
* **Interest to come** = 322 x 1,250 + 865.21 - 200,000 = **$203,365.21** (cents track $203,365.35).
* **Extra $200** (P = 1,450, K = 290,000): `n = ln(290,000 / 90,000) / ln 1.005 = 1.1700713 / 0.0049875415 = 234.60`,
  so **235 months**; last payment $869.13; interest 234 x 1,450 + 869.13 - 200,000 = **$140,169.13**. Saves
  **$63,196.08** and **88 months**.
* **Every two weeks** (P = 1,250 x 13/12 = 1,354.1667, K = 270,833.33):
  `n = ln(270,833.33 / 70,833.33) / ln 1.005 = 1.3411739 / 0.0049875415 = 268.90`, so **269 months**; last
  payment $1,225.56; interest 268 x 1,354.1667 + 1,225.56 - 200,000 = **$164,142.23**. Saves **$39,222.98** and
  **54 months**. The cents track rounds the payment to $1,354.17 and gives $164,141.12. Contrast: one extra
  full payment every 12th month instead gives 271 months, $165,747.99.
* **Recast** with $20,000: months left at the current pace = 323; new payment
  `180,000 x 0.005 / (1 - 1.005^-323) = 900 / (1 - 1 / 5.0076959) = 900 / 0.8003074 =` **$1,124.57**. With the
  fractional 322.69 months it would be 1,250 x 180,000 / 200,000 = $1,125.00 exactly.
* **Mortgage insurance** at 80% of $240,000 = $192,000, paying $1,450:
  `290,000 - 90,000 x 1.005^k <= 192,000` gives `1.005^k >= 1.0888889`, so `k >= 0.0851578 / 0.0049875415 = 17.07`:
  **18 months**. Owed after month 17: $192,036.21; after month 18: $191,546.40.
* **HPA dates** for a different invented loan: $216,000 borrowed on a home bought for $240,000 (the original
  value), 30 years at 6%. The level payment is 1,295.0291, rounded to **$1,295.03**. On that schedule the
  balance first reaches 80% ($192,000) after payment **89** ($191,969.97; after payment 88 it is $192,303.48).
  It reaches 78% ($187,200) after payment **103** ($187,121.87; after payment 102, $187,479.50). The midpoint
  is 180 payments (15 years).

## 9. Notes for the generator

* Avoid exact ties in rate (avalanche) or balance (snowball), except in a few rows labelled as edge cases.
* Keep `last_month_fraction()` between 0.01 and 0.99. Near 0 the last payment is a few cents that an app
  rounding to the cent may fold into the month before. Near 1, a cent of rounding can add a month.
* Write both tracks (full precision and cents). Label any row where they disagree on months.
* Snowball: drop or label rows where `dynamic_order=True` gives a different answer.
* Recast: make the current payment the level payment for a whole number of months, rounded **up** to the
  cent. Then the whole-month and fractional readings agree within a cent; label the rows that do not.
* Mortgage insurance: keep the balance at the limit month at least $1 away from 80% of the value.
* Write the baseline both ways (no rollover, and extra 0 with rollover).
* Promo months of 6 or more for balance transfers.
