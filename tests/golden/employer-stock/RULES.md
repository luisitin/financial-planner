# Employer stock: rules sheet for the answer key

This sheet is the spec of an independent answer key for one page, "Employer stock" (RSUs and stock options): the vesting
schedule, how much of the household rides on the company, the tax on the vests of the next 12 months and what the employer
withholds from them, and the diversifying sale that gets the share under 10%. Today is a day in 2026; the vests in view
reach into 2027. `tools/golden_employer_stock/rules.py` holds every figure as data, with its source and the date it was
read on the same line, plus each rule as a small pure function. This sheet gives each rule in plain words with the source
text it rests on, the conventions the key adopts, and examples worked by hand (section 9), which `rules.py` asserts when
imported (3,037 self-checks, all passing; 2,904 of them are the worksheet-against-statute grid of section 5.3).

**Independence.** Written from the law (26 U.S.C. 1, 83, 402, 1211, 1222, 1411, 3101, 3102, 3121), the regulations
(26 CFR 1.83-3, 31.3102-4, 31.3402(g)-1), IRS Publications 15 (2026), 15-B (2026) and 525 (2025), Form 8959 and its
instructions, the Form 1040 and Form 8960 instructions, Rev. Proc. 2025-32, and the Illinois Department of Revenue. Nobody
opened `modules/`, `core/` or `tests/*.test.mjs` while writing it, and the key never imports or runs the app. Only the
layout and conventions of `tools/golden_property/` and `tools/golden_paycheck/` were looked at. The 2026 federal figures
were read in Rev. Proc. 2025-32 and agree with `tests/golden/taxes/RULES.md` (FEDKEY), `tests/golden/tax-lots/RULES.md`
(TLKEY) and `tests/golden/property/RULES.md` (PROPKEY), which are cited for them. The page's README documents the model
(the brief's "page convention"). Where the law says otherwise, the main column keeps the page's way and a law column gives
the law, so the test can compare both.

Every source was read on **2026-10-31**. Each was saved and hashed (first 8 ... last 10 hex digits of sha256); the full list
is also in the `rules.py` docstring.

## 1. Sources

| Id | Document | URL | Sha |
|---|---|---|---|
| USC1 | 26 U.S.C. 1(h)(1), (h)(3), (j)(1), (j)(2)(F), (j)(5) (OLRC, "current through Public Law 119-136 (October 22, 2026)") | https://uscode.house.gov/us/usc/119-136/t26/s1/ | acce504c...3ce7938060 |
| USC83 | 26 U.S.C. 83(a), (b), (c)(1), (e)(3)-(4), (f) (last amended Pub. L. 115-97, 2017) | https://uscode.house.gov/us/usc/119-136/t26/s83/ | b4008bec...b7599f66be |
| USC402 | 26 U.S.C. 402(a) | https://uscode.house.gov/us/usc/119-136/t26/s402/ | 5e82a2eb...06a671254f |
| USC1211 | 26 U.S.C. 1211(b) | https://uscode.house.gov/us/usc/119-136/t26/s1211/ | 0ef67741...bf8b64dde3 |
| USC1222 | 26 U.S.C. 1222(3) | https://uscode.house.gov/us/usc/119-136/t26/s1222/ | 608100ea...b0cae9749a |
| USC1411 | 26 U.S.C. 1411(a)(1), (b), (c)(1), (d) | https://uscode.house.gov/us/usc/119-136/t26/s1411/ | 89721b18...741beafb33 |
| USC3101 | 26 U.S.C. 3101(b)(1)-(2) (last amended Pub. L. 115-141, 2018) | https://uscode.house.gov/us/usc/119-136/t26/s3101/ | 04bdb134...e071c36d77 |
| USC3102 | 26 U.S.C. 3102(a), (f)(1)-(3) | https://uscode.house.gov/us/usc/119-136/t26/s3102/ | 19f91715...de3697dba2 |
| USC3121 | 26 U.S.C. 3121(v)(2)(A) | https://uscode.house.gov/us/usc/119-136/t26/s3121/ | a97b7469...b7ec1e4ccd |
| CFR3402G | 26 CFR 31.3402(g)-1(a) (eCFR "up to date as of 2026-10-29"; T.D. 9276, T.D. 9924) | https://www.ecfr.gov/current/title-26/section-31.3402(g)-1 | b128554a...60666370f9 |
| CFR3102 | 26 CFR 31.3102-4(a), (b) | https://www.ecfr.gov/current/title-26/section-31.3102-4 | 1776d6c6...63c08c1994 |
| CFR833 | 26 CFR 1.83-3(e) | https://www.ecfr.gov/current/title-26/section-1.83-3 | 9c5a4978...f23ad9d003 |
| P15 | Publication 15 (2026), (Circular E) Employer's Tax Guide, dated Dec 15, 2025: What's New pp.1-2, section 7 pp.23-24, section 9 pp.29-30 | https://www.irs.gov/pub/irs-pdf/p15.pdf | b46c3622...c9f804c88b |
| P15B | Publication 15-B (2026), Employee Stock Options | https://www.irs.gov/pub/irs-pdf/p15b.pdf | a0af8513...77b639ec46 |
| P525 | Publication 525 (2025), Taxable and Nontaxable Income (PDF of 2026-02-25): pp.12-14 | https://www.irs.gov/pub/irs-pdf/p525.pdf | 39b0fa5e...4cebc2c25b |
| I8959 | Instructions for Form 8959 (2025), dated Aug 7, 2025 | https://www.irs.gov/pub/irs-pdf/i8959.pdf | 1d223be7...abf687b68f |
| F8959 | Form 8959 (2025) | https://www.irs.gov/pub/irs-pdf/f8959.pdf | 13e64004...a9afaa996d |
| I1040 | Instructions for Form 1040 (2025), Qualified Dividends and Capital Gain Tax Worksheet (p.38) | https://www.irs.gov/pub/irs-pdf/i1040gi.pdf | 482e9c48...590468364a |
| I8960 | Instructions for Form 8960 (2025), Line 13 | https://www.irs.gov/pub/irs-pdf/i8960.pdf | b10fbb23...7867376428 |
| RP2532 | Rev. Proc. 2025-32: s.4.01 Tables 1, 3, 4, s.4.03, s.4.14(1), s.5 | https://www.irs.gov/pub/irs-drop/rp-25-32.pdf | e9ada115...a96214635b |
| IRSNEWS | IRS News releases for current month (October 2026; "Page Last Reviewed or Updated: 29-Oct-2026") | https://www.irs.gov/newsroom/news-releases-for-current-month | b8e7d2a2...e50706d333 |
| IRSINFL | IRS Inflation-adjusted tax items by tax year ("Page Last Reviewed or Updated: 01-Dec-2025") | https://www.irs.gov/newsroom/inflation-adjusted-tax-items-by-tax-year | 07ae74b6...8751d9f31e |
| ILQ851 | IDOR, "What is the Illinois personal exemption allowance?" | https://tax.illinois.gov/questionsandanswers/answer.851.html | a4cb136d...ee670d9dd0 |
| ILB15 | IDOR Informational Bulletin FY 2026-15 (December 2025), What's New for Illinois Income Taxes | https://tax.illinois.gov/content/dam/soi/en/web/tax/research/publications/bulletins/documents/2026/fy-2026-15.pdf | b1e82e9c...71232e593f |
| IL700T | IDOR 2026 Booklet IL-700-T, Illinois Withholding Tax Tables, effective January 1, 2026 (R-12/25) | https://tax.illinois.gov/content/dam/soi/en/web/tax/forms/withholding/documents/currentyear/il-700-t.pdf | f8f05eda...b5fc6d635e |
| ILRATES | IDOR, Income Tax Rates | https://tax.illinois.gov/research/taxrates/income.html | 7bfe12cb...d18c8e9ac5 |
| IL1040I | IDOR 2025 IL-1040 Instructions, Line B and Line 10 | https://tax.illinois.gov/content/dam/soi/en/web/tax/forms/incometax/documents/currentyear/individual/il-1040-instr.pdf | e888e819...d67646d35a |
| FEDKEY | tests/golden/taxes/RULES.md, sections 1, 2, 5, 8 | (this repo) | 96ddcd2f...6c4c6adeb7 |
| TLKEY | tests/golden/tax-lots/RULES.md, sections 5.1-5.3 | (this repo) | 7e1afebd...e254d55a88 |
| PROPKEY | tests/golden/property/RULES.md, section 6 | (this repo) | 4f0c341a...6234bbc116 |

The regulations were read as XML from `https://www.ecfr.gov/api/versioner/v1/full/2026-10-29/title-26.xml?section=<N>`
(title 26 "up_to_date_as_of 2026-10-29" in `https://www.ecfr.gov/api/versioner/v1/titles.json`, b649b378...71de4d4618).
The U.S. Code pages are the OLRC edition "current through Public Law 119-136 (October 22, 2026)".

## 2. The households and the year

One CSV row is one household. Fields (the brief's case):
- `today`, a day in 2026; `filing_status` `single`, `married_joint`, or (a smaller set) `married_separate`, which has two
  adults, the employee and a spouse, each with their own salary.
- Income: `salary_employee` and, for joint and separate rows, `salary_spouse` (yearly, from the Income list), or for a few
  rows `wages_typed` for the whole return instead of any salary (never on a separate row). No other income.
- `state`: `none` or `IL`. Rows with no state are the large majority.
- The company: `price` today. Grants 0 to 3: `kind` `rsu` or `option`, `shares` (whole), `vest_start`, `vest_months` (blank
  48), `cliff_months` (blank 12), `every` (blank 3), and for options `strike` and `granted` (= `vest_start`).
- Holdings of the company's shares: `brokerage_shares` with `brokerage_cost` (one total basis), and `k401_shares`.
- Balances: `brokerage_balance` and `k401_balance`, each at least the value of the company shares held in it (the key
  refuses a row that breaks this). Separate rows with brokerage shares also carry `brokerage_owner`: `employee`, `spouse`
  or `joint`.

Conventions for the case (no source decides them; the full list is section 11):
- **C1** Every adult is under 65, with no dependents, and takes the standard deduction. Salary = W-2 wages = Medicare wages
  (no 401(k) deferral or other pre-tax deduction is modelled). A joint return holds both salaries; separate rows are two
  returns, and the vests are on the employee's (brief: "Filing separately, the vest income is on the employee's own
  return").
- **C2** Federal tax = income tax (exact Tax Computation formula at every income, never the Tax Table: FEDKEY s.1, TLKEY T1)
  + net investment income tax + Additional Medicare Tax. No credits, no AMT.
- **C3** The only net investment income is the gain of the diversifying sale. MAGI for the NIIT is AGI (USC1411(d); I8960
  Line 13).

## 3. Vesting, and when RSU income arises

### 3.1 The schedule (page convention)

Months m = cliff, cliff + every, cliff + 2 x every, ... while below `vest_months`, then `vest_months` itself; when the cliff
is 0 the list starts at `every`. The cumulative whole shares at month m are floor(shares x m / vest_months); each vest is
the change since the previous month in the list, dated `vest_start` + m calendar months, on the same day of the month, or
on the month's last day when the month is shorter. Months are always counted from `vest_start`, never from the previous
vest, so a vest that falls back to February 28 does not pull later vests to the 28th. A vest is **vested** when it is dated
on or before today. (`vest_months`, `vest_schedule`, `add_months`, `vested_shares`.)

- **V2** A cliff longer than `vest_months`, a `vest_months` or `every` of 0, or a fractional grant is refused.
- **Z1** When floor() does not move between two months, that month has a vest of 0 shares; the key leaves it out (it
  changes no amount, only a count of vests). Example: 5 shares over 48 months vest 1 share at months 12, 21, 30, 39, 48.

### 3.2 What the law says about timing (the page agrees)

USC83(a): "If, in connection with the performance of services, property is transferred to any person other than the person
for whom such services are performed, the excess of (1) the fair market value of such property (determined without regard
to any restriction other than a restriction which by its terms will never lapse) at the first time the rights of the person
having the beneficial interest in such property are transferable or are not subject to a substantial risk of forfeiture,
whichever occurs earlier, over (2) the amount (if any) paid for such property, shall be included in the gross income of the
person who performed such services in the first taxable year in which the rights ... are transferable or are not subject to
a substantial risk of forfeiture". (c)(1): rights are "subject to a substantial risk of forfeiture if such person's rights to
full enjoyment of such property are conditioned upon the future performance of substantial services by any individual".
(USC83, https://uscode.house.gov/us/usc/119-136/t26/s83/, read 2026-10-31.)

An RSU itself is not "property" until shares are delivered. CFR833 (e): "the term 'property' includes real and personal
property other than either money or an unfunded and unsecured promise to pay money or property in the future." When the
shares are delivered on the vest date they are already vested, so 83(a) puts their value then into that year's income.
P525 Restricted Property (p.13): "When the property becomes substantially vested, you must include its FMV, minus any amount
you paid for it, in your income for that year. Your holding period for this property begins when the property becomes
substantially vested." The P525 Example 12 figure, 100 shares x ($200 FMV - $10 paid) = **$19,000**, is a self-check
(`rsu_income_83a`). (P525, https://www.irs.gov/pub/irs-pdf/p525.pdf, read 2026-10-31.)

For Social Security and Medicare, USC3121(v)(2)(A): "Any amount deferred under a nonqualified deferred compensation plan
shall be taken into account for purposes of this chapter as of the later of (i) when the services are performed, or (ii)
when there is no substantial risk of forfeiture of the rights to such amount." So the vest is Medicare wages in the vest's
year, as the brief adds it "to the employee's wages and Medicare wages".

- **S1** RSUs settle in shares on the vest date. A plan that delivers later would move the income tax (not the FICA wages)
  to the delivery date; the case has no such field.
- The section 83(i) deferral does not apply: it is for "qualified employees" of private corporations, and the deferral ends
  on "the first date on which any stock of the employer becomes readily tradable on an established securities market"
  (P525 Qualified Equity Grants, p.13). The company here has a market price.
- Every vest is valued at **today's price** (**P1**, a page convention): vests after today because no other price exists,
  and the year's earlier vests because the case has no historical prices. The law values each vest at its own vest-day
  FMV (83(a) above); the key cannot, and both columns use today's price.

### 3.3 Options vesting is not income (the page agrees)

USC83(e): "This section shall not apply to ... (3) the transfer of an option without a readily ascertainable fair market
value"; P525 Nonstatutory Stock Options: "If the FMV of the option isn't readily determinable at the time it's granted to
you (even if it's determined later), you don't have income until you exercise or transfer the option"; for statutory
options, "don't include any amount in your income when the option is granted" and "If you exercise a statutory stock option,
don't include any amount in income when you exercise the option" (AMT aside). P15B Employee Stock Options covers only
exercise and dispositions. The page puts no option in the vest tax; no exercise is modelled.

## 4. The page's position figures (page convention; the law has no counterpart)

With `price` today and spread = max(0, price - strike) per option share (`position`):
- held value = (brokerage shares + 401(k) shares) x price;
- vested options value = vested options x spread; **owned** = held value + vested options value;
- **unvested** = unvested RSU units x price + unvested options x spread; **exposure** = owned + unvested;
- **invested** = brokerage balance + 401(k) balance + vested options value + unvested;
- **share** = exposure / invested (blank when invested is 0); **level**: ok up to 10%, medium up to 25%, large above.
  **L1**: "up to" includes the boundary and the test is on the exact share, not the rounded one.
- **halving loss** = (held value + unvested RSU value) x 50% + for every option grant, all its options (vested and
  unvested) x (spread at today's price - spread at half the price).
- **G1** Vested RSUs count only through the holdings the case types (they were sold, or they are in the brokerage count).

## 5. The federal tax

### 5.1 The 2026 figures (read in Rev. Proc. 2025-32; identical to FEDKEY ss.1, 2, 5, 8, TLKEY s.5.1, PROPKEY s.6.1)

| Status | Bracket tops 10/12/22/24/32/35% (37% above) | Standard deduction | 0% to | 15% to | NIIT and Additional Medicare thresholds | Source |
|---|---|---|---|---|---|---|
| single | 12,400 / 50,400 / 105,700 / 201,775 / 256,225 / 640,600 | 16,100 | 49,450 | 545,500 | 200,000 | RP2532 s.4.01 Table 3, s.4.03, s.4.14(1); USC1411(b)(3), USC3101(b)(2)(C) |
| married_joint | 24,800 / 100,800 / 211,400 / 403,550 / 512,450 / 768,700 | 32,200 | 98,900 | 613,700 | 250,000 | RP2532 s.4.01 Table 1, s.4.03, s.4.14(1); USC1411(b)(1), USC3101(b)(2)(A) |
| married_separate | 12,400 / 50,400 / 105,700 / 201,775 / 256,225 / 384,350 | 16,100 | 49,450 | 306,850 | 125,000 | RP2532 s.4.01 Table 4, s.4.03, s.4.14(1); USC1411(b)(2), USC3101(b)(2)(B) |

`check_tables()` rebuilds all 21 printed "The Tax Is" base amounts of the three tables from the tops (for example single:
1,240 / 5,800 / 17,966 / 41,024 / 58,448 / 192,979.25). The rates are permanent: USC1 amendment note, "Pub. L. 119-21,
s.70101(a)(2), substituted 'beginning after 2017' for '2018 through 2025' in heading" of 1(j). P15 p.1: "P.L. 119-21 ...
permanently extends the individual income tax rates enacted by the Tax Cuts and Jobs Act (P.L. 115-97)."

### 5.2 Next year (2027): not published

The brief asks whether Rev. Proc. 2025-32 or a later one gives 2027 figures. It does not: RP2532 s.5.01-5.02, "Section 3 of
this revenue procedures applies to taxable years beginning in 2025" and "section 4 ... applies to taxable years beginning in
2026". No later one existed on 2026-10-31: IRSNEWS (October 2026, last reviewed 29-Oct-2026) lists IR-2026-118 to
IR-2026-129, none of them an inflation adjustment; IRSINFL (last reviewed 01-Dec-2025) lists 2026 (IR-2025-103) as the
latest year. Unofficial projections were seen on the web and are not used.

- **Y1** The key works the 2027 year on the **2026 tables held flat** and marks it `verified = False`. Those 2027 owed
  columns are a contrast only; the page indexes 2027 its own way, which the key cannot reproduce (independence rule), so the
  main comparison checks only 2026 years. The statutory figures that do not index carry over unchanged: the NIIT and
  Additional Medicare thresholds (I8959: "The threshold amounts below aren't indexed for inflation"), the 0.9%, the $1,000,000
  and $200,000 withholding lines, and the 22% / 37% rates (5.1, 6.2).

### 5.3 A long-term gain stacked on top at 0/15/20%

USC1(h)(1)(B): "0 percent of so much of the adjusted net capital gain (or, if less, taxable income) as does not exceed the
excess (if any) of (i) the amount of taxable income which would (without regard to this paragraph) be taxed at a rate below
25 percent, over (ii) the taxable income reduced by the adjusted net capital gain"; (C) "15 percent of the lesser of ...";
(D) "20 percent of the adjusted net capital gain (or, if less, taxable income) in excess of the sum of the amounts on which
tax is determined under subparagraphs (B) and (C)". USC1(j)(5)(A) substitutes "below the maximum zero rate amount" and "below
the maximum 15-percent rate amount" (the 49,450 / 98,900 and 545,500 / 613,700 / 306,850 of 5.1). (USC1, read 2026-10-31.)

The key runs the I1040 Qualified Dividends and Capital Gain Tax Worksheet exactly (`qdcg_worksheet`): line 5 = taxable income
- the gain; line 9 "Subtract line 8 from line 7. This amount is taxed at 0%"; line 17 "the smaller of line 12 or line 16",
line 18 "Multiply line 17 by 15% (0.15)"; line 21 "Multiply line 20 by 20% (0.20)"; line 25 "Tax on all taxable income.
Enter the smaller of line 23 or line 24" (lines 22 and 24 by the exact formula, C2). A second way reads 1(h)(1)(A)-(D) with
1(j)(5) directly (`stacked_gain_tax`); the two agree at all 2,904 points of a grid (three statuses, taxable income 0 to
900,000 in steps of 7,500, eight gains from 0 to 700,000).

### 5.4 Net investment income tax

USC1411(a)(1): "a tax equal to 3.8 percent of the lesser of (A) net investment income for such taxable year, or (B) the excess
(if any) of (i) the modified adjusted gross income for such taxable year, over (ii) the threshold amount"; (b) "(1) in the
case of a taxpayer making a joint return ... $250,000, (2) in the case of a married taxpayer ... filing a separate return,
1/2 of the dollar amount determined under paragraph (1), and (3) in any other case, $200,000"; (c)(1)(A)(iii) "net gain (to
the extent taken into account in computing taxable income) attributable to the disposition of property". Wages are not net
investment income. Key: NIIT = 3.8% x min(gain, max(0, AGI - threshold)). (USC1411, read 2026-10-31.)

### 5.5 Additional Medicare Tax owed

USC3101(b)(2): "there is hereby imposed on every taxpayer (other than a corporation, estate, or trust) a tax equal to 0.9
percent of wages which are received with respect to employment ... and which are in excess of (A) in the case of a joint
return, $250,000, (B) in the case of a married taxpayer (as defined in section 7703) filing a separate return, 1/2 of the
dollar amount determined under subparagraph (A), and (C) in any other case, $200,000." (USC3101, read 2026-10-31.)

F8959 lines 1-7: "Medicare wages and tips from Form W-2, box 5", line 5 "$250,000 / $125,000 / $200,000", line 6 "Subtract line
5 from line 4. If zero or less, enter -0-", line 7 "Multiply line 6 by 0.9% (0.009)". I8959 Line 1: "If you are filing a joint
return, also include your spouse's wages and tips." Self-checks from I8959: Example 5, Erin $150,000 and Frank $175,000,
joint: "liable for Additional Medicare Tax on $75,000 of wages" (**675**), neither employer withholds; Example 4, Don,
separate, $200,000 of wages: liable on $75,000 (**675**), no withholding. (I8959, F8959, read 2026-10-31.)

Key: `addl_medicare_owed` = 0.9% x max(0, the return's Medicare wages - threshold) (`federal_return`).

## 6. Vests in view: owed, withheld, gap (page convention; law columns where it differs)

### 6.1 What the vests add to the year's tax

Vests in view are RSU vests dated **after today** and **on or before today + 12 calendar months** (today 2026-10-31: through
2027-10-31), each worth shares x today's price, grouped by calendar year. For each year Y:
- **earlier** = the value at today's price of the RSU vests dated on or before today in year Y (only 2026 has any; P1);
- **total** = the year's in-view vests;
- **before** = the year's return with earlier added to the employee's wages and Medicare wages; **after** = before + total;
- **owed_year** = tax(after) - tax(before), tax = income tax + Additional Medicare Tax (C2; the NIIT is 0 here);
- each vest's **owed** = owed_year x its value / total.

The law agrees: the vests are ordinary wage income of their year (3.2), on the employee's return when filing separately,
with the Additional Medicare Tax at the return's own threshold (5.5). 2026 uses 5.1; 2027 is the contrast of 5.2 (Y1), with
no earlier vests and the same salaries ("the same incomes on next year's brackets").

### 6.2 Federal income tax withheld: supplemental wages

CFR3402G (a)(1)(i): supplemental wages include "nonqualified deferred compensation includible in wages, ... income recognized on
the exercise of a nonstatutory stock option, ... and wage income recognized on the lapse of a restriction on restricted
property transferred from an employer to an employee". P15 section 7 (p.23): "Supplemental wages are wage payments to an
employee that aren't regular wages."

P15 p.24, "Withholding on supplemental wages when an employee receives more than $1 million of supplemental wages from you
during the calendar year": "If a supplemental wage payment, together with other supplemental wage payments made to the
employee during the calendar year, exceeds $1 million, the excess is subject to withholding at 37% (or the highest rate of
income tax for the year). Withhold using the 37% rate without regard to the employee's Form W-4." Below $1 million: "1. If
you withheld income tax from an employee's regular wages in the current or immediately preceding calendar year, you can use
one of the following methods for the supplemental wages. a. Withhold a flat 22% (no other percentage allowed). b. [the
aggregate method] ... 2. If you didn't withhold income tax from the employee's regular wages in the current or immediately
preceding calendar year, use method 1b." "Regardless of the method you use to withhold income tax on supplemental wages,
they're subject to social security, Medicare, and FUTA taxes." What's New (p.1): "The withholding rate on supplemental wages
remains 22% (37% if supplemental wages paid to an employee during the calendar year exceed $1 million) because P.L. 119-21
permanently extended the individual tax rates enacted in P.L. 115-97." P15 Example 3: "You withhold 22% of $1,000, or $220,
from Sharon's bonus payment" (self-check). (P15, https://www.irs.gov/pub/irs-pdf/p15.pdf, read 2026-10-31.)

CFR3402G (a)(2) "Mandatory flat rate withholding. If a supplemental wage payment, when added to all supplemental wage payments
previously made by one employer ... to an employee during the calendar year, exceeds $1,000,000, the rate used in determining
the amount of withholding on the excess (including any excess which is a portion of a supplemental wage payment) shall be
equal to the highest rate of tax applicable under section 1 for such taxable years beginning in such calendar year ...
without regard to any entries on Form W-4"; (a)(4)(iv): the employer "is required to impose withholding under paragraph (a)(2)
of this section only on the portion of the payment that is in excess of $1,000,000 ... However, an employer may subject the
entire amount of such supplemental wage payment to the withholding imposed by paragraph (a)(2)"; (a)(7)(i) optional flat rate
withholding needs "(A) Paragraph (a)(2) of this section does not apply to the payment or the portion of the payment; (B) The
supplemental wages are either not paid concurrently with regular wages or are separately stated on the payroll records of the
employer; and (C) Income tax has been withheld from regular wages of the employee during the calendar year of the payment or
the preceding calendar year"; (a)(7)(iii)(F) "by using a flat percentage rate of 28 percent (or the corresponding rate in
effect under section 1(i)(2) for taxable years beginning in the calendar year in which the payment is made)". (CFR3402G, read
2026-10-31.) The regulation's own examples, worked with their assumed 25% / 35%, are self-checks: Example 1, $600,000 then a
$2,300,000 bonus, "the first $400,000 ... at 25 percent ... $100,000", "The amount withheld from the $1,900,000 would be
$665,000", or all at 35% "$805,000", then "$10,000 ... $3,500"; Example 3, a $3,000,000 first bonus: $250,000 on the first
$1,000,000, then 35% on $2,000,000.

Key (page and law): the year's supplemental wages are counted in order, the year's earlier vests first, then the in-view
vests by date; each vest is withheld 22% on its part up to $1,000,000 of the running total and 37% on its part past it
(`supplemental_withholding`). The running total starts again at 0 on January 1 ("during the calendar year").
- **W1** The employer uses the optional 22% flat rate below $1,000,000 and has withheld income tax from the employee's salary
  this year or last ((a)(7)(i)(C)); the RSU vests are the employee's only supplemental wages (no bonus). A row with no
  employee pay is flagged (`flat_rate_condition_met = False`): there the law requires the aggregate method, which the key
  does not model.
- **W2** (law contrast) A vest that crosses $1,000,000 may be withheld at 37% in full ((a)(4)(iv)): `supp_withheld_whole`,
  `gap_whole`.
- **T1** Vests of different grants on the same day are taken in grant order. The day's total is the same in any order; the
  per-vest split differs only when the $1,000,000 line falls inside that day (`tie_crosses_1m` flags it; compare day totals
  there).

### 6.3 Additional Medicare Tax withheld

USC3102(f)(1): "In the case of any tax imposed by section 3101(b)(2), subsection (a) shall only apply to the extent to which the
taxpayer receives wages from the employer in excess of $200,000, and the employer may disregard the amount of wages received by
such taxpayer's spouse"; (f)(2): "To the extent that the amount of any tax imposed by section 3101(b)(2) is not collected by the
employer, such tax shall be paid by the employee." (USC3102, read 2026-10-31.) CFR3102 (a): "This rule applies regardless of
the employee's filing status or other income. Thus, the employer disregards any amount of wages ... paid to the employee's
spouse"; its Example, H $100,000 and I $300,000 on a joint return: "I's employer is required to collect Additional Medicare Tax
only with respect to wages it pays which are in excess of the $200,000 threshold (that is, $100,000)" (**900**, self-check;
owed on the return 0.9% x 150,000 = 1,350). P15 pp.29-30: "you must withhold a 0.9% Additional Medicare Tax from wages you pay
to an employee in excess of $200,000 in a calendar year. You're required to begin withholding Additional Medicare Tax in the
pay period in which you pay wages in excess of $200,000 to an employee and continue to withhold it each pay period until the
end of the calendar year." I8959: "Your employer must withhold Additional Medicare Tax on wages it pays to you in excess of
$200,000 for the calendar year, regardless of your filing status and regardless of wages or compensation paid by another
employer"; "If you don't owe Additional Medicare Tax, you can claim a credit for any withheld Additional Medicare Tax against
the total tax liability shown on your tax return by filing Form 8959" (F8959 line 22 "Subtract line 21 from line 19 ... This is
your Additional Medicare Tax withholding on Medicare wages", line 24 to Form 1040 line 25c).

Key (brief): medicare_held_year = 0.9% x (max(0, pay + earlier + total - 200,000) - max(0, pay + earlier - 200,000)), shared
among the year's vests by value, where **pay** = the employee's salary, or with no salary on file the typed wages divided by
the adults on the return (2 joint, 1 single).
- **M1** The salary is counted before the vests. The employer's withholding for the whole calendar year is 0.9% x
  max(0, pay + earlier + total - 200,000) in any order; what part of it falls on the vests depends on the pay dates, which the
  case does not have. The key takes the page's salary-first increment, which matches the owed increment of 6.1.
- **M2** Typed wages on a joint return are split evenly between the two adults for `pay` (brief).
- **F1** Social Security (6.2% up to the $184,500 wage base, P15 p.29) and the 1.45% Medicare tax on the vests are withheld
  exactly as owed by the one employer and are left out of owed, withheld and gap.

### 6.4 The gap

Withheld per vest = its supplemental withholding + its share of medicare_held_year; **gap** per vest = owed - withheld;
gap_year = owed_year - (the year's supplemental withholding + medicare_held_year). A negative gap is over-withholding.

## 7. Illinois' share of the vests (Illinois rows)

**Page (main column).** Today's year: 4.95% x (max(0, AGI_today + earlier + total - allowance) - max(0, AGI_today + earlier -
allowance)); next year the same without earlier; shared among the year's vests by value. AGI_today = the salaries (or typed
wages) on the return that carries the vests (the employee's own salary when filing separately); allowance = $2,850 x people on
the return (1 single and separate, 2 joint).

**Law (law column).** ILRATES: "Individual Income Tax ... Effective July 1, 2017: 4.95 percent of net income". IL700T p.1:
"The income tax rate is 4.95 percent and the exemption allowance is $2,925." ILQ851: "For tax year beginning January 1, 2025,
it is $2,850 per exemption ... For tax year beginning January 1, 2026, it is $2,925 per exemption ... Note: The Illinois
exemption allowance is not allowed if a taxpayer's federal adjusted gross income (AGI) exceeds $500,000 for returns with a
federal filing status of married filing jointly, or $250,000 for all other returns." ILB15 p.2: "The personal exemption amount
for tax year 2026 will increase to $2,925." IL1040I Line 10a: the chart gives "Single*" (which "includes Single, Head of
Household, Widowed, and Married filing separately") one exemption and "Married filing jointly" two; "Income Exceptions: If your
federal filing status is married filing jointly and your federal AGI is greater than $500,000, you are not entitled to an
exemption allowance"; Line B: "In general, you should use the same filing status as on your federal return." (IDOR pages,
read 2026-10-31.) Filing separately is required, not only usual: 35 ILCS 5/502(c)(1)(C), "if the federal income tax liability
of either spouse is determined on a separate federal income tax return, they shall file separate returns under this Act"
(https://codes.findlaw.com/il/chapter-35-revenue/il-st-sect-35-5-502/, "Current as of January 01, 2025", read 2026-10-31;
ilga.gov did not answer that day; not hashed). So on a separate row each spouse has their own Illinois return, with their
own income and one exemption, and the vests' share is worked on the employee's.

Key (`il_tax_law`): IL tax = 4.95% x max(0, federal AGI - allowance), allowance = $2,925 per person, or 0 when federal AGI
exceeds $250,000 ($500,000 joint); the vests' share = IL tax(after) - IL tax(before). **Finding:** the brief's "$2,850 per
person ... 2026" is the 2025 figure; the page column keeps it and the law column uses $2,925 and the income limit.
- **S2** Illinois base income = federal AGI (wages and, for the sale, a capital gain: no Illinois addition or subtraction
  applies). Illinois withholding on the vests is not modelled; the state share is a cost, not a withholding.
- **Y2** 2027: IDOR has published no 2027 exemption (it is indexed); the law contrast holds $2,925 flat (not verified).

## 8. Getting under 10%: the diversifying sale

**Page (main column).** Only when share > 10% and held value > 0: need = min(held value, exposure - 10% x invested); the
401(k)'s company shares first (no tax), the rest from the brokerage; gain = the amount from the brokerage x (brokerage gain /
brokerage value), brokerage gain = max(0, value - cost), value = the brokerage's company shares x price; taxed as a long-term
gain: tax = the 2026 federal tax (C2) with this year's vests (earlier + in-view vests dated in 2026) in the employee's wages
and Medicare wages and the gain added to long-term gains and net investment income, less the same without the gain. Filing
separately, the gain goes on the return of the brokerage owner: employee, spouse, or joint = half on each, and the tax is the
sum of both returns' changes. The proceeds stay invested, so after the sale share = (exposure - need) / invested.

**Law (where it agrees).** The 401(k) sale is not taxed: USC402(a), "any amount actually distributed to any distributee by any
employees' trust described in section 401(a) which is exempt from tax under section 501(a) shall be taxable to the
distributee, in the taxable year of the distributee in which distributed". The brokerage gain is stacked at 0/15/20% (5.3)
with the NIIT (5.4) on the owner's return.

**Holding period.** USC1222(3): "The term 'long-term capital gain' means gain from the sale or exchange of a capital asset held
for more than 1 year"; USC83(f): the holding period of vested RSU shares includes "only the period beginning at the first time
his rights in such property are transferable or are not subject to a substantial risk of forfeiture" (P525: "Your holding
period for this property begins when the property becomes substantially vested"). Shares from a vest of the last 12 months
would be short-term. **H1** The case gives no purchase or vest dates for the holdings: the key, like the page, treats the
brokerage shares as held more than a year.
- **H2** The brokerage holding is one lot with one total basis, so the gain is pro rata (FIFO or specific identification
  would give the same on a single lot). **H3** The sale is a dollar amount; fractional shares are allowed.
- **O1** The 401(k)'s shares are the employee's; separate rows name the brokerage owner.

**Law contrasts.**
- A sale at a **loss** (cost above value): the page taxes nothing (gain floored at 0). USC1211(b): "losses from sales or
  exchanges of capital assets shall be allowed only to the extent of the gains from such sales or exchanges, plus (if such
  losses exceed such gains) the lower of (1) $3,000 ($1,500 in the case of a married individual filing a separate return), or
  (2) the excess of such losses over such gains." Law column `sale_tax_law`: the loss reduces AGI by at most $3,000 ($1,500
  separate) on the owner's return, the rest carries over (TLKEY s.5.3 treats the same limit).
- Illinois rows: Illinois taxes the gain at 4.95% (7, with the AGI limit); `sale_state_tax_law`. The page's sale tax is federal
  only.

## 9. Worked examples (invented people; asserted by `rules.py`)

All amounts in dollars; today is **2026-10-31** and the price **$100** in every example. "One December vest" is an RSU grant
with `vest_start` 2025-12-15, `vest_months` 12, `cliff_months` 12: its only month is 12, so all its shares vest on
2026-12-15. Single-filer tax on taxable income T in 2026 (5.1): 1,240 + 12% over 12,400; 5,800 + 22% over 50,400; 17,966 +
24% over 105,700; 58,448 + 35% over 256,225; 192,979.25 + 37% over 640,600.

### 9.1 Ari: $90,000 of pay and one $100,000 vest in December (22% into 24%)

Single, salary 90,000, one December vest of 1,000 RSUs. No earlier vests in 2026.
- Before: taxable 90,000 - 16,100 = **73,900**; tax 5,800 + 22% x 23,500 = **10,970**.
- After: taxable **173,900**; tax 17,966 + 24% x 68,200 = **34,334**. Medicare wages 190,000: no 0.9% either way.
- Owed **23,364** = 31,800 x 22% (73,900 to 105,700) + 68,200 x 24% (105,700 to 173,900) = 6,996 + 16,368.
- Withheld 22% x 100,000 = **22,000**; 0.9%: 90,000 + 100,000 never passes 200,000, so **0**. Gap **1,364**.
- Page: unvested 100,000; invested 50,000 + 150,000 + 100,000 = 300,000; share 0.333333, large; halving loss 50,000; no sale
  (nothing held).

### 9.2 Bo: the same, with $300,000 vested earlier in 2026 (all in the 35% band, $900 of 0.9%)

Single, salary 90,000; 16,000 RSUs from 2022-12-15 (48 / 12 / 3): 4,000 on 2023-12-15, then 1,000 a quarter, the last on
2026-12-15. In 2026, March 15, June 15 and September 15 are earlier (**300,000**), December 15 is in view (**100,000**).
- Before: wages 390,000, taxable 373,900, income tax 58,448 + 35% x 117,675 = **99,634.25**, 0.9% x 190,000 = 1,710.
- After: wages 490,000, taxable 473,900 (still under 640,600), income tax **134,634.25**, 0.9% x 290,000 = 2,610.
- Owed **35,900** = 35% x 100,000 + 0.9% x 100,000.
- Withheld: supplemental 300,000 -> 400,000, all under $1,000,000: 22% x 100,000 = 22,000; 0.9%: 0.9% x (290,000 - 190,000) =
  **900**; withheld **22,900**. Gap **13,000**.
- Page: balances 400,000 + 300,000; share 100,000 / 800,000 = 0.125000, medium.

### 9.3 Cal: four $300,000 vests in 2026 (200,000 of the December one withheld at 37%)

Single, salary 90,000; 48,000 RSUs from 2022-12-15 (3,000 a quarter after a 12,000 cliff). 2026: earlier March, June,
September = **900,000**; December 15 in view = **300,000**.
- Before: wages 990,000, taxable 973,900: 192,979.25 + 37% x 333,300 = 316,300.25, plus 0.9% x 790,000 = 7,110:
  **323,410.25**. After: wages 1,290,000, taxable 1,273,900: 427,300.25 + 9,810 = **437,110.25**. Owed **113,700** = 37% x
  300,000 + 0.9% x 300,000.
- Withheld: the running total goes 900,000 -> 1,200,000: 100,000 x 22% = 22,000 and **200,000 x 37% = 74,000**, 96,000; 0.9% x
  300,000 = 2,700; withheld **98,700**. Gap **15,000**.
- Law contrast W2: the employer may withhold the whole crossing vest at 37%: 111,000 + 2,700 = 113,700, gap **0**.
- Page: balances 2,000,000 + 500,000; share 300,000 / 2,800,000 = 0.107143, medium.

### 9.4 Dee and Eli: joint, $180,000 and $60,000 of pay, a $120,000 vest (0.9% owed against 0.9% withheld)

Married filing jointly; Dee (the employee) 180,000, Eli 60,000; one December vest of 1,200 RSUs.
- Before: wages 240,000, taxable 240,000 - 32,200 = 207,800: 11,600 + 22% x 107,000 = **35,140**; 240,000 is under the joint
  250,000: no 0.9%.
- After: wages 360,000, taxable 327,800: 35,932 + 24% x 116,400 = **63,868**; 0.9% x (360,000 - 250,000) = **990**.
- Owed 28,728 (3,600 x 22% + 116,400 x 24%) + 990 = **29,718**.
- Withheld: 22% x 120,000 = 26,400; Dee's employer withholds 0.9% past Dee's own 200,000: 0.9% x (300,000 - 200,000) = **900**
  (Eli's wages disregarded, 3102(f)(1)); withheld **27,300**. Gap **2,418** (90 of it is the 0.9% owed on 10,000 more than was
  withheld on).
- Page: balances 100,000 + 380,000; share 120,000 / 600,000 = 0.200000, medium.

### 9.5 Fay: Illinois, single, $40,000 of pay, a $50,000 vest

One December vest of 500 RSUs.
- Federal: before taxable 23,900, tax 1,240 + 12% x 11,500 = **2,620**; after taxable 73,900, **10,970**; owed **8,350**;
  withheld 11,000; gap **-2,650** (over-withheld: most of the vest sits in the 12% and 22% bands).
- Illinois, page: 4.95% x ((90,000 - 2,850) - (40,000 - 2,850)) = 4.95% x 50,000 = **2,475** (before 1,838.925, after
  4,313.925). Law: 4.95% x ((90,000 - 2,925) - (40,000 - 2,925)) = **2,475**: the same, since both returns are above the
  allowance and under the $250,000 limit.
- Fay at a salary of **230,000** (balances 200,000 + 300,000): page still **2,475**; law: before AGI 230,000 keeps the
  allowance, 4.95% x 227,075 = 11,240.2125; after AGI 280,000 exceeds 250,000 and loses it, 4.95% x 280,000 = 13,860; the
  vest's share **2,619.79** (2,475 + 4.95% x 2,925).

### 9.6 Gus: a $90,000 sale with a $45,000 gain (part at 0%, part at 15%)

Single, salary 40,000, no grants; 2,000 shares in the brokerage (value 200,000, cost 100,000), none in the 401(k); balances
brokerage 300,000, 401(k) 800,000.
- Page: exposure 200,000; invested 1,100,000; share 0.181818, medium. need = min(200,000, 200,000 - 110,000) = **90,000**, all
  from the brokerage (900 shares); gain = 90,000 x 100,000 / 200,000 = **45,000**. After: 110,000 / 1,100,000 = 0.100000.
- Tax without the gain: taxable 23,900, **2,620**. With it: AGI 85,000, taxable 68,900. Worksheet: line 5 = 23,900; line 9 =
  49,450 - 23,900 = **25,550 at 0%**; line 17 = 45,000 - 25,550 = **19,450 at 15%** = 2,917.50; line 23 = 2,917.50 + 2,620 =
  5,537.50 against line 24 = 9,870: **5,537.50**. No NIIT (MAGI 85,000). Sale tax **2,917.50**. Halving loss 100,000.
- 9.6b, the same shares bought for 300,000 (a loss): page gain 0, tax **0**. Law: the sale loses 90,000 x (200,000 - 300,000)
  / 200,000 = 45,000; 3,000 is allowed against the wages (taxable 20,900, tax 2,260), **-360**, and 42,000 carries over.

### 9.7 Gus with a $100,000 vest in December (all of the gain at 15%)

The same, plus one December vest of 1,000 RSUs; the 401(k) balance is 1,700,000 so that the sale stays 90,000: exposure
300,000, invested 2,100,000, share 0.142857, need = min(200,000, 300,000 - 210,000) = **90,000**, gain **45,000**.
- This year's vests: 100,000 (in view, dated in 2026). Tax without the gain: wages 140,000, taxable 123,900, 17,966 + 24% x
  18,200 = **22,334**. With it: AGI 185,000, taxable 168,900; line 5 = 123,900 is above 49,450, so line 9 = 0 and all
  **45,000 at 15%** = 6,750; tax **29,084** (line 24: 33,134). MAGI 185,000 is under 200,000: no NIIT. Sale tax **6,750**.
- The vest itself: 2,620 -> 22,334, owed **19,714** (26,500 x 12% + 55,300 x 22% + 18,200 x 24%); withheld 22,000; gap
  **-2,286**.

### 9.8 Bea: the whole page

Single, salary 120,000. Grants: 1,000 RSUs from 2023-08-31 and 2,000 options at $60 from 2024-04-15 (both 48 / 12 / 3).
Holdings: 500 shares in the brokerage (cost 20,000), 300 in the 401(k). Balances: brokerage 120,000, 401(k) 250,000.

RSU schedule (cumulative = floor(1,000 x m / 48)):

| m | Date | Cumulative | Vest |
|---|---|---|---|
| 12 | 2024-08-31 | 250 | 250 |
| 15 | 2024-11-30 (no November 31) | 312 | 62 |
| 18 | 2025-02-28 | 375 | 63 |
| 21 | 2025-05-31 (counted from the start, not from February 28) | 437 | 62 |
| 24 ... 27 | 2025-08-31, 2025-11-30 | 500, 562 | 63, 62 |
| 30, 33, 36 | 2026-02-28, 2026-05-31, 2026-08-31 | 625, 687, 750 | 63, 62, 63 (the year's earlier vests: 188 = **18,800**) |
| 39 | 2026-11-30 | 812 | **62 in view, 2026** |
| 42, 45, 48 | 2027-02-28, 2027-05-31, 2027-08-31 | 875, 937, 1,000 | **63, 62, 63 in view, 2027** |

Options: floor(2,000 x m / 48) = 125 x m / 3, 500 at m = 12 then 125 a quarter; m = 30 is 2026-10-15 (vested), m = 33 is
2027-01-15: vested **1,250**, unvested 750; spread 100 - 60 = 40.

- held 800 x 100 = **80,000**; vested options 1,250 x 40 = **50,000**; owned **130,000**; unvested 250 x 100 + 750 x 40 =
  **55,000**; exposure **185,000**; invested 120,000 + 250,000 + 50,000 + 55,000 = **475,000**; share 37/95 = **0.389474**,
  large.
- Halving: (80,000 + 25,000) x 50% = 52,500, plus the options' spread falling from 40 to max(0, 50 - 60) = 0 on all 2,000:
  80,000; loss **132,500**.
- 2026 vest (62 shares, 6,200): before wages 138,800, taxable 122,700, **22,046**; after 128,900, **23,534**; owed **1,488**
  (24%); withheld 22% x 6,200 = 1,364, no 0.9% (wages 145,000); gap **124**.
- 2027 vests (contrast on the 2026 tables, Y1): before wages 120,000, taxable 103,900, 17,570; after 138,800, taxable 122,700,
  22,046; owed **4,476** (1,800 x 22% + 17,000 x 24%), per vest 4,476 x 63/188 = **1,499.94**, x 62/188 = **1,476.13**,
  1,499.94; withheld 1,386 + 1,364 + 1,386 = 4,136; gap **340** (the rounded per-vest gaps 113.94 + 112.13 + 113.94 add to
  340.01: R1).
- Sale: need = min(80,000, 185,000 - 47,500) = **80,000**: 30,000 (300 shares) from the 401(k), 50,000 (500 shares) from the
  brokerage, gain 50,000 x 30,000 / 50,000 = **30,000**. This year's wages 120,000 + 18,800 + 6,200 = 145,000, taxable 128,900:
  the whole gain at 15% = **4,500**; MAGI 175,000, no NIIT. Share after 105,000 / 475,000 = 0.221053 (still medium: the held
  shares run out first).

### 9.9 Hal and Ivy: married filing separately

Hal (the employee) 150,000, Ivy 90,000; one December vest of 500 RSUs (50,000); 1,000 shares in a **joint** brokerage account
(value 100,000, cost 60,000); balances brokerage 150,000, 401(k) 800,000.
- Vest, on Hal's separate return: before taxable 133,900, 17,966 + 24% x 28,200 = 24,734, 0.9% x (150,000 - 125,000) = 225:
  **24,959**; after taxable 183,900, 36,734, 0.9% x 75,000 = 675: **37,409**; owed **12,450** (12,000 + 450). Withheld 22% x
  50,000 = 11,000; Hal's employer withholds 0.9% only past 200,000 and Hal's wages reach exactly 200,000: **0**. Gap **1,450**:
  the separate return owes 0.9% from 125,000, the employer withholds from 200,000.
- Page: exposure 150,000, invested 1,000,000, share 0.150000; need = min(100,000, 150,000 - 100,000) = **50,000**, from the
  brokerage; gain 50,000 x 40,000 / 100,000 = **20,000**, half on each return.
- Hal's return (wages 200,000 with the vest): 10,000 at 15% = 1,500; NIIT 3.8% x min(10,000, 210,000 - 125,000) = 380:
  **1,880**. Ivy's (wages 90,000, taxable 73,900, above the 49,450 0% top): 10,000 at 15% = **1,500**, MAGI 100,000 under
  125,000. Sale tax **3,380**. Owned by Hal alone: 3,000 + 760 = **3,760**; by Ivy alone: **3,000**.
- 9.9b, Hal's own account bought for 160,000 (a loss): page tax **0**; law: the 30,000 loss allows only **1,500** on a
  separate return (1211(b)(1)), at Hal's 24%: **-360**; 28,500 carries over.

### 9.10 Source examples asserted by `rules.py`

P525 Example 12 (19,000); P15 section 7 Example 3 (220); CFR3402G (a)(8) Examples 1 and 3 (765,000 / 805,000 / 3,500;
250,000 + 700,000 / 35,000); CFR3102 (a) Example (0 and 900 withheld, 1,350 owed); I8959 Examples 4 and 5 (675 each, nothing
withheld); F8959 Part V (box 6 on 300,000 = 4,350 + 900 = 5,250; line 22 = 900); IL700T Step 2a (2 x 2,925 = 5,850); the
Illinois limit "exceeds" (AGI 250,000 keeps the allowance, 250,001 loses it); the vest edges (a vest dated today is vested and
earlier; today + 12 months is in view, a day later is not); the level edges (exactly 10% is ok and sells nothing).

## 10. Rounding and outputs

Exact Fractions throughout; money is rounded half up to the cent and rates and ratios to six decimals only when shown (**R1**:
"Money to the cent; rates and ratios to six decimals"). Each figure is rounded on its own, so the rounded per-vest values of a
year can differ from the rounded year by a cent per vest (9.8). Suggested columns:
- Position: `held_value`, `vested_options_value`, `owned`, `unvested`, `exposure`, `invested`, `share`, `level`,
  `halving_loss`; per grant `vested`, `unvested`, `spread`.
- Per vest in view: `grant`, `date`, `shares`, `value`, `year`, `owed`, `supp_withheld`, `medicare_held`, `withheld`, `gap`,
  `supp_withheld_whole` (W2), `state_page`, `state_law` (Illinois rows).
- Per year: `earlier`, `total`, `tax_before`, `tax_after`, `owed_year`, `supp_withheld_year`, `medicare_held_year`,
  `withheld_year`, `gap_year`, `gap_whole_year`, `state_page_year`, `state_law_year`, `verified` (False for 2027, Y1),
  `tie_crosses_1m` (T1), `flat_rate_condition_met` (W1).
- Sale: `need`, `from_401k`, `from_brokerage`, `gain`, `sale_tax`, `share_after`; law: `gain_signed`, `sale_tax_law`,
  `sale_state_tax_law`.

## 11. Conventions in one list

C1 adults under 65, standard deduction, salary = wages = Medicare wages, vests on the employee's return; C2 income tax (exact
formula) + NIIT + Additional Medicare, no credits or AMT; C3 the sale's gain is the only net investment income, MAGI = AGI;
V2 bad schedules refused; Z1 zero-share vests left out; S1 RSUs settle on the vest date; P1 every vest at today's price; G1
vested RSUs count only through holdings; L1 level boundaries inclusive on the exact share; Y1 2027 on the 2026 tables,
contrast only; Y2 Illinois 2027 on 2026's $2,925, contrast only; W1 the optional 22% flat rate, only RSU vests as supplemental
wages, rows without employee pay flagged; W2 whole-payment 37% as a contrast; T1 same-day vests in grant order; M1 salary
before vests for the 0.9% withholding; M2 typed joint wages split in two for `pay`; F1 Social Security and 1.45% Medicare left
out; S2 Illinois base income = federal AGI, no Illinois withholding; H1 brokerage shares long-term; H2 one lot, pro rata gain;
H3 fractional shares; O1 the 401(k) is the employee's, separate rows name the brokerage owner; R1 exact, rounded when shown.

## 12. Not verified, open points, findings

- **2027 federal tables: not published on 2026-10-31** (5.2). The 2027 owed, gap and per-vest columns are a contrast on the
  2026 tables (Y1) and should not be compared strictly with the page's own indexing.
- **Illinois 2027 exemption**: not published (Y2). The Illinois statute (35 ILCS 5/201, 5/204) was not read; the figures are
  IDOR's. Of the statute only 5/502(c)(1)(C) (separate federal returns mean separate Illinois returns) was read (7).
- **Editions**: Pub. 525 (2025) and the 2025 Form 8959 instructions are applied to 2026 and 2027; Pub. 15 (2026) to 2027.
  USC83(a), 3101(b)(2) and 3102(f) have no amendment since 2018 (USC83: last 2017, Pub. L. 115-97 added (i); USC3101: Pub. L.
  115-141, 2018, in (a); USC3102: last Pub. L. 111-148).
- **The 22% rate's legal basis**: CFR3402G (a)(7)(iii)(F) still reads "28 percent (or the corresponding rate in effect under
  section 1(i)(2) ...)"; the 22% is from P15 (2026) What's New and section 7. The uncodified Pub. L. 108-357 s.904(b) and how
  the 1(j) rates map onto it were not read. The mandatory rate is the "highest rate of tax applicable under section 1" (37%,
  RP2532 Tables 1, 3, 4).
- Not modelled: the aggregate withholding method (W1), bonuses and other supplemental wages, settlement after vesting,
  share withholding (net settlement) rounded to whole shares, Illinois withholding, 401(k) deferrals, option exercises and the
  AMT on incentive stock options, short-term holdings (H1), wash sales.
- **Finding on the brief**: the Illinois exemption for 2026 is **$2,925**, not $2,850 (ILQ851, ILB15, IL700T), and it is lost
  above federal AGI $250,000 ($500,000 joint). Expected on the page (to be confirmed by the comparison): the page's state share
  uses $2,850 and no income limit. The allowance cancels out of the vests' share whenever the income before the vests is
  already above it, so page and law agree on most rows (9.5); they differ (a) by up to 4.95% x 75 = 3.71 a person when the
  income before the vests is under the allowance, and (b) by 4.95% x 2,925 x people (144.79 single, 289.58 joint) when the
  vests push federal AGI over $250,000 ($500,000 joint) from under it (9.5, Fay at 230,000).
- **Expected law-vs-page differences** (contrast columns): the whole-payment 37% option on a vest that crosses $1,000,000
  (9.3); a sale at a loss (9.6b, 9.9b); Illinois tax on the sale gain; the 2027 tables. The page and the law agree on the
  owed tax with the Additional Medicare Tax at the return's threshold, the 22% / 37% split, the employer's 0.9% from $200,000
  whatever the filing status, option vests not being income, and the 401(k) sale being untaxed.
