# Rental analysis and Home: rules sheet for the answer key

This sheet is the spec of an independent answer key for two pages, "Rental analysis" and "Home" (with the tax on selling
the home), tax years 2025 and 2026. `tools/golden_property/rules.py` holds every figure as data, with its source and the date
it was read on the same line, plus each rule as a small pure function. This sheet gives each rule in plain words with the
source text it rests on, the conventions the key adopts, and six examples worked by hand (section 9), which `rules.py`
asserts when imported (150 self-checks, all passing).

**Independence.** Written from the law (26 U.S.C. 121, 168, 469, 1222, 1411), the regulations (26 CFR 1.121-1, 1.121-3,
1.469-1T, 1.469-2T, 1.469-4, 1.1411-4), IRS Publications 523, 527, 550, 925 and 946, Form 8582 and its instructions, the Form
1040 and Form 8960 instructions, and the revenue procedures. Nobody opened `modules/`, `core/` or `tests/*.test.mjs` while
writing it, and the key never imports or runs the app. Only the layout and conventions of `tools/golden_tax_lots/` and
`tools/golden_estimated/` were looked at. The federal figures were read in the revenue procedures and agree with
`tests/golden/taxes/RULES.md` (FEDKEY) and `tests/golden/tax-lots/RULES.md` (TLKEY), which are cited for them. The pages'
READMEs document the model (the brief's "page convention"). Where the law says otherwise the key's main column follows the
law, and a contrast column keeps the page's way.

Every source was read on **2026-10-31**. Each was saved and hashed (first 8 ... last 10 hex digits of sha256); the full list
is also in the `rules.py` docstring.

## 1. Sources

| Id | Document | URL | Sha |
|---|---|---|---|
| USC121 | 26 U.S.C. 121 (OLRC, "current through Public Law 119-136 (October 22, 2026)"; last amended Pub. L. 115-97, 2017) | https://uscode.house.gov/us/usc/119-136/t26/s121/ | 25821328...2beca3d1c9 |
| USC168 | 26 U.S.C. 168(a), (b), (c), (d), (e)(2), (i)(6) | https://uscode.house.gov/us/usc/119-136/t26/s168/ | b61ed81b...93f38b0cac |
| USC469 | 26 U.S.C. 469(a)-(d), (i), (j) (last amended Pub. L. 117-2, 2021) | https://uscode.house.gov/us/usc/119-136/t26/s469/ | 30b8eb12...cc7e51c01e |
| USC1222 | 26 U.S.C. 1222(1)-(4) | https://uscode.house.gov/us/usc/119-136/t26/s1222/ | 608100ea...b0cae9749a |
| USC1411 | 26 U.S.C. 1411(a)-(d) | https://uscode.house.gov/us/usc/119-136/t26/s1411/ | 89721b18...741beafb33 |
| CFR1211 | 26 CFR 1.121-1 (eCFR "up to date as of 2026-10-29") | https://www.ecfr.gov/current/title-26/section-1.121-1 | faf3e310...287e30bab2 |
| CFR1213 | 26 CFR 1.121-3 | https://www.ecfr.gov/current/title-26/section-1.121-3 | d16eee79...f4555a8465 |
| CFR14691 | 26 CFR 1.469-1T(f)(2) | https://www.ecfr.gov/current/title-26/section-1.469-1T | 13ccf2f7...449e2771f8 |
| CFR14692 | 26 CFR 1.469-2T(b)(1) | https://www.ecfr.gov/current/title-26/section-1.469-2T | c4735b5d...00dc2bf53e |
| CFR14694 | 26 CFR 1.469-4(a), (c) (for convention G1 only) | https://www.ecfr.gov/current/title-26/section-1.469-4 | 2f236368...b59077fe91 |
| CFR14114 | 26 CFR 1.1411-4 | https://www.ecfr.gov/current/title-26/section-1.1411-4 | 76523685...59598039aa |
| P523 | Publication 523 (2025), Selling Your Home | https://www.irs.gov/pub/irs-pdf/p523.pdf | f11fca89...9a754f736b |
| P527 | Publication 527 (2025), Residential Rental Property | https://www.irs.gov/pub/irs-pdf/p527.pdf | 20c826e9...ff651201d6 |
| P550 | Publication 550 (2025), Holding Period | https://www.irs.gov/pub/irs-pdf/p550.pdf | 83552968...92c5574317 |
| P925 | Publication 925 (2025), Passive Activity and At-Risk Rules | https://www.irs.gov/pub/irs-pdf/p925.pdf | dda751f0...6137cda5d3 |
| P946 | Publication 946 (2025), How To Depreciate Property, incl. Table A-6 | https://www.irs.gov/pub/irs-pdf/p946.pdf | 07fadfb2...1b9b5904c4 |
| I8582 | Instructions for Form 8582 (2025) | https://www.irs.gov/pub/irs-pdf/i8582.pdf | 76787e11...29e6035f71 |
| F8582 | Form 8582 (2025) | https://www.irs.gov/pub/irs-pdf/f8582.pdf | d929884f...9501080537 |
| I1040 | Instructions for Form 1040 (2025), Qualified Dividends and Capital Gain Tax Worksheet | https://www.irs.gov/pub/irs-pdf/i1040gi.pdf | 482e9c48...590468364a |
| I8960 | Instructions for Form 8960 (2025), lines 4a and 13 | https://www.irs.gov/pub/irs-pdf/i8960.pdf | b10fbb23...7867376428 |
| RP2440 | Rev. Proc. 2024-40 (tax year 2025), s.2.01, s.2.03 | https://www.irs.gov/pub/irs-drop/rp-24-40.pdf | 4de9db6b...d4c302af1f |
| RP2532 | Rev. Proc. 2025-32 (tax year 2026; s.3.01 amends 2025) | https://www.irs.gov/pub/irs-drop/rp-25-32.pdf | e9ada115...a96214635b |
| FEDKEY | tests/golden/taxes/RULES.md, sections 1, 2, 5, 8 | (this repo) | 96ddcd2f...6c4c6adeb7 |
| TLKEY | tests/golden/tax-lots/RULES.md, sections 3, 5.1, 5.2, 6 | (this repo) | 7e1afebd...e254d55a88 |

The regulations were read as XML from `https://www.ecfr.gov/api/versioner/v1/full/2026-10-29/title-26.xml?section=<N>`
(title 26 "up_to_date_as_of 2026-10-29" in `https://www.ecfr.gov/api/versioner/v1/titles.json`, b649b378...71de4d4618).
The IRS PDFs are the editions "for 2025": P523 of 2026-02-27, P527 of 2026-01-08, P550 of 2026-03-06, P925 of 2026-02-24,
P946 of 2026-03-13, I8582 of 2025-12-01, F8582 of 2025-12-01.

## 2. The households and the year

One CSV row is one household: `tax_year` 2025 or 2026 and `today`, a day of that year; `filing_status` (`single`,
`married_joint`, `married_separate`, `head_of_household`) and, for `married_separate`, `lived_apart_all_year` (yes/no); one
adult under 65, no dependents, the standard deduction; W-2 `wages` as the only other income; no state tax. Page A adds one to
three rentals, page B one home (fields in sections 3 and 8). Shares are decimals (0.05 = 5%); a blank takes the page's
default, a typed 0 is 0.

Conventions for the case (no source decides them):
- **C1** The return holds the plan adult's wages and the rentals or the home; a spouse of a married filer has no income of
  their own. Wages are not net investment income (USC1411(c)(1) lists interest, dividends, rents, passive trades and net
  gain; wages are not there). MAGI for the NIIT is AGI (I8960 Line 13: "your MAGI is your AGI as reported on Form 1040"
  without section 911, CFC or PFIC amounts).
- **C2** Federal tax = income tax (exact Tax Computation formula, never the Tax Table, FEDKEY s.1's convention) + NIIT. The
  additional Medicare tax is on wages only, the same with and without the rentals or the sale, so it cancels in every
  difference the key takes and is left out. No credits; AMT (26 U.S.C. 55), the section 199A deduction, net operating
  losses (172) and the at-risk rules (465) are not modelled.
- **C3** A rental's `purchase_date` is the month placed in service (the brief: "the month first rented"; P527 Placed in
  Service: "considered placed in service in July when it was ready and available for rent"), from 1998 to today; the key
  refuses a later one.
- **C4** No passive activity other than the rentals; no prior-year unallowed (suspended) loss; no passive credits.
- **C5** The filer actively participates in every rental (USC469(i)(6)(A): at least 10% of the interests, with the spouse;
  I8582: "approving new tenants, deciding on rental terms, approving capital or repair expenditures"), is not a real estate
  professional (USC469(c)(7); the household has W-2 wages), rents long term with no personal use (USC469(j)(10), 280A).
- **C6** The year's rent and running costs are the page's 12-month figures and the year's mortgage interest is the page's
  loan year from today, for every rental, also one placed in service during the tax year (`first_year` flags it: the real
  return would have only the months after it was placed in service).
- **C7** Every running cost typed is deductible in the year (P527 Rental Expenses: "the expenses of renting your property,
  such as maintenance, insurance, taxes, and interest, can be deducted from your rental income"; Types of Expenses lists
  "Cleaning and maintenance", "Insurance", "Management fees", "Mortgage interest paid to banks, etc.", "Repairs", "Taxes",
  "Utilities"; Condominiums: "you can deduct any dues or assessments paid for maintenance of the common elements. You can't
  deduct special assessments you pay to a condominium management corporation for improvements"). `hoa_monthly` is regular
  dues; `maintenance` is repairs, not improvements. Loan principal is not deductible.
- **G1** Each rental is its own activity. CFR14694 (c)(1)-(2): activities "may be treated as a single activity if the
  activities constitute an appropriate economic unit", on "all the relevant facts and circumstances". Grouping does not change
  the household totals here (every rental is rental real estate with active participation), only the per-rental split.

## 3. Page A per rental (page convention; the law has no counterpart for these figures)

All from the brief, exact (`rental_money`):
- rent = `rent_monthly` x 12; vacancy = rent x `vacancy` (blank 5%); income = rent - vacancy;
- running costs (opex) = `property_tax` + `insurance` + `hoa_monthly` x 12 + value x `maintenance` (blank 1%) + income x
  `management` (blank 0) + `utilities_monthly` x 12 + `other_monthly` x 12 (a blank cost is 0);
- NOI = income - opex; cap rate = NOI / value;
- the loan year (section 3.1): debt service, interest, principal; cash flow = NOI - debt service;
- cash-on-cash = cash flow / `cash_in` (blank or 0: blank); DSCR = NOI / debt service (blank without a loan or with no
  payment); break-even occupancy = (opex + debt service) / rent; one-percent = `rent_monthly` / purchase price;
- equity = value - loan balance today; growth = value x `appreciation` (blank 3.5%); total return = cash flow + principal +
  growth; return on equity = total return / equity (**E1**: blank when equity is 0 or less; the case builder should keep
  loans below value).

### 3.1 The loan year (both pages)

Brief: 12 monthly payments from today's balance. Each month, while the balance is more than 0.005: interest = balance x rate
/ 12; payment = min(payment, balance + interest); balance = balance + interest - payment. Debt service = the payments made;
interest = the sum of the monthly interest, at most what was paid; principal = paid - interest (`loan_year`). No rounding
inside the year (convention **R1**: exact Fractions, money rounded half up to the cent only when shown). A loan paid off in
month 2 stops there (asserted: 1,000 at 12% with 600 a month pays 600 + 414.10).

## 4. Depreciation of the building

**Law.** USC168(a): the deduction is determined "by using (1) the applicable depreciation method, (2) the applicable recovery
period, and (3) the applicable convention". (b)(3): "The applicable depreciation method shall be the straight line method in
the case of the following property: ... (B) Residential rental property." (b)(4): "Salvage value shall be treated as zero."
(c): "Residential rental property 27.5 years". (d)(2): for "residential rental property ... the applicable convention is the
mid-month convention". (d)(4)(B): "The mid-month convention is a convention which treats all property placed in service
during any month (or disposed of during any month) as placed in service (or disposed of) on the mid-point of such month."
(e)(2)(A)(i): residential rental property is a building "if 80 percent or more of the gross rental income ... is rental income
from dwelling units". (USC168, https://uscode.house.gov/us/usc/119-136/t26/s168/, read 2026-10-31.)

P946 Figuring the Deduction Without Using the Tables: "Straight line rate. You determine the straight line depreciation rate
for any tax year by dividing the number 1 by the years remaining in the recovery period at the beginning of that year. When
figuring the number of years remaining, you must take into account the convention used in the year you placed the property
in service. If the number of years remaining is less than 1, the depreciation rate for that tax year is 1.0 (100%)."
Mid-month convention: "multiplying the depreciation for a full year by a fraction. The numerator of the fraction is the
number of full months in the year that the property is in service plus 1/2 (or 0.5). The denominator is 12 ... your
depreciation deduction for the year that includes the final month of the recovery period is the amount of your unrecovered
basis in the property." Example: "The property is in service 4 full months (September, October, November, and December).
Your numerator is 4.5". (P946, https://www.irs.gov/pub/irs-pdf/p946.pdf, read 2026-10-31.)

P527 Land: "You can't depreciate the cost of land because land generally doesn't wear out". Separating cost of land and
buildings: "The part of the cost that you allocate to each asset is the ratio of the FMV of that asset to the FMV of the whole
property at the time you buy it." (P527, https://www.irs.gov/pub/irs-pdf/p527.pdf, read 2026-10-31.)

**What the key does** (`depreciable_basis`, `depreciation_exact`): basis = price x (1 - `land_share`, blank 20%) +
improvements; a full year = basis / 27.5; the year placed in service = a full year x (12 - month + 0.5) / 12; nothing before
it; never more than the unrecovered basis, so the last year takes what is left. With 1 / remaining years the straight-line
rate of every full year is exactly basis / 27.5, so this is the statute's computation and it equals the page's formula. The
recovery ends 27.5 years after the middle of the month placed in service: placed in January to June, year 28 is partial
((month + 5.5) / 12 of a year); July to December, year 28 is full and year 29 takes (month - 6.5) / 12. A building placed in
service in March 1998 has its last deduction in 2025 (8.5/12 of a year) and none in 2026; one placed in August 1998 has
1.5/12 of a year in 2026.

**Table A-6 (contrast column `depreciation_table`).** P946: "You can figure it using a percentage table provided by the IRS,
or you can figure it yourself without using the table." "Caution: Figuring MACRS deductions without using the tables will
generally result in a slightly different amount than using the tables." Rules Covering the Use of the Tables: "1. You must
apply the rates in the percentage tables to your property's unadjusted basis ... 3. Once you start using the percentage tables
for any item of property, you must generally continue to use them for the entire recovery period". Both are lawful; the key's
main column is the formula (the statute's arithmetic, and the page's), the table is the contrast. P527 Table 2-2d prints
the same percentages for years 1 to 6.

Table A-6 as printed (percent of basis; columns = month placed in service):

| Year | Jan | Feb | Mar | Apr | May | Jun | Jul | Aug | Sep | Oct | Nov | Dec |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 3.485 | 3.182 | 2.879 | 2.576 | 2.273 | 1.970 | 1.667 | 1.364 | 1.061 | 0.758 | 0.455 | 0.152 |
| 2-9 | 3.636 | 3.636 | 3.636 | 3.636 | 3.636 | 3.636 | 3.636 | 3.636 | 3.636 | 3.636 | 3.636 | 3.636 |
| 10, 12, ..., 26 | 3.637 (Jan-Jun) | | | | | | 3.636 (Jul-Dec) | | | | | |
| 11, 13, ..., 27 | 3.636 (Jan-Jun) | | | | | | 3.637 (Jul-Dec) | | | | | |
| 28 | 1.97 | 2.273 | 2.576 | 2.879 | 3.182 | 3.485 | 3.636 | 3.636 | 3.636 | 3.636 | 3.636 | 3.636 |
| 29 | | | | | | | 0.152 | 0.455 | 0.758 | 1.061 | 1.364 | 1.667 |

`table_a6_rebuilt` reproduces all 342 printed entries with one rule (the key's finding; no source read states it, and Rev.
Proc. 87-57, which prescribes the tables, was not read): year 1 = the exact first-year percentage rounded half up to 0.001%;
each later year = (100% - the rounded percentages so far) / (recovery years left at the start of the year), rounded half up
to 0.001%; when less than one year is left, the rest. That is P946's straight-line rate applied to rounded figures, and it
explains the 3.636 / 3.637 alternation (the rounding down accumulates until the next year rounds up).

**How much they differ.** In any one year the table is off the exact formula by at most **0.000636 percentage points of
basis** (7/11000 of a percent: $0.64 per $100,000 of basis); the cumulative difference is at most **0.002939 points**
(97/33000, July column after year 10: $2.94 per $100,000); over the whole recovery both give 100% of basis. Examples asserted:
P527's $160,000 building placed in service in February: table 3.182% = $5,091.20 (P527 prints "$5,091"), exact $5,090.91;
P946's $100,000 placed in service in July 2023: a full 2025 year by the table "$3,636" (exact 3,636.36).

**Improvements (note only, convention I1).** USC168(i)(6): "(A) any deduction under subsection (a) for such addition or
improvement shall be computed in the same manner as the deduction for such property would be computed if such property had
been placed in service at the same time as such addition or improvement, and (B) the applicable recovery period for any such
addition or improvement shall begin on the later of (i) the date on which such addition (or improvement) is placed in
service, or (ii) the date on which the property ... is placed in service." P527: "Treat additions or improvements you make to
your depreciable rental property as separate property items for depreciation purposes." The case has no improvement date, so
the key adds `improvements` to the building's basis from its own placed-in-service month, as the page does. An improvement
made later would, by law, start its own 27.5 years (mid-month) in its own month; the key cannot know that month.

## 5. The taxable result and the passive activity rules

**Taxable result per rental** (brief; law and page alike): income - opex - interest - depreciation (C6, C7).

**Law.** USC469(a)(1): for an individual, "the passive activity loss ... for the taxable year shall [not] be allowed". (b):
"any loss or credit from an activity which is disallowed under subsection (a) shall be treated as a deduction or credit
allocable to such activity in the next taxable year." (c)(2): "the term 'passive activity' includes any rental activity."
(d)(1): "The term 'passive activity loss' means the amount (if any) by which (A) the aggregate losses from all passive
activities for the taxable year, exceed (B) the aggregate income from all passive activities for such year." CFR14692
(b)(1): "the passive activity loss for the taxable year is the amount, if any, by which the passive activity deductions for
the taxable year exceed the passive activity gross income".

(i)(1): "In the case of any natural person, subsection (a) shall not apply to that portion of the passive activity loss ...
which is attributable to all rental real estate activities with respect to which such individual actively participated".
(i)(2): "The aggregate amount to which paragraph (1) applies for any taxable year shall not exceed $25,000." (i)(3)(A): "the
$25,000 amount under paragraph (2) shall be reduced (but not below zero) by 50 percent of the amount by which the adjusted
gross income of the taxpayer for the taxable year exceeds $100,000." (i)(3)(E): "adjusted gross income shall be determined
without regard to (i) any amount includible in gross income under section 86, ... (iii) the amounts allowable as a deduction
under sections 219, 221, and 250, and (iv) any passive activity loss". (The brief's "469(i)(3)(F)" was redesignated (E) by
Pub. L. 115-141 in 2018.) (i)(5)(A): for "any married individual filing a separate return, this subsection shall be applied
by substituting (i) '$12,500' for '$25,000' each place it appears, (ii) '$50,000' for '$100,000' in paragraph (3)(A)".
(i)(5)(B): "This subsection shall not apply to a taxpayer who (i) is a married individual filing a separate return for any
taxable year, and (ii) does not live apart from his spouse at all times during such taxable year." (j)(4): "The passive
activity loss ... (and the $25,000 amount under subsection (i)) shall be allocated to activities, and within activities, on a
pro rata basis". (USC469, https://uscode.house.gov/us/usc/119-136/t26/s469/, read 2026-10-31.)

CFR14691 (f)(2)(i)(A): "a ratable portion of the loss (if any) from each passive activity of the taxpayer is disallowed ...
computed by multiplying the passive activity loss that is disallowed for the taxable year by the fraction obtained by dividing
(1) The loss from the activity for the taxable year; by (2) The sum of the losses for the taxable year from all activities
having losses"; (B)(2): the loss from an activity is "reduced by ... Any part of such amount that is allowed under section
469(i)". Example 1 (= P925 Terry): A -9,000, B -16,000, C +4,000: "A: $21,000 x $9,000/$25,000 $7,560; B: $21,000 x
$16,000/$25,000 $13,440" (asserted). (https://www.ecfr.gov/current/title-26/section-1.469-1T, read 2026-10-31.)

F8582 (2025): Part I line 1a "Activities with net income", 1b "Activities with net loss", 1d "Combine", line 3 "If this line
is zero or more, stop here ... all losses are allowed"; "Caution: If your filing status is married filing separately and you
lived with your spouse at any time during the year, do not complete Part II." Part II: line 4 "the smaller of the loss on line
1d or the loss on line 3", 5 "Enter $150,000", 6 "modified adjusted gross income, but not less than zero", 7 "Subtract line 6
from line 5", 8 "Multiply line 7 by 50% (0.50). Do not enter more than $25,000", 9 "the smaller of line 4 or line 8"; Part
III line 10 "Add the income, if any, on lines 1a and 2a", 11 "Total losses allowed ... Add lines 9 and 10". I8582: line 5
"Married persons filing separate returns who lived apart from their spouses at all times during the year must enter $75,000
on line 5 instead of $150,000"; line 6 "To figure modified adjusted gross income, combine all the amounts used to figure
adjusted gross income, except don't take into account: Any passive activity loss as defined in section 469(d)(1), ..."; line
8 "Don't enter more than $12,500 ... if you're married filing a separate return and you and your spouse lived apart at all
times"; Part IV caution "Married individuals who file separate returns and lived with their spouses at any time during the
tax year don't qualify under the active participation rule and must use Part V"; Part VI column (b) "Divide each of the
individual losses shown in column (a) by the total of all the losses", (c) "Multiply each ratio in column (b) by the amount on
Part II, line 9"; Part VII column (c): A = line 3, B = line 9, "Multiply each ratio in column (b) by the amount on line C";
Part VIII column (c) "These amounts are the losses allowed for 2025". (I8582 / F8582, https://www.irs.gov/pub/irs-pdf/i8582.pdf
and https://www.irs.gov/pub/irs-pdf/f8582.pdf, read 2026-10-31.)

P925 (2025): "If you lived with your spouse at any time during the year and are filing a separate return, you can't use the
special allowance to reduce your nonpassive income or tax on nonpassive income." Example: "$70,000 in wages, $15,000 passive
income from a limited partnership, and a $26,000 passive loss from rental real estate ... You can use $15,000 of your $26,000
loss to offset your $15,000 passive income ... the remaining $11,000 rental real estate loss to offset $11,000 of your
nonpassive income (wages)." Phaseout example: "$120,000 in salary and a $31,000 loss ... you can deduct only $15,000 ... carry
over the remaining $16,000" (all asserted, with P527's "$40,000 in wages, $2,000 of passive income ... $3,500 of passive loss
... The remaining $1,500 loss can be deducted from your $40,000 wages" and P925's Stacey). (P925,
https://www.irs.gov/pub/irs-pdf/p925.pdf, read 2026-10-31.)

**What the key does** (`passive_law`), for the rentals' taxable results:
1. Income I = the sum of the rentals with a result of 0 or more; losses L = the sum of the losses; net passive result = I - L.
2. Passive activity loss PAL = max(0, L - I). Rentals with income absorb the other rentals' losses first.
3. Allowance cap: $25,000 - 50% x max(0, MAGI - $100,000), floor 0; married filing separately and lived apart all year:
   $12,500 - 50% x max(0, MAGI - $50,000); married filing separately and not lived apart all year: **0**. MAGI = the wages
   (AGI before the rentals, with no passive activity loss in it: I8582 line 6), not less than zero.
4. Allowed against wages (line 9) = min(PAL, cap); suspended = PAL - line 9, carried to next year (469(b)).
5. Per loss rental: suspended = suspended total x its loss / L (Parts VI-VII; the allowance and the unallowed loss go by the
   same ratios); allowed = its loss - its suspended part. Per income rental: its income, all reported.
6. Allowed net result (what reaches AGI on Schedule 1 line 5) = net passive result + suspended total.

**Page convention** (`passive_page`): each loss alone, with no netting against the rentals that have income; the cap is $25,000
less half of the wages over $100,000, or $12,500 less half of the wages over $50,000 on every separate return (lived apart or
not); the cap is used by the rentals in input order, each loss taking what the earlier ones left; the rest of each loss is
"carried forward". The page's MAGI (the wages) is the law's MAGI here (C1, C4).

Where they differ: (a) the law nets income rentals against loss rentals before the cap (the page leaves a loss's excess over
the cap unused even when another rental's income could absorb it); (b) the law spreads the suspended loss pro rata, the page
in order (same total when no rental has income); (c) a married-separate filer who lived with the spouse gets no allowance by
law.

## 6. The federal tax (both pages)

### 6.1 Brackets, standard deduction, 0/15/20% tops (read in the revenue procedures; identical to FEDKEY ss.1, 2, 5 and TLKEY s.5.1)

| Year | Status | Bracket tops 10/12/22/24/32/35% | Standard deduction | 0% to | 15% to | Source |
|---|---|---|---|---|---|---|
| 2025 | single | 11,925 / 48,475 / 103,350 / 197,300 / 250,525 / 626,350 | 15,750 | 48,350 | 533,400 | RP2440 s.2.01 Table 3, s.2.03; RP2532 s.3.01 |
| 2025 | married_joint | 23,850 / 96,950 / 206,700 / 394,600 / 501,050 / 751,600 | 31,500 | 96,700 | 600,050 | RP2440 s.2.01 Table 1, s.2.03; RP2532 s.3.01 |
| 2025 | married_separate | 11,925 / 48,475 / 103,350 / 197,300 / 250,525 / 375,800 | 15,750 | 48,350 | 300,000 | RP2440 s.2.01 Table 4, s.2.03; RP2532 s.3.01 |
| 2025 | head_of_household | 17,000 / 64,850 / 103,350 / 197,300 / 250,500 / 626,350 | 23,625 | 64,750 | 566,700 | RP2440 s.2.01 Table 2, s.2.03; RP2532 s.3.01 |
| 2026 | single | 12,400 / 50,400 / 105,700 / 201,775 / 256,225 / 640,600 | 16,100 | 49,450 | 545,500 | RP2532 s.4.01 Table 3, s.4.03, s.4.14(1) |
| 2026 | married_joint | 24,800 / 100,800 / 211,400 / 403,550 / 512,450 / 768,700 | 32,200 | 98,900 | 613,700 | RP2532 s.4.01 Table 1, s.4.03, s.4.14(1) |
| 2026 | married_separate | 12,400 / 50,400 / 105,700 / 201,775 / 256,225 / 384,350 | 16,100 | 49,450 | 306,850 | RP2532 s.4.01 Table 4, s.4.03, s.4.14(1) |
| 2026 | head_of_household | 17,700 / 67,450 / 105,700 / 201,750 / 256,200 / 640,600 | 24,150 | 66,200 | 579,600 | RP2532 s.4.01 Table 2, s.4.03, s.4.14(1) |

RP2532 s.3.01: "Section 63(c)(7) as amended by the OBBBA provides the standard deduction amounts ... for any taxable year
beginning in 2025 ... $31,500 ... $23,625 ... $15,750 ... $15,750. Accordingly, section 2.15(1) of Rev. Proc. 2024-40 is
removed." `check_tables()` rebuilds all 56 "The Tax Is" base amounts printed in the two revenue procedures from the tops.

### 6.2 A long-term gain stacked on top at 0/15/20%

I1040 Qualified Dividends and Capital Gain Tax Worksheet, run exactly (`qdcg_tax`): line 5 = taxable income - the gain;
line 9 "This amount is taxed at 0%" (the part of the gain under the 0% top); line 18 "Multiply line 17 by 15% (0.15)"; line 21
"Multiply line 20 by 20% (0.20)"; line 25 "Tax on all taxable income. Enter the smaller of line 23 or line 24" (lines 22 and
24 by the exact formula, convention C2). (I1040, https://www.irs.gov/pub/irs-pdf/i1040gi.pdf, read 2026-10-31.)

### 6.3 Net investment income tax

USC1411(a)(1): "a tax equal to 3.8 percent of the lesser of (A) net investment income for such taxable year, or (B) the excess
(if any) of (i) the modified adjusted gross income for such taxable year, over (ii) the threshold amount"; (b) "$250,000"
joint, "1/2 of the dollar amount determined under paragraph (1)" (125,000) separate, "in any other case, $200,000";
(c)(1): "net investment income means the excess (if any) of (A) the sum of (i) gross income from interest, dividends,
annuities, royalties, and rents, other than such income which is derived in the ordinary course of a trade or business not
described in paragraph (2), (ii) other gross income derived from a trade or business described in paragraph (2), and (iii) net
gain (to the extent taken into account in computing taxable income) attributable to the disposition of property ..., over (B)
the deductions allowed by this subtitle which are properly allocable to such gross income or net gain"; (c)(2)(A): "a passive
activity (within the meaning of section 469)". (USC1411, https://uscode.house.gov/us/usc/119-136/t26/s1411/, read
2026-10-31.)

CFR14114 (a)(1)(i): "Gross income from interest, dividends, annuities, royalties, and rents"; (f)(2)(i): "Deductions described in
section 62(a)(4) allocable to rents and royalties ... are taken into account in determining net investment income"; (f)(1)(ii):
"Any deductions described in this paragraph (f) in excess of gross income and net gain ... are not taken into account in
determining net investment income in any other taxable year, except as allowed under chapter 1." I8960 Line 4a: "Schedule 1
(Form 1040), line 5" (the Schedule E result after Form 8582). So a rental's NII is its allowed result: a suspended loss
counts only when it is allowed.

Key: NII = max(0, the allowed net rental result) on page A and the taxable gain on page B (no other NII, C1); NIIT = 3.8% x
min(NII, max(0, AGI - threshold)).

## 7. Page A: the law's federal tax change and the page's tax line

**Law (main column, `law_tax_change`).** Federal tax with the allowed net rental result (section 5, step 6) added to the
wages as ordinary income, minus the federal tax on the wages alone; both with NIIT (6.3), where the allowed net rental result
is net investment income when positive and MAGI includes it. Also shown: `law_niit_change`, the law's after-tax total = the
rentals' total cash flow - `law_tax_change`, and per rental `law_allowed`, `law_suspended`, `law_allowed_result`.

**Page convention (contrast).** Marginal rate = (federal tax with $1,000 more ordinary non-wage, non-investment income -
federal tax) / 1,000 on the wages alone, floor 0 (`page_marginal_rate`; the extra $1,000 is not investment income, so NIIT
never moves it). Convention **R2** (TLKEY s.6): each federal total is rounded half up to the cent before the two are
subtracted (it changes nothing when the wages are whole dollars, since every bracket top and rate then gives whole cents).
Per rental: tax line = taxable x marginal rate when taxable >= 0, else -(usable loss) x marginal rate; after-tax = cash flow -
tax line. `page_tax_line_total` is the sum of the unrounded lines; `ratio` = law / page (blank when the page total is 0).

Why they differ: the netting and the married-separate rule (section 5); the page's one rate for the whole amount, while the
law's change can cross a bracket or the standard-deduction floor; and the NIIT on net rental income (example 9.4).

## 8. Page B: the home and the tax on selling it

CASE fields: `value`, `purchase_price`, `purchase_date` (owned and lived in as the main home since then), `improvements`,
`sell_share` (blank 6%), `property_tax`, `insurance`, `hoa_monthly`, `maintenance` (blank 1% of value), `appreciation` (blank
3.5%), a mortgage (`loan_balance`, `loan_rate`, `loan_payment`, or none).

### 8.1 Page figures (page convention)

equity = value - balance; LTV = balance / value; growth since bought = (value / price)^(12 / whole months owned) - 1, shown
only when owned 12 months or more (worked in Decimal at 60 digits, `growth_since_bought`); the year's costs = property tax +
insurance + hoa x 12 + value x maintenance + the interest of the loan year (3.1); values ahead = value x (1 + appreciation)^n
for n = 5, 10, 20. Selling today: costs = value x sell share; basis = price + improvements; gain = value - costs - basis;
exclusion = $500,000 for married filing jointly, else $250,000, always applied; taxable gain = max(0, gain - exclusion); rate
= 15%, or 20% when federal taxable income + taxable gain exceeds 600,050 (joint) / 533,400 (every other status), plus 3.8%
when AGI (the wages) + taxable gain exceeds 250,000 (joint) / 200,000 (others); tax = taxable gain x rate; keep = value -
costs - mortgage balance - tax.

- **M1 (what "whole months owned" means; to be compared with the page).** The key assumes: (years x 12 + months) between the
  purchase date and today, less one when today's day of the month is before the purchase's (no month-end adjustment).
  Alternatives kept for the comparison: **M2** the calendar-month difference, days ignored; **M3** floor(days x 12 / 365.25).
  The three agree in every example of section 9. They differ, e.g., for a purchase on 2025-01-31 seen on 2026-02-28 (M1 12,
  M2 13, M3 12) or on 2025-03-15 seen on 2026-03-14 (M1 11 and no growth shown, M2 12, M3 11).
- **H6** The page's "federal taxable income" in the 20% test is max(0, wages - the case year's standard deduction).

### 8.2 The exclusion (law)

USC121(a): "Gross income shall not include gain from the sale or exchange of property if, during the 5-year period ending on
the date of the sale or exchange, such property has been owned and used by the taxpayer as the taxpayer's principal residence
for periods aggregating 2 years or more." (b)(1): "shall not exceed $250,000." (b)(2)(A): "Paragraph (1) shall be applied by
substituting '$500,000' for '$250,000' if (i) either spouse meets the ownership requirements ...; (ii) both spouses meet the
use requirements ...; and (iii) neither spouse is ineligible ... by reason of paragraph (3)." (b)(3): "Subsection (a) shall not
apply to any sale or exchange by the taxpayer if, during the 2-year period ending on the date of such sale or exchange, there
was any other sale or exchange by the taxpayer to which subsection (a) applied." (USC121,
https://uscode.house.gov/us/usc/119-136/t26/s121/, read 2026-10-31.)

CFR1211 (c)(1): "The requirements of ownership and use for periods aggregating 2 years or more may be satisfied by
establishing ownership and use for 24 full months or for 730 days (365 x 2)." (c)(4) Example 3: bought "January 18, 1997",
sold "May 25, 2000": "C owned the townhouse for at least 2 years out of the 5 years preceding the sale (from January 19, 1997
until May 25, 2000)" (asserted). (https://www.ecfr.gov/current/title-26/section-1.121-1, read 2026-10-31.) P523 Eligibility
Step 2: "If you owned the home for at least 24 months (2 years) out of the last 5 years leading up to the date of sale (date of
the closing), you meet the ownership requirement"; Step 3: "a total of 24 months (730 days) of residence during the 5-year
period". Worksheet 2 line 7: "Figure your gain or loss (amount realized minus adjusted basis) ... If the number is negative
... You can't deduct this loss". (P523, https://www.irs.gov/pub/irs-pdf/p523.pdf, read 2026-10-31.)

**What the key does** (`meets_two_of_five`, `home_case`): days owned = sale date - purchase date (counting from the day after
the purchase, the sale day included: Example 3 above; P550 "begin counting on the date after the day you acquired the
property. The day you disposed of the property is part of your holding period"); full months by calendar month ends
(**L1**: a purchase on a month's last day completes a month on each later month's last day; a day missing in a shorter month
falls back to its last day). The test is met when days >= 730 **or** full months >= 24. Days reach 730 one day before 24 full
months when a February 29 lies inside (bought 2023-11-02: 730 days on 2025-11-01, 23 full months; asserted); they never come
later. Exclusion = min(max(0, gain), $250,000 or $500,000 joint) when met, else 0; a loss is not deductible (P523), taxable
gain 0.

Conventions: **H1** the filer has owned and used the home as the main home since `purchase_date` (the brief: "every case"),
with no nonqualified use (121(b)(5)), no depreciation after May 6, 1997 (121(d)(6)), no like-kind exchange property
(121(d)(10)), and no excluded sale in the 2 years before (121(b)(3)); **H2** on a joint return both spouses lived there all
along and neither is barred by (b)(3), so the cap is $500,000; on a separate return the filer alone owns it ($250,000);
**H3** the sale date is today, and the tax year is today's year (P523 "Home's date of sale ... the date the title transferred
or the date the economic burdens and benefits of ownership shifted to the buyer").

### 8.3 The reduced maximum exclusion (contrast column)

USC121(c)(1): the dollar limitation "shall be equal to (A) the amount which bears the same ratio to such limitation ... as (B)(i)
the shorter of (I) the aggregate periods, during the 5-year period ending on the date of such sale or exchange, such property
has been owned and used by the taxpayer as the taxpayer's principal residence; or (II) the period after the date of the most
recent prior sale or exchange by the taxpayer to which subsection (a) applied ..., bears to (ii) 2 years." (c)(2): it applies
when the 2-year test fails and "such sale or exchange is by reason of a change in place of employment, health, or, to the
extent provided in regulations, unforeseen circumstances." CFR1213 (g)(1): "The numerator of the fraction may be expressed in
days or months. The denominator of the fraction is 730 days or 24 months (depending on the measure of time used in the
numerator)." (g)(2) Example 1: "Twelve months after the purchase, A sells the house due to a change in place of her
employment ... A is eligible to exclude up to $125,000 of the gain from the sale of her house (12/24 x $250,000)"; Example 2:
"(365/730 x $250,000)" (both asserted). (https://www.ecfr.gov/current/title-26/section-1.121-3, read 2026-10-31.) P523
Worksheet 1 section B: "Take the smallest period from Step 1 (you may use days or months) and divide that number by 730 (if
using days) or 24 (if using months)".

The page cannot know the reason for a sale, so the key shows, when the 2-year test fails: `reduced_fraction_days` = days owned
/ 730 and `reduced_fraction_months` = full months / 24; `reduced_max_days`, `reduced_max_months` = the cap x the fraction; and,
by days (convention **H4**: CFR1213 lets the taxpayer use either measure; days is usually, not always, the larger: 549 days
give 0.752055 against 18/24, but 2025-01-31 to 2025-02-28 is 28 days, 0.038356, against one full month, 0.041667),
`reduced_exclusion`, `reduced_taxable_gain`, `reduced_tax`, `reduced_keep`. No prior excluded sale (H1), so (B)(i)(II)
never binds. When the test is met, the fractions are 1.

### 8.4 Long-term or short-term

USC1222(1): "short-term capital gain means gain from the sale or exchange of a capital asset held for not more than 1 year";
(3): "long-term capital gain means gain from the sale or exchange of a capital asset held for more than 1 year". P550 (2025):
"If you hold investment property more than 1 year, any capital gain or loss is a long-term capital gain or loss. If you hold
the property 1 year or less, any capital gain or loss is a short-term capital gain or loss. ... begin counting on the date
after the day you acquired the property. The day you disposed of the property is part of your holding period. Example. If you
bought investment property on January 31, 2024, and sold it on January 29, 2025, your holding period is not more than 1 year
... If you sold it on February 6, 2025, your holding period is more than 1 year" (asserted). P523: "Report the sale on Part I
or Part II of Form 8949 as a short-term or long-term transaction, depending on how long you owned the home."

`first_long_day`: the day after the first anniversary; for a purchase on a month's last day, the first day of the 13th month
after (Rev. Rul. 66-7 as read in TLKEY s.3, not re-read here). The two readings differ only for a purchase on February 28 of a
year before a leap year, whose first long-term day falls in 2024 or 2028, never a 2025-2026 question.

### 8.5 The law's tax on the sale and the keep figure

`law_tax` = federal tax with the taxable gain - federal tax without it, on wages plus the gain: a long-term gain stacked on top
at 0/15/20% through the year's own breakpoints (6.2); a short-term gain as ordinary income; NIIT on the lesser of the taxable
gain and MAGI over the threshold (6.3). The excluded part is not net investment income: CFR14114 (d)(3)(ii) Example 3, "under
section 121(a), A excludes the $200,000 gain realized from the sale of A's principal residence from A's Year 1 gross income
and, consequently, from A's net investment income" (also 1411(c)(1)(A)(iii) "to the extent taken into account in computing
taxable income"). `law_keep` = value - costs - mortgage balance - `law_tax`.

Where the page differs: it always applies the exclusion (no 2-year test); it always uses 15% or 20% (never 0%, never ordinary
rates for a short holding); the 20% and 3.8% are cliffs on the whole gain, not stacked; its thresholds are 2025's single and
joint figures in every year and for every status (the law's married-separate 15% top is 300,000 / 306,850 and its NIIT
threshold 125,000; head of household 566,700 / 579,600); the NIIT is 3.8% of the whole gain, not of the lesser amount.

## 9. Worked examples (invented people; asserted by `rules.py`)

All amounts in dollars; `today` is 2026-11-16 unless said.

### 9.1 Ivo's duplex, bought in March 2019

Single, 2026, wages 85,000. Duplex: price 400,000, placed in service March 2019, land share blank (20%), improvements 10,000,
value 520,000, rent 3,400 a month, vacancy blank (5%), property tax 6,200, insurance 1,800, maintenance blank (1%),
management 8%, utilities 150 a month, no loan, cash in 410,000.

Depreciation: basis = 400,000 x 0.8 + 10,000 = **330,000**; a full year = 330,000 / 27.5 = **12,000**.

| Year | Recovery year | Exact (law and page) | Table A-6 % | Table A-6 amount | Table - exact |
|---|---|---|---|---|---|
| 2019 | 1 | 12,000 x 9.5/12 = **9,500.00** | 2.879 | 9,500.70 | +0.70 |
| 2026 | 8 | **12,000.00** | 3.636 | 11,998.80 | -1.20 |
| 2028 | 10 | 12,000.00 | 3.637 | 12,002.10 | +2.10 |
| 2046 (last) | 28 | 330,000 - 9,500 - 26 x 12,000 = **8,500.00** (= 12,000 x 8.5/12) | 2.576 | 8,500.80 | +0.80 |
| 2047 | | 0 | | 0 | |

March 2019 is 9 full months + half of March in 2019; the 27.5 years end in mid-September 2046, so 2046 has 8.5 months; 28
deductions, total 330,000 both ways.

Page figures for 2026: rent 40,800; vacancy 2,040; income 38,760; opex = 6,200 + 1,800 + 5,200 + 3,100.80 + 1,800 =
**18,100.80**; NOI **20,659.20**; cap rate 20,659.20 / 520,000 = **0.039729**; no loan: cash flow 20,659.20, DSCR blank;
cash-on-cash 20,659.20 / 410,000 = **0.050388**; break-even 18,100.80 / 40,800 = 0.443647; one-percent 3,400 / 400,000 =
0.008500; equity 520,000; growth 18,200; total return 38,859.20; return on equity 0.074729. Taxable result = 38,760 -
18,100.80 - 0 - 12,000 = **8,659.20**.

Tax: taxable income 85,000 - 16,100 = 68,900 (22% band); page marginal rate **0.220000**; page tax line 8,659.20 x 0.22 =
**1,905.02**. Law: net passive result +8,659.20, nothing suspended; tax on 77,559.20 = 11,775.02 vs 9,870.00 = **1,905.02**;
no NIIT (MAGI 93,659.20). Here law and page agree.

### 9.2 Jun's two rentals: +8,000 and -30,000, at wages of 90,000 and of 130,000

Single, 2026. Rental A: price 275,000 (placed in service January 2015, basis 220,000, 8,000 a year), value 300,000, rent 2,000
a month, property tax 2,800, insurance 1,000, maintenance blank (3,000), no loan: income 22,800, opex 6,800, NOI 16,000,
taxable **+8,000**. Rental B: price 400,000 + improvements 10,000 (placed in service June 2012, basis 330,000, 12,000 a year),
value 755,000, rent 2,500 a month, property tax 9,000, insurance 2,500, HOA 300 a month, maintenance blank (7,550), management
10% (2,850), utilities 200 and other 50 a month; interest-only loan 300,000 at 6% paying 1,500 a month: income 28,500, opex
28,500, NOI 0, interest 18,000, principal 0, cash flow -18,000, taxable **-30,000**. (B: cap rate 0, DSCR 0, cash-on-cash
-0.225000 on 80,000, break-even 1.550000, equity 455,000, total return 8,425.)

| | Wages 90,000 | Wages 130,000 |
|---|---|---|
| Net passive result | 8,000 - 30,000 = -22,000 | -22,000 |
| Law cap (MAGI = wages) | 25,000 | 25,000 - 50% x 30,000 = 10,000 |
| Law: allowed against wages / suspended | 22,000 / **0** | 10,000 / **12,000** |
| Law per rental (B) | allowed 30,000, suspended 0 | allowed 8,000 + 10,000 = 18,000, suspended 12,000 |
| Allowed net result into AGI | -22,000 | -10,000 |
| Law tax change | tax(51,900) - tax(73,900) = 6,130 - 10,970 = **-4,840.00** | tax(103,900) - tax(113,900) = 17,570 - 19,934 = **-2,364.00** |
| Page cap; B usable / carried | 25,000; 25,000 / 5,000 | 10,000; 10,000 / 20,000 |
| Page marginal rate | 0.220000 | 0.240000 |
| Page tax lines A, B; total | 1,760 - 5,500 = **-3,740.00** | 1,920 - 2,400 = **-480.00** |
| Ratio law / page | 1.294118 | 4.925000 |

At 90,000 the law lets B's whole loss count (8,000 absorbed by A's income, 22,000 against wages), so nothing carries; the page
carries 5,000 because it never lets A's income absorb B's loss. At 130,000 the law's 2,364 = 8,200 x 24% + 1,800 x 22% (the
10,000 crosses the 24% / 22% line at 105,700), the page prices only (8,000 - 10,000) at 24%.

### 9.3 Kit, married filing separately, living with the spouse, with a 10,000 rental loss

2025, today 2025-12-01, wages 60,000, `lived_apart_all_year` = no. Rental: price 275,000 (placed in service September 2016,
basis 220,000, 8,000 a year), value 350,000, rent 1,500 a month, property tax 1,500, insurance 900, maintenance blank (3,500),
utilities 100 a month; interest-only loan 240,000 at 5% paying 1,000 a month. Income 17,100; opex 7,100; NOI 10,000; interest
12,000; taxable **-10,000**; cash flow -2,000; DSCR 0.833333; equity 110,000; return on equity 0.093182.

- Law: married filing separately and not living apart all year: no special allowance (469(i)(5)(B); F8582 Part I caution); no
  passive income; the whole **10,000 is suspended**; **law tax change 0.00**.
- Page: cap = 12,500 - 50% x (60,000 - 50,000) = **7,500**; usable 7,500, carried 2,500; marginal rate: taxable income 60,000
  - 15,750 = 44,250 (12% band) -> **0.120000**; tax line **-900.00**; after-tax -1,100. The page shows a 900 saving the law
  does not give.
- Had Kit lived apart all year: the law's cap is the page's 7,500; tax on 36,750 (4,171.50) vs 44,250 (5,071.50): **-900.00**,
  suspended 2,500, the same as the page.

### 9.4 Mo and Noor: the NIIT on net rental income

Married filing jointly, 2026, wages 300,000, Ivo's duplex of 9.1 (taxable 8,659.20). Page: taxable income 267,800 (24% band),
marginal rate 0.240000 (the extra $1,000 is not investment income), tax line **2,078.21**. Law: income tax 2,078.21 (still
24%) plus NIIT 3.8% x min(8,659.20, 308,659.20 - 250,000) = **329.05**; law tax change **2,407.26**; ratio 1.158333.

### 9.5 Pat's home, bought 18 months ago, sold today at a gain

Single, 2026, wages 95,000. Bought 2025-05-16 for 400,000, improvements 5,000, value 460,000, sell share blank (6%), property
tax 5,500, insurance 1,600, mortgage 360,000 at 6% paying 2,200 a month.

- Page: equity 100,000; LTV 0.782609; months owned 18 (M1 = M2 = M3); growth since bought (460/400)^(12/18) - 1 =
  1.15^(2/3) - 1 = **0.097653**; loan year interest 21,465.78; the year's costs 5,500 + 1,600 + 4,600 + 21,465.78 =
  **33,165.78**; values ahead 546,335.70 / 648,875.43 / 915,302.88. Sale: costs 27,600; basis 405,000; gain **27,400**;
  exclusion 250,000; taxable 0; tax 0; keep 460,000 - 27,600 - 360,000 = **72,400.00**.
- Law: owned 549 days (365 + 184) and 18 full months: under 730 days and 24 months, so **no exclusion**. Held more than a year
  (first long-term day 2026-05-17): long-term. Taxable income 78,900 is above the 0% top (49,450), so the 27,400 is all at 15%
  = **4,110.00**; AGI 122,400, no NIIT. Keep **68,290.00**.
- Contrast (121(c), if the move was for work, health or an unforeseen event): 549/730 x 250,000 = **188,013.70** (months: 18/24
  x 250,000 = 187,500); either covers the 27,400: reduced tax 0, keep 72,400.
- The same home bought 2026-01-16 (10 months, 304 days) is short-term: the 27,400 is ordinary income on top of 78,900:
  22% x 26,800 + 24% x 600 = **6,040.00**; no growth figure (under 12 months); reduced cap 304/730 x 250,000 = 104,109.59.

### 9.6 Quinn's long-held home with a 700,000 gain

Single, 2026, wages 180,000. Bought 2004-06-15 for 380,000, improvements 48,000, value 1,200,000, sell share blank (6%),
mortgage 150,000 at 4% paying 1,600 a month. Costs 72,000; basis 428,000; gain **700,000**; owned 8,189 days, 269 months:
the test is met; exclusion 250,000; taxable gain **450,000**, long-term.

- Law: taxable income without the sale 163,900 (tax 31,934). With it, 613,900; QDCG worksheet: line 5 = 163,900 (over the
  49,450 0% top, so line 9 = 0); line 16 = 545,500 - 163,900 = 381,600 at 15% = 57,240; line 20 = 450,000 - 381,600 = 68,400
  at 20% = 13,680; income tax +70,920. NIIT: 3.8% x min(450,000, 630,000 - 200,000 = 430,000) = **16,340**. **Law tax
  87,260.00**; keep 1,200,000 - 72,000 - 150,000 - 87,260 = **890,740.00**.
- Page: 163,900 + 450,000 = 613,900 > 533,400, so 20% on all of it; 180,000 + 450,000 > 200,000, so + 3.8%: 23.8% x 450,000 =
  **107,100.00**; keep **870,900.00**. The page overstates the tax by 19,840: 381,600 of the gain is in the 15% band by law,
  and the NIIT applies only to the 430,000 of MAGI over 200,000.
- Page figures: equity 1,050,000; LTV 0.125000; growth since bought (1,200/380)^(12/269) - 1 = 0.052635; loan year interest
  5,755.29; the year's costs 14,000 + 3,000 + 12,000 + 5,755.29 = 34,755.29.

## 10. Rounding and outputs

Exact Fractions throughout; money is rounded half up to the cent and rates and ratios to six decimals only when shown (R1);
totals are sums of unrounded figures (a page that rounds each rental first can differ by a cent per rental). Suggested
columns:
- Page A per rental: `rent`, `vacancy`, `income`, `opex`, `noi`, `cap_rate`, `debt_service`, `interest`, `principal`,
  `cash_flow`, `cash_on_cash`, `dscr`, `break_even`, `one_percent`, `basis`, `depreciation` (law = page), `depreciation_table`,
  `depreciation_diff`, `taxable`, `first_year`, `law_allowed`, `law_suspended`, `law_allowed_result`, `page_usable`,
  `page_carry`, `page_tax_line`, `page_after_tax`, `equity`, `growth`, `total_return`, `roe`.
- Page A per household: `net_passive`, `pal`, `law_cap`, `law_allowed_against_wages`, `law_suspended_total`,
  `law_allowed_net`, `law_tax_change`, `law_niit_change`, `law_after_tax_total`, `marginal_rate`, `page_cap`,
  `page_usable_total`, `page_carry_total`, `page_tax_line_total`, `page_after_tax_total`, `ratio`.
- Page B: `equity`, `ltv`, `months_owned_m1` (and `_m2`, `_m3`), `growth_since_bought` (and `_m2`, `_m3`), `interest_year`,
  `costs_year`, `value_5y`, `value_10y`, `value_20y`, `sell_costs`, `basis`, `gain`, `page_taxable_gain`, `page_rate`,
  `page_tax`, `page_keep`, `days_owned`, `full_months_owned`, `meets_2_of_5`, `first_long_day`, `term`, `law_exclusion`,
  `law_taxable_gain`, `law_tax`, `law_niit`, `law_keep`, `reduced_fraction_days`, `reduced_fraction_months`,
  `reduced_max_days`, `reduced_max_months`, `reduced_tax`, `reduced_keep`.

## 11. Conventions in one list

C1 one earner, wages not NII, MAGI = AGI; C2 income tax + NIIT, exact formula, no credits, AMT, 199A, 465, 172, additional
Medicare; C3 placed in service 1998 to today; C4 no other passive activity, no carry-in; C5 active participation, not a real
estate professional, long-term rentals; C6 the page's 12-month figures are the tax year's; C7 every typed cost deductible;
G1 one activity per rental; E1 return on equity blank at equity <= 0; I1 improvements with the building; R1 exact, rounded
when shown; R2 the page's rate from totals rounded to the cent; M1 whole months (M2, M3 kept for comparison); L1 month ends;
H1 owned and used since the purchase, nothing that cuts the exclusion; H2 joint spouses both qualify; H3 sold today; H4 the
reduced exclusion by days (months shown too); H6 the page's taxable income = wages - standard deduction.

## 12. Not verified, open points, findings

- The **2026** Pubs. 523, 527, 925, 946 and Form 8582 instructions are not published yet; the 2025 editions are used for 2026
  rows (121, 168(b)-(d), 469 and 1411 have no amendment by Pub. L. 119-21 or later that touches these rules; Pub. L. 119-21
  changed 168(e)(3) and (k) only).
- The rule that rebuilds **Table A-6** is the key's finding (it reproduces all 342 entries); Rev. Proc. 87-57 was not read.
- **Rev. Rul. 66-7** (last day of a month) was not re-read; taken from TLKEY s.3 (secondary copy there). It cannot change a
  2025-2026 sale's term.
- The page's meaning of a **month** (M1, M2, M3), whether its rates use totals rounded to the cent (**R2**), its "federal
  taxable income" (**H6**), whether it blanks return on equity at negative equity (**E1**), and whether it treats a blank
  `management` or cost as 0: not checked (the independence rule forbids reading its code).
- Not modelled: section 199A for rental income, at-risk limits (465), a net operating loss when the allowed loss exceeds the
  wages, AMT, depreciation recapture on a later sale of a rental, partial-year rent for a rental placed in service this year
  (C6).
- **Finding on the brief:** "469(i)(3)(F) modified AGI" is **469(i)(3)(E)** since Pub. L. 115-141, s.401(d)(5)(B)(i) (2018)
  redesignated it (USC469 amendment notes: "Subsec. (i)(3)(E), (F). ... redesignated subpar. (F) as (E)").
- **Finding on the page (expected from the brief, to be confirmed by the comparison):** the page gives a married-separate
  filer who lived with the spouse an allowance the law denies (9.3); it does not net rentals with income against rentals with
  losses (9.2); it leaves out the NIIT on net rental income (9.4); on the home it applies the exclusion without the 2-year test,
  never the 0% band or ordinary rates, and uses 2025's single/joint 20% and NIIT thresholds for every status and year (9.5,
  9.6).
