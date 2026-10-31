# Estimated tax and withholding answer key: the rules

This file states, in plain words, the rules behind the answer key for two pages of the app:
**Estimated payments** (how much to send the IRS each quarter, and where you stand today) and
**Withholding check** (whether what comes out of your pay will cover the year's tax). Tax years
2025, 2026 and 2027. Each rule comes with the source text it rests on, the address, and the date it
was read. Where no source decides, the file says which convention the key adopts. Section 9 works the
examples by hand, using invented people.

`tools/golden_estimated/rules.py` holds the same figures as data, with the source and the date read on
the line of each figure, plus small pure functions (one per rule) and `evaluate(case)` for one CSV row.
It uses Python 3's standard library only, and the arithmetic is exact (`Fraction`). Importing it runs
`check_tables()`. That function rebuilds every bracket base the revenue procedures print, replays rows
of the IRS Tax Table, rebuilds every due date and legal-holiday list the IRS printed, checks that the
alternative minimum tax can never apply to these cases, checks the examples below, and fails loudly if
anything disagrees. Run it with `python3 -B` so no `__pycache__` is written (the file sets
`sys.dont_write_bytecode`, which protects only the modules it imports itself).

**Independence.** The key was written from the law, the regulations and the IRS's own publications.
Nobody opened `modules/`, `core/` or `tests/*.test.mjs` while writing it, and it never imports or runs
the app. Only the layout and conventions of `tools/golden_health/` and `tools/golden_estate/` were
looked at; no figure or code is shared with them. The federal brackets and standard deductions were
read in the revenue procedures themselves and agree with `tests/golden/taxes/RULES.md` (the federal
key), which is cited for comparison. The pages' documented model (the task's rules 1-9) is the spec.
Where the law says otherwise, the key follows the law and section 10 keeps the page's way in a
contrast column.

All sources were read on **2026-10-31**. Section 13 lists them with their sha256. The U.S. Code text is
the Office of the Law Revision Counsel edition "current through Public Law 119-136 (October 22, 2026)",
at `https://uscode.house.gov/us/usc/119-136/t26/s<section>/`. The regulations are eCFR title 26, "up to
date as of 2026-10-29".

---

## 1. This year's tax (what the case calls "total federal tax")

**Rule.** The only income is taxable interest. There are no wages, no dependents, no credits, and the
standard deduction applies. So:

> tax = regular income tax on max(0, interest - standard deduction), through the year's brackets

worked with the exact bracket formula (no Tax Table rounding), the same way the federal key does
("Tax is worked with the Tax Computation formula on exact amounts", `tests/golden/taxes/RULES.md` s.1).

**Married filing separately is two returns** (since 2026-10-31). On a separate row with two adults, each
spouse files a return of their own:

> "If you file a separate return, you generally report only your own income, credits, and deductions."
> (Publication 501 (2025), Married Filing Separately, How to file, https://www.irs.gov/publications/p501, read 2026-10-31)

The case's interest is the household's, in neither name, so each return reports half of it and takes its own
standard deduction; each return's tax is worked to the cent on its own, and the row's tax is the two added. The
withholding, the estimates and last year's figures stay the household's, as the pages keep them (section 7
notes where the law credits only the filer's own withholding). The key first worked one combined return at the
separate rates, as the pages then did; both changed on the same day.

**Brackets** (top of each bracket; 37% has no top). Rates 10, 12, 22, 24, 32, 35, 37%.

| Year | Status | 10% to | 12% to | 22% to | 24% to | 32% to | 35% to | Source |
|---|---|---|---|---|---|---|---|---|
| 2025 | married_joint | 23,850 | 96,950 | 206,700 | 394,600 | 501,050 | 751,600 | Rev. Proc. 2024-40 s.2.01 Table 1 |
| 2025 | head_of_household | 17,000 | 64,850 | 103,350 | 197,300 | 250,500 | 626,350 | s.2.01 Table 2 |
| 2025 | single | 11,925 | 48,475 | 103,350 | 197,300 | 250,525 | 626,350 | s.2.01 Table 3 |
| 2025 | married_separate | 11,925 | 48,475 | 103,350 | 197,300 | 250,525 | 375,800 | s.2.01 Table 4 |
| 2026 | married_joint | 24,800 | 100,800 | 211,400 | 403,550 | 512,450 | 768,700 | Rev. Proc. 2025-32 s.4.01 Table 1 |
| 2026 | head_of_household | 17,700 | 67,450 | 105,700 | 201,750 | 256,200 | 640,600 | s.4.01 Table 2 |
| 2026 | single | 12,400 | 50,400 | 105,700 | 201,775 | 256,225 | 640,600 | s.4.01 Table 3 |
| 2026 | married_separate | 12,400 | 50,400 | 105,700 | 201,775 | 256,225 | 384,350 | s.4.01 Table 4 |

> "TABLE 3 - Section 1(j)(2)(C) - Unmarried Individuals ... Not over $11,925 | 10% of the taxable
> income; Over $11,925 but not over $48,475 | $1,192.50 plus 12% of the excess over $11,925; ..."
> (Rev. Proc. 2024-40, s.2.01, https://www.irs.gov/pub/irs-drop/rp-24-40.pdf, read 2026-10-31)

The 2025 tables were not changed by the July 2025 law: Rev. Proc. 2025-32 section 3 ("2025 adjusted
items as modified") removes only s.2.15(1) (the standard deduction) and s.2.25 (expensing) of Rev. Proc.
2024-40. `check_tables()` rebuilds every "The Tax Is" base amount the procedures print (for example
2025 single "$188,769.75 plus 37%" at $626,350) from the bracket tops.

**Standard deduction.**

| Year | single | married_joint | married_separate | head_of_household | Source |
|---|---|---|---|---|---|
| 2025 | 15,750 | 31,500 | 15,750 | 23,625 | Pub. L. 119-21 s.70102(b); Rev. Proc. 2025-32 s.3.01 |
| 2026 | 16,100 | 32,200 | 16,100 | 24,150 | Rev. Proc. 2025-32 s.4.14(1) |

> "(b) Additional Increase in Standard Deduction.--Paragraph (7) of section 63(c) is amended-- (1) by
> striking ``$18,000'' ... and inserting ``$23,625'', (2) by striking ``$12,000'' ... and inserting
> ``$15,750'' ... (c) Effective Date.--The amendments made by this section shall apply to taxable
> years beginning after December 31, 2024."
> (Pub. L. 119-21 s.70102, https://www.govinfo.gov/content/pkg/PLAW-119publ21/html/PLAW-119publ21.htm, read 2026-10-31)

> "Section 63(c)(7) as amended by the OBBBA provides the standard deduction amounts under § 63(c)(2)
> for any taxable year beginning in 2025 as follows: ... $31,500 ... $23,625 ... $15,750 ... $15,750.
> Accordingly, section 2.15(1) of Rev. Proc. 2024-40 is removed."
> (Rev. Proc. 2025-32 s.3.01, https://www.irs.gov/pub/irs-drop/rp-25-32.pdf, read 2026-10-31)

The superseded 2025 figures (15,000 / 30,000 / 15,000 / 22,500, Rev. Proc. 2024-40 s.2.15(1)) are not
used.

**Nobody is 65 or older.** The case excludes anyone 65 or older at year end, because the extra
standard deduction and the 2025-2028 senior deduction would then apply. The IRS counts you as 65 on
the day before your 65th birthday:

> "If you were born on January 1, 1961, you are considered to be age 65 at the end of 2025."
> (Instructions for Form 1040 (2025), https://www.irs.gov/pub/irs-pdf/i1040gi.pdf, read 2026-10-31)

So a person born on January 1 of (year - 64) or earlier is 65+. **This cuts the task's birth range of
1960-1995**: a 2025 row needs a birth date on or after January 2, 1961, a 2026 row on or after January
2, 1962. `case_tax()` refuses a row that breaks this.

**2027.** The app inflates the 2026 figures for 2027, and the IRS has not published 2027 brackets.
To avoid modelling the app's indexing, **2027 rows are dropped from tax and only test due dates** (the
four installment dates, including the January 2028 one, and the January 31 option). `case_tax(2027,
...)` raises an error. The schedule functions take a tax amount, so a row that carries a total tax given
directly can still be pushed through `evaluate()` (`total_tax` column), but the key derives no 2027 tax.

**What the law adds that the case leaves out (contrast columns, section 10).**
- *Net investment income tax.* The "tax" of the estimated-tax rules includes chapter 2A:

  > "(f) ... the term 'tax' means- (1) the tax imposed by chapter 1 ..., plus (2) the tax imposed by
  > chapter 2, plus (3) the tax imposed by chapter 2A, minus (4) the credits ... other than the credit
  > against tax provided by section 31"
  > (26 U.S.C. 6654(f), https://uscode.house.gov/us/usc/119-136/t26/s6654/, read 2026-10-31)

  Interest is investment income, so 3.8% of the income over $200,000 (single, head of household),
  $250,000 (joint) or $125,000 (separate) is part of the law's tax (26 U.S.C. 1411(a)(1), (b), read
  2026-10-31; Form 2210 (2025) line 2 "Other taxes, including ... Net Investment Income Tax"). The key
  gives it as `law_tax_with_niit`. **Recommendation:** keep `other_income` at or under those
  thresholds, so the case's tax and the law's tax are the same.
- *Alternative minimum tax.* `check_tables()` shows it can never apply here: for every status and both
  years, an upper bound on the tentative minimum tax (26 U.S.C. 55(b)(1)(A) 26%/28%, exemptions and
  phase-outs from Rev. Proc. 2024-40 s.2.11 and Rev. Proc. 2025-32 s.4.10) stays at or under the regular
  tax at every kink of both schedules up to $3,000,000, and beyond that the regular tax grows at 37%
  against 28%.
- *Tax Table.* The Form 1040 instructions say "If your taxable income is less than $100,000, you must
  use the Tax Table". The Tax Table taxes the middle of a $50 row, rounded to the dollar (rows checked:
  "73,900 73,950 | 11,178 8,394 11,178 9,439"; "25,300-25,350 ... $2,562"). It can differ from the
  formula by a few dollars; the key follows the case and the federal key (formula) and gives the Tax
  Table amount as `tax_table_tax`. No 2026 Tax Table is published yet; the same method is assumed.

## 2. The safe amount: the "required annual payment" (26 U.S.C. 6654(d)(1))

**Rule.** You avoid the underpayment charge if, by each due date, you have paid a quarter, a half,
three quarters and all of the **smaller** of:
- 90% of this year's tax, and
- 100% of last year's tax, or **110%** when last year's adjusted gross income was over $150,000
  ($75,000 if you file married filing separately **this** year).

With no last-year figure typed, it is 90% of this year's tax.

> "(A) In general. Except as provided in paragraph (2), the amount of any required installment shall
> be 25 percent of the required annual payment.
> (B) Required annual payment. For purposes of subparagraph (A), the term 'required annual payment'
> means the lesser of- (i) 90 percent of the tax shown on the return for the taxable year (or, if no
> return is filed, 90 percent of the tax for such year), or (ii) 100 percent of the tax shown on the
> return of the individual for the preceding taxable year. Clause (ii) shall not apply if the
> preceding taxable year was not a taxable year of 12 months or if the individual did not file a
> return for such preceding taxable year.
> (C) Limitation on use of preceding year's tax. (i) In general. If the adjusted gross income shown on
> the return of the individual for the preceding taxable year beginning in any calendar year exceeds
> $150,000, clause (ii) of subparagraph (B) shall be applied by substituting '110 percent' for '100
> percent'. (ii) Separate returns. In the case of a married individual (within the meaning of section
> 7703) who files a separate return for the taxable year for which the amount of the installment is
> being determined, clause (i) shall be applied by substituting '$75,000' for '$150,000'."
> (26 U.S.C. 6654(d)(1), https://uscode.house.gov/us/usc/119-136/t26/s6654/, read 2026-10-31)

> "Higher income taxpayers. If your adjusted gross income (AGI) for 2025 was more than $150,000
> ($75,000 if your filing status for 2026 is married filing separately), substitute 110% for 100% in
> (2b) under General Rule, earlier."
> (Form 1040-ES (2026), https://www.irs.gov/pub/irs-pdf/f1040es.pdf, read 2026-10-31; the 2025 form
> says the same for 2024/2025)

**Conventions.**
- A typed last-year tax means a return was filed for a full 12-month year (so clause (ii) applies).
- "Exceeds $150,000" is strict: exactly $150,000 is 100%.
- A typed last-year tax with a blank last-year AGI: 100% (the key cannot know the AGI was over the line).
- The typed last-year tax is already the right figure for this year's filing status (Form 1040-ES
  line 12b: add both spouses' taxes when you file jointly now but did not last year; split a joint
  figure when you file separately now). The key does not split or add.
- Tie between the two amounts: either gives the same number, and neither the statute ("the lesser of") nor
  Form 1040-ES line 12c ("the smaller of line 12a or 12b") says which to name. The key names **last year**:
  that figure is fixed by a filed return, while 90% of this year's is a forecast, and where both are 0 the
  reason nothing is needed is last year's zero tax (section 3.2). (Changed on 2026-10-31 after the check
  against the pages, which name last year on a tie too; until then the key named this year. Only the
  `basis` of the 124 tie rows changed, 123 of them 0 = 0; no amount moved.)

## 3. When there is no charge at all

### 3.1 The $1,000 test (26 U.S.C. 6654(e)(1))

**Rule.** No charge when this year's tax minus **withholding** is under $1,000. Estimated payments do
**not** count here, only tax taken out of pay or other payments (the section 31 credit).

> "(1) Where tax is small amount. No addition to tax shall be imposed under subsection (a) for any
> taxable year if the tax shown on the return for such taxable year (or, if no return is filed, the
> tax), reduced by the credit allowable under section 31, is less than $1,000."
> (26 U.S.C. 6654(e)(1), read 2026-10-31)

> "6 Withholding taxes. Don't include estimated tax payments. ... 7 Subtract line 6 from line 4. If
> less than $1,000, stop; you don't owe a penalty."
> (Form 2210 (2025) Part I, https://www.irs.gov/pub/irs-pdf/f2210.pdf, read 2026-10-31)

> "1. You expect to owe at least $1,000 in tax for 2026, after subtracting your withholding and
> refundable credits." (Form 1040-ES (2026), General Rule, read 2026-10-31)

### 3.2 Last year's tax was zero (26 U.S.C. 6654(e)(2))

**Rule.** No charge at all for this year if last year was a full 12-month year, you owed no tax for
it, and you were a U.S. citizen or resident all of last year.

> "(2) Where no tax liability for preceding taxable year. No addition to tax shall be imposed under
> subsection (a) for any taxable year if- (A) the preceding taxable year was a taxable year of 12
> months, (B) the individual did not have any liability for tax for the preceding taxable year, and
> (C) the individual was a citizen or resident of the United States throughout the preceding taxable
> year." (26 U.S.C. 6654(e)(2), read 2026-10-31)

> "Exception. You don't have to pay estimated tax for 2026 if you were a U.S. citizen or resident alien
> for all of 2025 and you had no tax liability for the full 12-month 2025 tax year. You had no tax
> liability for 2025 if your total tax was zero or you didn't have to file an income tax return."
> (Form 1040-ES (2026), read 2026-10-31; the IRS "Estimated taxes" page, last reviewed 25-Sep-2026,
> lists the same three conditions)

**Convention.** A typed `prior_tax` of 0 means all three conditions hold (return filed, full year,
citizen or resident). A blank `prior_tax` means "unknown", which is not zero: the 90% rule applies.

On the page the rule shows up by itself: with last year's tax at 0, the smaller of the two amounts is
0, so nothing is needed by estimates.

### 3.3 Waivers (out of scope)

6654(e)(3) lets the IRS waive the charge for a casualty or disaster, or for someone who retired after
62 or became disabled this year or last year when the shortfall had reasonable cause. The key never
applies a waiver (the "retired couple" of section 9.1 still owes the charge if they underpay).

## 4. Withholding counts as paid evenly; the amount to pay by estimates

**Rule.** Whatever is withheld during the year is treated as paid in four equal parts on the four due
dates, whenever it was really taken out (unless you choose to prove the real dates). Each installment
is a quarter of the safe amount. So:

> amount to pay by estimates = max(0, safe amount - projected withholding)
> a quarter of it by each due date: cumulative 25%, 50%, 75%, 100%

> "(1) In general. For purposes of applying this section, the amount of the credit allowed under
> section 31 for the taxable year shall be deemed a payment of estimated tax, and an equal part of such
> amount shall be deemed paid on each due date for such taxable year, unless the taxpayer establishes
> the dates on which all amounts were actually withheld, in which case the amounts so withheld shall be
> deemed payments of estimated tax on the dates on which such amounts were actually withheld."
> (26 U.S.C. 6654(g)(1), read 2026-10-31)

> "For withheld federal income tax ... you are considered to have paid one-fourth of these amounts on
> each payment due date unless you can show otherwise."
> (Instructions for Form 2210 (2025), https://www.irs.gov/pub/irs-pdf/i2210.pdf, read 2026-10-31)

Because a quarter of the withholding lands on each date, "a quarter of (safe amount - withholding)" by
each date is exactly the law's test "a quarter of the safe amount, counting a quarter of the
withholding", as long as withholding is below the safe amount. The 2026 Form 1040-ES worksheet does
the same (line 14a: safe amount minus withholding; zero or less: no payments needed; line 14b: tax minus
withholding under $1,000: none needed; line 15: a quarter of line 14a).

## 5. The due dates

### 5.1 The four dates in the law (26 U.S.C. 6654(c))

> "(1) Payable in 4 installments. There shall be 4 required installments for each taxable year.
> (2) Time for payment of installments. In the case of the following required installments: The due
> date is: 1st April 15; 2nd June 15; 3rd September 15; 4th January 15 of the following taxable year."
> (26 U.S.C. 6654(c), read 2026-10-31)

### 5.2 Weekends and legal holidays (26 U.S.C. 7503)

> "When the last day prescribed under authority of the internal revenue laws for performing any act
> falls on Saturday, Sunday, or a legal holiday, the performance of such act shall be considered timely
> if it is performed on the next succeeding day which is not a Saturday, Sunday, or a legal holiday.
> ... the term 'legal holiday' means a legal holiday in the District of Columbia; and in the case of any
> return, statement, or other document required to be filed, or any other act required under authority
> of the internal revenue laws to be performed, at any office of the Secretary ... located outside the
> District of Columbia but within an internal revenue district, the term 'legal holiday' also means a
> Statewide legal holiday in the State where such office is located."
> (26 U.S.C. 7503, https://uscode.house.gov/us/usc/119-136/t26/s7503/, read 2026-10-31)

> "Section 7503 applies to acts to be performed by the taxpayer (such as, the filing of any return of,
> and the payment of, any income, estate, or gift tax ...)." ... "(b) Legal holidays. For the purpose of
> section 7503, the term legal holiday includes the legal holidays in the District of Columbia as found
> in D.C. Code Ann. 28-2701. ... the term legal holiday includes, in addition to the legal holidays in
> the District of Columbia, any statewide legal holiday of the state where the act is required to be
> performed."
> (26 CFR 301.7503-1(a), (b), https://www.ecfr.gov/current/title-26/section-301.7503-1, read 2026-10-31)

**The District of Columbia's legal holidays** (the list the regulation points to):

> "The following days in each year, namely, New Year's Day, January 1; Dr. Martin Luther King, Jr.'s
> Birthday, the third Monday in January; Washington's Birthday, the third Monday in February; District
> of Columbia Emancipation Day, April 16; Memorial Day, the last Monday in May; Juneteenth National
> Independence Day, June 19; Independence Day, July 4; Labor Day, the first Monday in September;
> Indigenous Peoples' Day, the second Monday in October; Veteran's Day, November 11; Thanksgiving Day,
> the fourth Thursday in November; Christmas Day, December 25; ... and the day of the inauguration of
> the President, in every fourth year, are holidays in the District for all purposes. When a day set
> apart as a legal holiday, other than the day of the inauguration of the President, falls on a
> Saturday, the next preceding day is a holiday. When a day set apart as a legal holiday falls on a
> Sunday, the next succeeding day is a holiday."
> (D.C. Code 28-2701, https://code.dccouncil.gov/us/dc/council/code/sections/28-2701, read 2026-10-31)

> "(11) Beginning in the year 2007, District of Columbia Emancipation Day, April 16th of each year."
> "(b)(1) ... if a legal holiday occurs on Saturday, the Friday immediately before is a legal public
> holiday and if a legal holiday occurs on Sunday, the Monday immediately following is a legal public
> holiday" (D.C. Code 1-612.02(a)(11), (b)(1),
> https://code.dccouncil.gov/us/dc/council/code/sections/1-612.02, read 2026-10-31)

The federal list (5 U.S.C. 6103(a): New Year's Day, Martin Luther King Jr.'s Birthday, Washington's
Birthday, Memorial Day, Juneteenth, Independence Day, Labor Day, Columbus Day, Veterans Day,
Thanksgiving, Christmas; (c) Inauguration Day every fourth year, read 2026-10-31) is the D.C. list
without Emancipation Day. The IRS states the same rule:

> "Generally, if a due date for performing any act for tax purposes falls on a Saturday, Sunday, or
> legal holiday, the act is considered to be performed timely if it's performed no later than the next
> day that isn't a Saturday, Sunday, or legal holiday. A legal holiday includes any legal holiday in
> the District of Columbia." (Instructions for Form 2210 (2025), Reminders, read 2026-10-31)

`check_tables()` rebuilds the IRS's printed lists from D.C. Code 28-2701: Publication 509 (2026)
"Legal holidays occurring in 2026" (Jan 1, Jan 19, Feb 16, Apr 16, May 25, Jun 19, Jul 3 observed, Sep 7,
Oct 12, Nov 11, Nov 26, Dec 25) and the Publication 509 (2027) draft (Jan 1, Jan 18, Feb 15, Apr 16, May
31, Jun 18 observed, Jul 5 observed, Sep 6, Oct 11, Nov 11, Nov 25, Dec 24 observed, and Dec 31 "New
Year's Day 2028 (observed)").

### 5.3 Patriots' Day does not move an estimated payment (checked; the task's premise is wrong)

The task's model moves the April payment for Massachusetts and Maine filers past Patriots' Day (the
third Monday in April; Mass. Gen. Laws ch. 4 s.7 Eighteenth "the third Monday in April"; Me. Rev. Stat.
tit. 4 s.1051 "Patriot's Day, the 3rd Monday in April", both read 2026-10-31). The IRS says it does not:

> "A is required to make installment payments of estimated income tax to a depository in Hartford,
> Connecticut, a state in which the third Monday in April is not a statewide legal holiday.
> Accordingly, A must make the first installment payment of estimated tax on or before the ordinary
> due date for income tax returns for the act to be timely. The fact that A is a resident of
> Massachusetts, a state in which the third Monday in April is a statewide legal holiday, has no
> effect on A's due date for payment of A's first installment of estimated tax."
> (Rev. Rul. 2015-13, Holding, https://www.irs.gov/pub/irs-drop/rr-15-13.pdf, read 2026-10-31)

The same ruling holds that Patriots' Day does move the **return** of a Massachusetts or Maine resident
(because the return may be handed in at a local IRS office in that state). The IRS's yearly statements
match: Tax Tip 2024-30 (Apr 9, 2024) "Taxpayers in Maine and Massachusetts have until April 17, 2024, to
file their returns due to the Patriots' Day holiday in those states", while Form 1040-ES (2024) printed
the first payment as "April 15, 2024" for everyone (April 15, 2024 was Patriots' Day). Publication 509
(2026): "For individuals, a statewide legal holiday also delays a due date for filing a return for
residents of that state." Today the Massachusetts and Maine vouchers go to "Internal Revenue Service,
P.O. Box 931100, Louisville, KY" (Form 1040-ES (2026), Where To File), outside both states.

**So the law column never moves an estimated payment for Patriots' Day; the page's convention (April
payment only, MA and ME only) is a contrast column (`due_page`).** In 2025-2027 the two agree, because
Patriots' Day falls after April 15 each year (Monday April 21, 2025; April 20, 2026; April 19, 2027).
They part in years like 2024 and 2030 (April 15 is Patriots' Day and April 16 Emancipation Day): law
April 15, page April 17. **No IRS statement on Maine or Massachusetts was found for 2025, 2026 or 2027**
(the filing-season releases IR-2025-08, IR-2025-18, IR-2026-02 and IR-2026-12 give "Tuesday, April 15"
and "Wednesday, April 15, 2026" with no state exception), and none was needed.

### 5.4 Every due date, worked by hand

The rule: start from April 15, June 15, September 15 and January 15 of the next year; while the day is
a Saturday, a Sunday or a D.C. legal holiday (or the weekday it is observed on), go to the next day.

| Tax year | Payment | Starts at | Weekday | What moves it | Due | IRS printed |
|---|---|---|---|---|---|---|
| 2025 | 1st | Apr 15, 2025 | Tuesday | nothing (Emancipation Day is Wed Apr 16; Patriots' Day Mon Apr 21) | **Tue Apr 15, 2025** | 1040-ES (2025) "April 15, 2025" |
| 2025 | 2nd | Jun 15, 2025 | Sunday | Sunday | **Mon Jun 16, 2025** | "June 16, 2025"; voucher "Due June 16, 2025" |
| 2025 | 3rd | Sep 15, 2025 | Monday | nothing (Labor Day was Sep 1) | **Mon Sep 15, 2025** | "Sept. 15, 2025" |
| 2025 | 4th | Jan 15, 2026 | Thursday | nothing (King's Birthday is Mon Jan 19) | **Thu Jan 15, 2026** | "Jan. 15, 2026"; Pub. 509 (2026) |
| 2026 | 1st | Apr 15, 2026 | Wednesday | nothing (Emancipation Day Thu Apr 16; Patriots' Day Apr 20) | **Wed Apr 15, 2026** | 1040-ES (2026) "April 15, 2026" |
| 2026 | 2nd | Jun 15, 2026 | Monday | nothing | **Mon Jun 15, 2026** | "June 15, 2026" |
| 2026 | 3rd | Sep 15, 2026 | Tuesday | nothing (Labor Day Sep 7) | **Tue Sep 15, 2026** | "Sept. 15, 2026" |
| 2026 | 4th | Jan 15, 2027 | Friday | nothing (King's Birthday Mon Jan 18) | **Fri Jan 15, 2027** | "Jan. 15, 2027"; Pub. 509 (2027) draft |
| 2027 | 1st | Apr 15, 2027 | Thursday | nothing (Emancipation Day Fri Apr 16; Patriots' Day Apr 19) | **Thu Apr 15, 2027** | Pub. 509 (2027) draft, April 15 |
| 2027 | 2nd | Jun 15, 2027 | Tuesday | nothing (Juneteenth, a Saturday, is observed Fri Jun 18) | **Tue Jun 15, 2027** | draft, June 15 "second installment date" |
| 2027 | 3rd | Sep 15, 2027 | Wednesday | nothing (Labor Day Sep 6) | **Wed Sep 15, 2027** | draft, September 15 "third installment date" |
| 2027 | 4th | Jan 15, 2028 | Saturday | Saturday; Sun Jan 16; Mon Jan 17 is King's Birthday (third Monday: Jan 3, 10, **17**) | **Tue Jan 18, 2028** | not yet published |

The January 31 option (section 6.3), moved the same way, as the IRS prints it:

| Tax year | January 31 | Weekday | Last day | IRS printed |
|---|---|---|---|---|
| 2025 | Jan 31, 2026 | Saturday | **Mon Feb 2, 2026** | 1040-ES (2025) "by February 2, 2026"; Pub. 509 (2026) |
| 2026 | Jan 31, 2027 | Sunday | **Mon Feb 1, 2027** | 1040-ES (2026) "by February 1, 2027"; Pub. 509 (2027) draft |
| 2027 | Jan 31, 2028 | Monday | **Mon Jan 31, 2028** | not yet published |

(The 2025 Form 2210 instructions write "by January 31, 2026" without the move.) The 2024 dates (April
15, June 17, September 16, 2024, January 15, 2025, Form 1040-ES (2024)) and the 2016 and 2022 cases of
Rev. Rul. 2015-13 (April 16 a Saturday, so Emancipation Day is observed Friday April 15 and the date is
Monday April 18) are also rebuilt by `check_tables()`.

## 6. Where you stand today (Estimated payments page)

### 6.1 The page's rules (followed as stated)

Let A be the amount to pay by estimates, its cumulative shares A/4, A/2, 3A/4, A, and P everything
typed as paid (all four boxes; **a payment typed for a later quarter counts as paid now**). Remaining =
max(0, A - P).
- A quarter is **past due** when today is after its due date.
- **Behind** = (cumulative share through the last past-due quarter) - P, floored at 0, capped at
  remaining. No quarter past due: 0.
- **Next payment**: the first quarter not yet past due whose cumulative share is not yet covered; amount
  = its cumulative share - P - behind, floored at 0, capped at remaining. None left: no next payment.
- **Status per quarter**: *paid* when P >= cumulative share - $1; else *short* when past due; else *due*
  when today is in the calendar month of its due date and on or before it; else *upcoming*.

**Conventions.** "Covered" for the next payment uses the same $1 tolerance as *paid*. When A is 0 every
quarter is *paid* (nothing to pay) and `estimates_needed` is false. Rows where P sits within $1 under a
share are marked `tolerance_sensitive` (a page without the tolerance would say otherwise); the case
generator should avoid them.

### 6.2 The law: each installment on its own date (26 U.S.C. 6654(b))

> "(1) Amount. The amount of the underpayment shall be the excess of- (A) the required installment,
> over (B) the amount (if any) of the installment paid on or before the due date for the installment.
> (2) Period of underpayment. The period of the underpayment shall run from the due date for the
> installment to whichever of the following dates is the earlier- (A) the 15th day of the 4th month
> following the close of the taxable year, or (B) with respect to any portion of the underpayment, the
> date on which such portion is paid. (3) Order of crediting payments. For purposes of paragraph (2)(B),
> a payment of estimated tax shall be credited against unpaid required installments in the order in
> which such installments are required to be paid."
> (26 U.S.C. 6654(b), read 2026-10-31)

> "Penalty figured separately for each required payment. The penalty is figured separately for each
> installment due date. Therefore, you may owe the penalty for an earlier due date even if you paid
> enough tax later to make up the underpayment. This is true even if you're due a refund when you file
> your tax return." (Instructions for Form 2210 (2025), read 2026-10-31)

**The key's law test.** Installment j (1-4) is underpaid when everything paid by its due date is less
than j quarters of the safe amount. "Everything paid by its due date" = j quarters of the year's
withholding (section 4) + the estimated payments dated on or before that day. Because payments are
credited to the oldest unpaid installment first, this cumulative test is the same as checking each
installment. **Convention on dates:** the case only says each payment was made "on or before its due
date", so the key dates each typed payment at the latest day the row allows: its own due date, or today
if today is earlier. A catch-up payment typed in a later box therefore does not cure an earlier
installment, exactly as the IRS says above. `law_underpaid` looks only at installments whose due date
is before today; `law_underpaid_full_year` looks at all four as if nothing more were paid.

### 6.3 The January 31 option (26 U.S.C. 6654(h)): contrast note only

> "If, on or before January 31 of the following taxable year, the taxpayer files a return for the
> taxable year and pays in full the amount computed on the return as payable, then no addition to tax
> shall be imposed under subsection (a) with respect to any underpayment of the 4th required
> installment for the taxable year." (26 U.S.C. 6654(h), read 2026-10-31)

> "* You don't have to make the payment due January 15, 2027, if you file your 2026 tax return by
> February 1, 2027, and pay the entire balance due with your return." (Form 1040-ES (2026), read 2026-10-31)

The pages do not model it; the key reports the date (`jan31_option`) and changes no number.

## 7. Balance, projected withholding, verdict (Withholding check page)

**Balance at filing** = this year's tax - projected withholding - estimated payments typed (+ you owe,
- refund).

**Projected withholding** (page convention; no legal rule): for each person, withheld so far + their
per-paycheck amount x paychecks left after today in the year. With nothing typed as "withheld so far", a
full year at the per-paycheck rate (52 weekly, 26 biweekly, 24 semimonthly, 12 monthly).

**Paychecks left** (page convention): floor(days from today to December 31 / 365.25 x paychecks a year),
never below 0 (a "today" in the January after the year), at most a year's. Examples: July 1, 2026,
biweekly: 183 days x 26 / 365.25 = 13.03, so 13; August 1, 2026, monthly: 152 x 12 / 365.25 = 4.99, so 4;
October 1, 2026, monthly: 91 x 12 / 365.25 = 2.99, so 2; January 1, 2026, weekly: 364 x 52 / 365.25 =
51.8, so 51. The formula often counts one paycheck fewer than a real calendar would (seen on August 1,
a monthly payday on the 15th still comes in each of August to December: 5). A contrast column counting real biweekly paydays needs a first
payday; **the cases give none, so that contrast is not possible and is skipped.**

**Verdict** (page convention): *unknown* with no withholding figures at all; *about right* when the
balance is under $500 either way; *owe* when it is over 0; *refund* otherwise.

**W-4 suggestion** (page convention), for the first person (self, then partner) with a per-paycheck
amount and at least one paycheck left: owe -> ceil(balance / paychecks left) dollars **more** a
paycheck; refund -> floor(-balance / paychecks left) dollars **less**; owing with nobody's pay left to
change -> "use estimates". About right or unknown: no suggestion.

**Conventions.**
- "Withheld so far" is one household figure (the task names one column). The function also takes a
  per-person figure, should the page keep one per person.
- A typed 0 is a figure (so "withheld so far = 0" means 0 + per-paycheck x paychecks left, not a full
  year). Blank means not typed.
- Money is exact; the balance is not rounded before the W-4 division.
- When somebody has a per-paycheck amount but no paycheck is left (today is December 31 or in January),
  the key says "use estimates" and marks the row `ambiguous`; the generator should avoid such rows.
- The law credits a single, head-of-household or married-filing-separately return only with the filer's
  own withholding (section 31). The page adds both people. `withholding_law` keeps the household "so far"
  plus the filer's own paychecks; **the generator should give a partner paychecks only on
  married_joint rows.**
- The cases have no wages but may have withholding: the key takes withholding as typed and does not
  check that it fits the income.

## 8. The penalty flags: the pages' and the law's

| Flag | Rule |
|---|---|
| Withholding page (`page_flag_withholding`) | withholding figures exist, this year's tax less withholding (not estimates) >= $1,000, and withholding + estimates < safe amount (until 2026-10-31 the page tested the balance after estimates; changed to the law's test after the verify step) |
| Estimates page (`page_flag_estimates`) | estimates needed, total paid + $1 < amount to pay by estimates, and some past-due quarter was short **on its own due date** (its boxes 1 to k under its share less $1), whether or not a later box has caught it up since |
| The law (`law_flag`) | the $1,000 test fails (tax - withholding >= $1,000; estimates do not count), last year's tax was not a typed zero, and some installment due before today was underpaid on its due date (section 6.2) |

**Convention for "estimates needed"**: amount to pay by estimates > 0 **and** tax - withholding >=
$1,000 (Form 1040-ES (2026) worksheet lines 14a and 14b). The plain "amount > 0" reading is given as
`estimates_needed_amount_only`.

**Out of scope:** the charge itself (6654(a): the underpayment rate of section 6621 x the amount x the
days), waivers (6654(e)(3)), the annualized income method (6654(d)(2)), withholding on its real dates
(6654(g)(1) election), farmers and fishermen (6654(i)), the late-payment penalty and interest on a
balance not paid by April 15.

## 9. Worked examples (invented people)

### 9.1 A retired couple paying 110% of last year's tax

Ana and Ben (invented), married filing jointly, born 1964 and 1966 (62 and 60 at the end of
2026: nobody 65), live on $250,000 of interest in 2026. Their 2025 return showed tax $30,000 and AGI
$210,000. Nothing is withheld. They paid $8,250 on each of the first three dates. Today is Saturday
October 31, 2026.
- Tax: taxable 250,000 - 32,200 = 217,800; 35,932 + 24% x (217,800 - 211,400) = 35,932 + 1,536 =
  **$37,468**. Investment income tax: 250,000 is not over 250,000, so 0; the law's tax is the same.
- Safe amount: 90% x 37,468 = 33,721.20; last year's AGI 210,000 > 150,000, so 110% x 30,000 =
  **$33,000**, the smaller. (With last year's AGI exactly $150,000 it would be 100%: $30,000.)
- No withholding: amount by estimates $33,000; shares 8,250 / 16,500 / 24,750 / 33,000.
- Past due: April 15, June 15, September 15. Paid 24,750, so behind = 24,750 - 24,750 = **0**.
- Status: paid, paid, paid, **upcoming** (October is not January). Next: the 4th, 33,000 - 24,750 - 0
  = **$8,250 by Friday January 15, 2027** (or skip it by filing and paying in full by Monday February
  1, 2027, 6654(h)).
- Balance today 37,468 - 0 - 24,750 = $12,718; after the last payment $4,468, paid with the return.
- Flags: none (page or law). Withholding page verdict: *unknown* (no withholding figures).
- If they had paid 100% instead ($7,500 a quarter): P = 22,500. Page: Q1 and Q2 *paid* (22,500 covers
  8,249 and 16,499 because every payment counts now), Q3 *short*, behind 24,750 - 22,500 = $2,250, next
  $8,250. Law: by April 15 they had 7,500 of 8,250 (short 750), by June 15 15,000 of 16,500 (short 1,500),
  by September 15 22,500 of 24,750 (short 2,250). Both flags are on; the statuses show only what is
  unpaid now (Q3), the flag also stands for the first two shortfalls that the law charges.

### 9.2 Skipped the first two payments, seen in July

Cora (invented), single, born 1985, $90,000 of interest in 2026. 2025 tax $12,000, AGI $85,000. No
withholding, nothing paid yet. Today is Monday July 20, 2026.
- Tax: taxable 90,000 - 16,100 = 73,900; 5,800 + 22% x (73,900 - 50,400) = 5,800 + 5,170 = **$10,970**.
- Safe amount: 90% x 10,970 = **$9,873**, smaller than 100% x 12,000 (AGI under 150,000).
- Shares 2,468.25 / 4,936.50 / 7,404.75 / 9,873.
- Past due: April 15 and June 15. Behind = 4,936.50 - 0 = **$4,936.50**.
- Status: **short, short**, upcoming, upcoming. Next: the 3rd, 7,404.75 - 0 - 4,936.50 = **$2,468.25 by
  Tuesday September 15, 2026**.
- Flags: estimates page **on**; law **on** (by April 15: 0 of 2,468.25; by June 15: 0 of 4,936.50).
- She pays the $4,936.50 that day and types it in the third box (each payment is "on or before its due
  date", so a July payment belongs to the September box). Page: P = 4,936.50, Q1 and Q2 now *paid*,
  behind 0, next $2,468.25 by September 15, flag still **on** (Q1 and Q2 were short on their own dates).
  Law: the payment is dated July 20, after both due dates, so installments 1 and 2 stay underpaid and the
  charge runs from April 15 and June 15 to July 20 (6654(b)(2)(B)): flag **on**. (Tax Table contrast:
  $10,976.)

  **Why the statuses and the flag read the payments differently** (changed on 2026-10-31 after the check
  against the pages; until then the flag went off here). The statuses, `behind`, the overdue date and the
  next payment say what is unpaid *now*, and the law credits every payment against the oldest unpaid
  installment first (6654(b)(3)), so a catch-up makes Q1 and Q2 paid. The flag warns of the charge, and the
  law figures that "separately for each installment due date ... you may owe the penalty for an earlier due
  date even if you paid enough tax later to make up the underpayment" (Instructions for Form 2210 (2025)),
  so it tests each past-due quarter on its own date. With the old rule the flag missed 169 rows the law
  charges; now 42 (41 where the whole year has been paid, late; `est-edge-048` inside the $1 tolerance).

### 9.3 A $950 balance, with estimates, that still misses the safe amount

Dev (invented), single, born 1975, lives in Massachusetts, $52,000 of interest in 2026. 2025 tax
$4,200, AGI $50,000. $150 is withheld from a monthly payment; $1,350 withheld so far. Estimates paid:
$700 (April), $760 (June), nothing in September. Today is Thursday October 1, 2026.
- Tax: taxable 52,000 - 16,100 = 35,900; 1,240 + 12% x (35,900 - 12,400) = 1,240 + 2,820 = **$4,060**.
- Safe amount: 90% x 4,060 = **$3,654** (smaller than 4,200).
- Paychecks left: 91 days x 12 / 365.25 = 2.99, so **2**. Withholding: 1,350 + 150 x 2 = **$1,650**.
- Balance: 4,060 - 1,650 - 1,460 = **$950** -> verdict *owe* (not under 500) -> W-4: ceil(950 / 2) =
  **$475 more** a paycheck.
- Withholding page flag: **off**, because 950 is under $1,000, even though withholding + estimates =
  3,110 is $544 short of the safe $3,654.
- Estimates page: amount 3,654 - 1,650 = $2,004; shares 501 / 1,002 / 1,503 / 2,004. Past due: all of
  April, June, September. Paid 1,460: Q1 paid, Q2 paid, **Q3 short**, Q4 upcoming. Behind = 1,503 -
  1,460 = **$43**; next = 2,004 - 1,460 - 43 = **$501 by Friday January 15, 2027**. Flag **on**.
- Law: the $1,000 test uses withholding only: 4,060 - 1,650 = 2,410, so it fails. A quarter of the
  withholding (412.50) lands on each date. By September 15: 3 x 412.50 + 1,460 = 2,697.50 against 3 x
  913.50 = 2,740.50: **short $43**. Flag **on**. (Massachusetts changes no date.)
- If Dev follows the W-4 advice ($625 on each of the last two paychecks), withholding becomes 1,350 +
  1,250 = $2,600 and the balance $0 (*about right*). Under the law the extra withholding is spread back
  over all four dates (6654(g)(1)): by September 15, 3 x 650 + 1,460 = 3,410 >= 2,740.50, so nothing is
  underpaid at all. The page agrees: the amount by estimates drops to $1,054, already covered.
- The same row seen on Saturday August 1 (withheld so far $1,050): 152 x 12 / 365.25 = 4.99, so 4
  paychecks left; withholding 1,050 + 600 = $1,650; balance $950; W-4 ceil(950 / 4) = **$238** more. Only
  April and June are past due and both are covered, so neither flag is on yet.

### 9.4 Last year's tax was zero

Eli (invented), head of household, born 1990, lives in Maine. In 2025 his tax was $0 (AGI
$20,000); in 2026 he has $60,000 of interest. Nothing withheld, nothing paid. Today is Saturday June 20,
2026.
- Tax: taxable 60,000 - 24,150 = 35,850; 1,770 + 12% x (35,850 - 17,700) = 1,770 + 2,178 = **$3,948**.
- Safe amount: the smaller of 90% x 3,948 = 3,553.20 and 100% x 0 = **$0**. Nothing is needed by
  estimates; every quarter shows *paid*; no flag. Law: 6654(e)(2) removes the charge for the whole year
  (typed 0 = filed, 12 months, citizen). He owes $3,948 with his return, by Thursday April 15, 2027.
- If last year's tax were left **blank** instead: safe amount 90% = $3,553.20; shares 888.30 / 1,776.60
  / 2,664.90 / 3,553.20; April 15 and June 15 past due: short, short; behind $1,776.60; next $888.30 by
  September 15; both flags on. A typed zero and a blank are different answers.

### 9.5 A 2027 row

Single, Massachusetts, today Monday January 10, 2028: no tax is worked. Due dates: Thu April 15, Tue
June 15, Wed September 15, 2027, **Tue January 18, 2028** (law and page agree); January 31 option Mon
January 31, 2028.

## 10. Where the page's model and the law differ (contrast columns; the key follows the law)

| Point | Page (task model) | Law | Column |
|---|---|---|---|
| Patriots' Day | moves the April payment for MA and ME | never moves an estimated payment (Rev. Rul. 2015-13); only the MA/ME return | `due_page` vs `due_law` (same in 2025-2027) |
| Payment timing | every typed payment counts now, in any quarter (statuses, behind, next); the flag tests each past-due quarter's boxes on its own date | each installment judged on its own due date; payments credited oldest first (6654(b)) | `status` vs `law_underpaid` |
| Paid tolerance | $1 | none | `tolerance_sensitive` |
| Withholding page flag | year totals only, no per-date test (the $1,000 test now matches: tax minus withholding only, since 2026-10-31) | each installment on its own date (6654(b)) | `page_flag_withholding` vs `law_flag` |
| One "behind" figure | lump sum | each installment's charge runs from its own date (6654(b)(2)) | not computed (out of scope) |
| Fourth payment | always shown | not needed if the return is filed and paid by Jan 31 (moved: Feb 2, 2026; Feb 1, 2027; Jan 31, 2028) (6654(h)) | `jan31_option` (note only) |
| This year's tax | regular income tax by formula | 6654(f) tax adds net investment income tax; the return uses the Tax Table under $100,000 | `law_tax_with_niit`, `tax_table_tax` |
| Partner's withholding on a non-joint return | added | only the filer's own (section 31) | `withholding_law` |
| Paychecks left | floor(days / 365.25 x n) | no rule; real paydays need a first payday (none given) | skipped |

## 11. Conventions the key adopts where no source decides

1. Typed last-year tax = a filed 12-month return; typed 0 = no liability, full year, citizen or resident.
2. Blank last-year AGI with a typed last-year tax: 100%. "Exceeds $150,000" is strict.
3. Blank is not zero (for last-year tax and for "withheld so far"). A tie between the two safe amounts is
   named "last year" (section 2).
4. Typed payments are dated, for the law, at min(their due date, today).
5. "Covered" uses the page's $1 tolerance; rows within $1 under a share are flagged.
6. "Estimates needed" = amount > 0 and the $1,000 test fails (the other reading is a column).
7. The key applies no waiver, no annualization and no actual-date withholding election.
8. Exact arithmetic; amounts shown rounded half up to the cent; W-4 changes to whole dollars by ceiling
   (more) or floor (less) of the exact quotient.
9. 2027: due dates only.
10. Nobody 65 or older: birth on or after January 2 of (year - 64).
11. Married filing separately with two adults: half the household's interest on each return, each return's tax
    to the cent, then added (section 1).

## 12. What could not be verified, and findings

- **January 18, 2028** (the 4th 2027 payment) and **January 31, 2028** (the 6654(h) date): no IRS
  publication for tax year 2027 prints them yet. The 2027 Form 1040-ES is not out (the "draft" at
  https://www.irs.gov/pub/irs-dft/f1040es--dft.pdf is a stale 2018 draft) and the 2027 Publication 509 is
  a draft that covers calendar 2027 only. Worked from 6654(c)(2), 7503 and D.C. Code 28-2701.
- **The 2027 dates** rest on the Publication 509 (2027) **draft** (created 2026-08-24, modified
  2026-09-16), not on a final publication.
- **An IRS statement on Patriots' Day for 2025-2027**: none found, none needed (section 5.3).
- **Ad hoc closures** (a day "appointed by the President", D.C. Code 28-2701) that might fall on a
  2027-2028 due date cannot be known in advance; none is modelled.
- **The 2026 Tax Table** is not published; the contrast column assumes the 2025 method.
- **The page's own definitions** where the task leaves room ("estimates needed", the tolerance for
  "covered", household or per-person "withheld so far", what "nothing withheld from pay" means when
  nobody has a paycheck left): the key's reading is stated in sections 6-8, and the other reading gets a
  column where it can.
- **The task's birth range** (1960-1995) conflicts with "nobody 65 or older" for births up to January 1,
  1961 (2025 rows), 1962 (2026) and 1963 (2027).
- **Finding on the federal key:** `tests/golden/taxes/RULES.md` cites "RP24 s.3.01" (brackets) and "RP24
  s.3.15" (additions); in Rev. Proc. 2024-40 those are **s.2.01** and **s.2.15** (its section 3 is
  "EFFECTIVE DATE"). Its 2025 and 2026 figures agree with this key.
- **26 CFR 1.6654-1 and -2** still carry pre-1984 text (an 80% rule and old exceptions); they were read
  but not relied on.

## 13. Sources (all read 2026-10-31)

sha256 of the copy read, first 8 and last 10 hex digits.

| Id | Source | URL | sha256 |
|---|---|---|---|
| USC6654 | 26 U.S.C. 6654 (a)-(h), (m); notes (last amended by Pub. L. 115-141, 2018) | https://uscode.house.gov/us/usc/119-136/t26/s6654/ | 8d577fde...3c6a820b9f |
| USC7503 | 26 U.S.C. 7503 | https://uscode.house.gov/us/usc/119-136/t26/s7503/ | 6fd6414b...56dff7aeac |
| USC6103 | 5 U.S.C. 6103 (a)-(c) | https://uscode.house.gov/us/usc/119-136/t5/s6103/ | 0b3b1f84...48ead66da8 |
| USC55 | 26 U.S.C. 55 (b)(1), (d) | https://uscode.house.gov/us/usc/119-136/t26/s55/ | e28808c7...162f2fe040 |
| USC1411 | 26 U.S.C. 1411 (a)(1), (b) | https://uscode.house.gov/us/usc/119-136/t26/s1411/ | 89721b18...741beafb33 |
| eCFR | title 26 "up to date as of 2026-10-29" | https://www.ecfr.gov/api/versioner/v1/titles.json | b649b378...71de4d4618 |
| CFR7503 | 26 CFR 301.7503-1 (a), (b) | https://www.ecfr.gov/current/title-26/section-301.7503-1 | 2c8d416a...506c8ea75c |
| CFR6654 | 26 CFR 1.6654-1, 1.6654-2 (outdated text) | https://www.ecfr.gov/current/title-26/section-1.6654-1 | 8f10aa57...a6c5559cd0; 7d6d2a7d...8ebab1f284 |
| DC28 | D.C. Code 28-2701 | https://code.dccouncil.gov/us/dc/council/code/sections/28-2701 | fbf67571...f780e9db41 |
| DC1612 | D.C. Code 1-612.02 | https://code.dccouncil.gov/us/dc/council/code/sections/1-612.02 | 6fb14150...8a98416385 |
| MAGL | Mass. Gen. Laws ch. 4 s.7 | https://malegislature.gov/Laws/GeneralLaws/PartI/TitleI/Chapter4/Section7 | dcccceaa...95bc5b76da |
| MERS | Me. Rev. Stat. tit. 4 s.1051 | https://legislature.maine.gov/statutes/4/title4sec1051-1.html | 07a518b3...0d836f675e |
| RR1513 | Rev. Rul. 2015-13 | https://www.irs.gov/pub/irs-drop/rr-15-13.pdf | c44b7737...9b625e2796 |
| ES24 | Form 1040-ES (2024) | https://www.irs.gov/pub/irs-prior/f1040es--2024.pdf | 860a291f...bf21300ee6 |
| ES25 | Form 1040-ES (2025) | https://www.irs.gov/pub/irs-prior/f1040es--2025.pdf | a6e94741...325905cfb7 |
| ES26 | Form 1040-ES (2026) | https://www.irs.gov/pub/irs-pdf/f1040es.pdf | 396ffad2...9864f90b54 |
| I2210 | Instructions for Form 2210 (2025) | https://www.irs.gov/pub/irs-pdf/i2210.pdf | 7bd6a474...cd759e831d |
| F2210 | Form 2210 (2025) | https://www.irs.gov/pub/irs-pdf/f2210.pdf | 6899ce67...5b8577159a |
| I2210-24 | Instructions for Form 2210 (2024) | https://www.irs.gov/pub/irs-prior/i2210--2024.pdf | c64608de...93c48ec031 |
| P509_26 | Publication 509 (2026) | https://www.irs.gov/pub/irs-pdf/p509.pdf | d7d7e3f8...02f3f4a0cb |
| P509_27 | Publication 509 (2027) DRAFT | https://www.irs.gov/pub/irs-dft/p509--dft.pdf | be4d399e...e18c9ee1d0 |
| ES-dft | Form 1040-ES "draft" (a 2018 draft; not used) | https://www.irs.gov/pub/irs-dft/f1040es--dft.pdf | f9b426e8...2ce5c0b965 |
| I1040 | Instructions for Form 1040 (2025) | https://www.irs.gov/pub/irs-pdf/i1040gi.pdf | 482e9c48...590468364a |
| RP2440 | Rev. Proc. 2024-40 | https://www.irs.gov/pub/irs-drop/rp-24-40.pdf | 4de9db6b...d4c302af1f |
| RP2532 | Rev. Proc. 2025-32 | https://www.irs.gov/pub/irs-drop/rp-25-32.pdf | e9ada115...a96214635b |
| PL11921 | Pub. L. 119-21 s.70102 | https://www.govinfo.gov/content/pkg/PLAW-119publ21/html/PLAW-119publ21.htm | 84000b07...c584e9004d |
| IRSET | IRS "Estimated taxes" (last reviewed 25-Sep-2026) | https://www.irs.gov/businesses/small-businesses-self-employed/estimated-taxes | 4c322d40...ab75b90651 |
| IR-2025-08 | IRS announces Jan. 27 start to 2025 filing season | https://www.irs.gov/newsroom/irs-announces-jan-27-start-to-2025-tax-filing-season-agency-continues-historic-improvements-to-expand-enhance-tools-and-filing-options-to-help-taxpayers | 75ac90f4...446daa2c33 |
| IR-2025-18 | 2025 tax filing season starts | https://www.irs.gov/newsroom/2025-tax-filing-season-starts-as-irs-begins-accepting-tax-returns-today-taxpayers-have-many-options-for-help | 3849e93e...723ef00d76 |
| IR-2026-02 | IRS announces first day of 2026 filing season | https://www.irs.gov/newsroom/irs-announces-first-day-of-2026-filing-season-online-tools-and-resources-help-with-tax-filing | 2714158d...5c1a5098b7 |
| IR-2026-12 | IRS opens 2026 filing season | https://www.irs.gov/newsroom/irs-opens-2026-filing-season | d7850fd0...fe53231e07 |
| TT2024-30 | Tax Tip 2024-30 (Maine, Massachusetts April 17, 2024) | https://www.irs.gov/newsroom/taxpayers-remember-an-extension-to-file-is-not-an-extension-to-pay-taxes | 786ab360...b8b6a15f9d |
| TT2022-47 | Tax Tip 2022-47 (April 19, 2022) | https://www.irs.gov/newsroom/irs-reminds-taxpayers-an-extension-to-file-is-not-an-extension-to-pay-taxes | 5c977d29...08b9f3fcd8 |
| IRSNR10 | IRS news releases, October 2026 (IR-2026-117 to -129; no estimated-tax relief) | https://www.irs.gov/newsroom/news-releases-for-current-month | 36a52141...4ea56d25a1 |
| FEDKEY | tests/golden/taxes/RULES.md, sections 1-2 (comparison only) | repository file | |
