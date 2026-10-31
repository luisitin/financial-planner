# Vehicles, Big purchase planner and Renovation: rules sheet for the answer key

This sheet is the spec of an independent answer key for three household calculators: "Vehicles" (what a car costs a year,
and keep, buy or lease), "Big purchase planner" (save up, finance or pay cash, and which goals give way) and "Renovation"
(paying for a home improvement). `tools/golden_property_goals/rules.py` holds every figure as data, with its source and the
date it was read on the same line, plus each rule as a small pure function. This sheet gives each rule in plain words with
its source, the conventions the key adopts, and three examples worked by hand (section 8), which `rules.py` asserts when
imported (194 self-checks, all passing).

**Revised 2026-10-31, after the first comparison with the pages** (section 11): six conventions changed. Two were the key's
own readings where the brief is silent and the page's is as good (C1, what the 3% is a share of; B8 and 5.2, a figure that
cannot be below 0); two follow the brief's own aim, like for like, where its letter left a debt or an equity out (A5, A6);
one replaces the brief's "the refinance always fits" by the cash-out limit HUD sets (C4). The old readings stay as contrast
columns.

**Revised again 2026-10-31: the pages' stated conventions are the main columns** (section 11). The brief asked the main
columns to check each page's own model exactly and to put other readings, the law and doubts in contrast columns. The first
run found places where the main column held the key's own reading instead of the page's stated one. The pages' conventions,
now given to the key, are the main readings: what rises on Keep, Buy and Lease (V1, V2), whole months by W2 (P1), a goal
already done is skipped (P2), Pay cash fits when the usable cash covers the amount (P3), tax saved within the law's limits
(R1), today's money after the tax saved (R2), no refinance without a mortgage (R3) and the best by a walk with a $1 margin
(R5). Each earlier reading of the key is kept as an `alt_*` contrast column.

**Revised a third time 2026-10-31, after a verifier's review** (sections 5.5, 6, 11): R1's line figure takes the limit's
share off the line's own interest only. IRS Publication 936's Table 1 puts that share on all the home's mortgage interest, so
once the line takes the home debt over L the mortgage's own deduction is cut too, while both run. The main columns keep R1
(the page's stated convention); two law columns give the Table 1 figure (`line_law_tax_saved_table1`,
`line_law_todays_money_table1`). No main column changed. Section 4.4's reason for P3 was also corrected: the usable cash
includes the emergency fund. The verifier read the pages' code to check the key. Three reasons in the text (4.4, 4.5, 5.3)
now cite what it found there, marked as such. No figure or formula was taken from the app: the new law columns come from
P936 Table 1.

**Revised a fourth time 2026-10-31: more of the pages' stated conventions are the main columns** (sections 3.4, 4.5,
5.2 to 5.6, 7 to 11). The pages now state five more conventions, and each is the key's main reading; the earlier main
reading is kept as an `alt_*` column where it differs. **L1:** the line's tax saved and today's money by P936 Table 1 (the
mortgage's own share is cut while the line runs), the third revision's law columns, now main; R1's line figure is the
contrast. **A7:** cash back when the old car's equity and the cash down cover the new car with its tax (the key's formula
already; now exercised by edge rows). **A9:** the cheapest by a walk keep, buy, lease with a $1 margin, as R5. **B5:** a spare
below 0 counts as 0. **D1:** blank what-if, line, refinance and loan inputs take the pages' defaults (a blank new mpg 32, a
blank new upkeep $500, a blank refinance rate or years 6.5% and 30 years, ...). Sixteen edge rows were added; the random
rows are the same draws as before.

**Corrected 2026-10-31, after the fourth revision's comparison with the pages (E1; sections 3.4, 7, 8.1, 10, 11).** The
comparison found one cause: every electric first car (96 rows, each with a blank new mpg). The key had read D1's 32 mpg as
making an electric household's new car a petrol car at a fuel price it gave the electric cars for that purpose; the page
charges the new car like the car. D1 sets the default of the new mpg box, and the page takes it (32 on every blank row), but
an electric car is charged by its kWh (the page's README: "electric: miles x kWh a mile x price") and the page does not
compare gas against electric (its README lists "Gas against electric" under "Ideas / not yet"). So **E1**: on an electric
first car a blank new mpg leaves the new car charged like the car. The fourth revision's figures are kept as the contrast
`alt_buy_electric_new_at_32_mpg`, `alt_lease_electric_new_at_32_mpg`; the fuel price the electric cars carry is now used only
there. Only those 96 rows changed (their buy and lease figures and the contrasts built on them, and the cheapest in 9).

**Independence.** Written from the brief (which states the three pages' models, the "page convention"), the law (26 U.S.C.
163 and 63), IRS Publication 936 (2025), the CFPB home-equity booklet, the interagency real-estate lending guidelines (12
CFR part 34), a HUD mortgagee letter, a Freddie Mac consumer page, a state tax page and three consumer-finance articles on
car depreciation. Nobody opened `modules/`, `core/` or `tests/*.test.mjs` while writing it, and the key never imports or
runs the app. Only the layout and conventions of `tools/golden_property/` and `tools/golden_debt/` (and of their rules sheets
in `tests/golden/property/` and `tests/golden/debt/`) were looked at. Where a
fact the page states could be wrong (a lender's limit, a tax rule, a payment formula) the key keeps the page's arithmetic in
the main columns and adds a **law / contrast** figure with its source.

**Inputs from the app.** Each case carries the figures the pages take from elsewhere in the app; the test reads them from
the app and feeds them in: `spare` (money left each month), `usable_cash`, `emergency_target`, `cash_return` (a year),
`blended_return` (the plan's, a year), `top_rate` (federal marginal rate), `itemizes` (yes/no), `essential_monthly`.

**Today is 2026-10-31.** Every source was read on **2026-10-31**. Each was saved and hashed (first 8 ... last 10 hex digits
of sha256); the list is also in the `rules.py` docstring.

## 1. Sources

| Id | Document | URL | Sha |
|---|---|---|---|
| USC163 | 26 U.S.C. 163 (OLRC, "current through Public Law 119-136 (October 22, 2026)"); (h)(3)(F) as amended by Pub. L. 119-21 s.70108; (h)(4) added by s.70203(a) | https://uscode.house.gov/us/usc/119-136/t26/s163/ | ddf94cff...4a740cdbe0 |
| LII163 | 26 U.S.C. 163 at Cornell LII (cross-check of (h)(3)(F) and (h)(4): same text) | https://www.law.cornell.edu/uscode/text/26/163 | 53ffe402...5b6e1b091d |
| USC63 | 26 U.S.C. 63(b)(7) | https://uscode.house.gov/us/usc/119-136/t26/s63/ | ed5cc3db...c6cabf21e4 |
| P936 | IRS Publication 936 (2025), Home Mortgage Interest Deduction, "For use in preparing 2025 Returns" (PDF modified 2025-12-12) | https://www.irs.gov/pub/irs-pdf/p936.pdf | a4ef802b...7dc31c32de |
| CFPBHL | CFPB, "What you should know about Home Equity Lines of Credit (HELOC)" (the 12 CFR 1026.40(e) booklet; PDF of 2022-10-12) | https://files.consumerfinance.gov/f/documents/cfpb_heloc-brochure.pdf | 7dae37f7...0022cac3a9 |
| OCC34 | 12 CFR part 34, subpart D, Appendix A, Interagency Guidelines for Real Estate Lending Policies (eCFR as of 2026-10-29) | https://www.ecfr.gov/api/versioner/v1/full/2026-10-29/title-12.xml?part=34&subpart=D | 20156f0f...cc107e1c54 |
| HUD1911 | HUD Mortgagee Letter 2019-11 (Aug. 1, 2019), FHA cash-out refinance LTV and CLTV | https://www.hud.gov/sites/dfiles/OCHCO/documents/19-11ml.pdf | 27063e59...68c038d243 |
| FMREFI | Freddie Mac My Home, "Understanding the costs of refinancing" | https://myhome.freddiemac.com/refinancing/costs-of-refinancing | 84e8d3e3...75c63c324e |
| RAMSEY | Ramsey Solutions, G. Kamel, "Car Depreciation: How Much Is Your Car Worth?" (published Nov 20, 2023; last updated Jul 22, 2025) | https://www.ramseysolutions.com/saving/car-depreciation | aeae63c0...ab664e9ea9 |
| LTREE | LendingTree, "Car Depreciation: How Much Is My Car Worth?" (modified 2025-04-30) | https://www.lendingtree.com/auto/how-much-do-new-cars-depreciate/ | d52c8b51...df56d6f2ac |
| SFARM | State Farm, "Car Depreciation Calculator: How To Minimize Value Loss" | https://www.statefarm.com/simple-insights/auto-and-vehicles/calculate-your-vehicle-depreciation | 284d1184...478a47d3a3 |
| TXMV | Texas Comptroller, Motor Vehicle Tax FAQ | https://comptroller.texas.gov/taxes/motor-vehicle/faq.php | 42e71d3f...57d8e5daec |
| CFPBDI | CFPB, Ask CFPB: "I got a credit card promising no interest for a purchase if I pay in full within 12 months. How does this work?" (last reviewed Jan 22, 2024) | https://www.consumerfinance.gov/ask-cfpb/what-is-a-deferred-interest-promotion-en-40/ | d9c987de...d5bff6f23b |
| BRIEF | the task brief: the three pages' models ("page convention") and "Today is 2026-10-31" | (task) | |
| STATED | the pages' stated conventions V1-V3, P1-P3, R1-R5, given to the key on 2026-10-31 with the second revision ("they are now also exactly what the pages do"); L1, A7, A9, B5 and D1, given with the fourth revision ("The pages now do the following (each is the page's stated convention ...)") | (task) | |

Tried and not read: Fannie Mae's Eligibility Matrix (`singlefamily.fanniemae.com/media/20786/display`, HTTP 403) and Carfax's
depreciation article (HTTP 403). Fannie Mae Selling Guide B2-1.3-03 "Cash-Out Refinance Transactions" (dated 12/10/2025) was
read through a fetch tool (no saved copy, no hash): it gives no figure and sends the reader to the Eligibility Matrix.

## 2. Shared arithmetic

### 2.1 Exact numbers, rounding (R1, R2)

Every amount is an exact fraction while it is worked (`Fraction`); money is rounded half up to the cent, and rates and ratios
to six decimals, only when shown (**R1**). Totals are sums of unrounded parts. Payments are not rounded to the cent before
they are used (**R2**); a page that rounds the payment first can differ by a few cents over a schedule. Three figures in
section 8 are exact half cents and show the rounding rule: the buy and lease running costs of year 4 under the all-rising
contrast (4,758.325 and 4,558.675) and one contrast total (35,230.765), shown 4,758.33, 4,558.68 and 35,230.77. A total is
the sum of unrounded parts, so it can be a cent away from the sum of its rounded parts (Keep's cost in 8.1, the line's and
the refinance's today's money in 8.3).

### 2.2 The loan month

Brief (page A, used for every schedule in the key, `run_loan`): each month, while the balance is more than 0.005: interest =
balance x rate / 12; payment = min(payment, balance + interest); balance = balance + interest - payment. Paid = the sum of
the payments; interest = the sum of the monthly interest (**A8**: not capped at what was paid; the case builder keeps every
payment above the first month's interest). Asserted: 1,000 at 12% with 600 a month pays 600 + 414.10 and stops in month 2.
A schedule run "to the end" stops at 1,200 months and raises if the payment never pays the loan off (key guard).

### 2.3 A level payment (two derivations)

Brief: `pmt(rate / 12, n, amount)`; at 0% the payment is amount / n. The balance after n level payments p at a monthly rate
r is `B (1 + r)^n - p ((1 + r)^n - 1) / r`; setting it to 0 gives **p = B r / (1 - (1 + r)^-n)** (`level_payment`). The second
derivation (`level_payment_by_schedule`) uses that the final balance is linear in p: `p = A (1 + r)^n / sum_{t<n} (1 + r)^t`.
The two agree exactly, the exact schedule ends at exactly 0, and the textbook values come out: 100,000 at 6% over 360 months
= 599.55; 200,000 at 6.5% over 360 = 1,264.14; 30,000 at 12% over 60 = 667.33. The formula the pages state is the standard
annuity payment; nothing to contrast.

### 2.4 Today's money (present value)

Brief (page C): `sum over months m = 1..n of payment / (1 + r / 12)^m`, with r the plan's blended return a year. For a level
payment this is `p (1 - (1 + j)^-n) / j`, j = r / 12 (j = 0: p n) (`annuity_pv`); any other list (the old mortgage, whose
last payment is smaller) is summed month by month (`pv_payments`). The two agree exactly on a level list.

## 3. Page A, "Vehicles" (page convention throughout)

### 3.1 A car's year (`car_year`)

- value lost = value x loss (loss blank = **12%**, a page convention with no source);
- fuel = miles / mpg x fuel price; an electric car: miles x kWh a mile x price a kWh;
- insurance, upkeep (maintenance) and registration as typed (blank = 0);
- loan interest over the next 12 payments (section 2.2; no loan = 0);
- total = the sum; per mile = total / miles (blank at 0 miles, **A10**); monthly = total / 12.

### 3.2 Values at the end of the period

- A used car after n years: value x (1 - loss)^n.
- A new car: price x 0.8 after year one, then x 0.85 a year: **price x 0.8 x 0.85^(n - 1)** (n = 0: the price). The price is
  before sales tax.

**Contrast, depreciation averages.** No official source gives an average; the figures are a page convention. A public
consumer-finance source states exactly the page's two rates: RAMSEY: "After one year, your car takes the biggest drop in
value and will be worth about 20% less than what you paid for it" and "After that first-year dip, a new car depreciates by
about 15% every year until it hits the five-year mark." Its own table (48,000 new: 38,400, 32,640, 27,744, 23,582 after 1 to
4 years) equals the page's rule to the dollar (asserted), but its fifth row is 19,200 ("around 60%" lost) where the rule gives
20,045.04 (58.2395% lost). LTREE: "A brand new car usually drops about 20% in value after one year. Within five years, it will
be worth around 60% less than the price you paid." SFARM: "about 20% in the first year and approximately 60% by year five."
The key reports `new_car_loss_at_end` (1 - 0.8 x 0.85^(n-1)) so a reader can compare with "about 60% by year five".

### 3.3 Running costs over the period (V1, V2; contrast A1)

Brief: fuel, insurance, registration and upkeep, "each year's running costs rising by the upkeep rise compounding a year
(year 1 at today's level)"; the rise is blank = 10% a year (page convention). The sentence can be read two ways; the pages
state which (given to the key on 2026-10-31), and that is the main reading:

- **V1, Keep:** running cost in year t (t = 0 .. Y - 1) = fuel (the old car's mpg, or electric) + insurance + registration +
  upkeep x (1 + rise)^t. Only the upkeep rises; fuel, insurance and registration stay at today's figures every year. Over 5
  years at 10% the upkeep's factor is 1 + 1.1 + 1.21 + 1.331 + 1.4641 = **6.1051**.
- **V2, Buy and Lease:** flat every year, nothing rises. Buy = fuel at the new mpg + insurance x the new insurance share +
  registration + the new maintenance; Lease = the same with the new maintenance x 0.5. Over Y years: Y times one year.
- **Contrasts.** `alt_keep_rise_all`, `alt_buy_rise_all`, `alt_lease_rise_all` (**A1**, the key's first reading and its
  main column until 2026-10-31): every running cost rises, year t = (fuel + insurance + registration + upkeep) x (1 +
  rise)^t, on all three ways. `alt_buy_rise_upkeep_only`, `alt_lease_rise_upkeep_only`: Keep's own rule (V1) applied to the
  new car, like for like.
- **Why the change:** the brief asked the main columns to follow the page's own model, and the page states V1 and V2. **Doubt
  kept for the owner:** Keep's upkeep rises while the new car's stays flat for up to ten years, which leans the comparison
  toward buying or leasing (8.1: Buy costs 30,750.33 flat, 31,081.86 with Keep's rule). In 36 rows the cheapest way is a
  different one under A1.

### 3.4 Keep, buy, lease (for the first car; period = whole years Y, P = 12 Y months)

**Keep** (`keep_way`): the old loan's payments for up to P months, stopping when paid (section 2.2) + the running costs (V1);
back = the car's value at the end (3.2) **less what the old loan still owes then** (**A6**, revised; **V3**: the page's
stated convention too). The brief's back left that debt in; but Buy pays the whole old loan off through the trade-in, so a
Keep that leaves part of it unpaid is not like for like: veh-0002 (one year, 2,052.62 still owed) would cost 2,052.62 less
than it does. `alt_keep_owed_end_ignored` keeps the brief's figure.

**Buy** (`buy_way`): trade-in = value - loan balance; a negative trade-in is paid in cash (added to what is paid);
financed = new price x (1 + sales tax) - max(0, trade-in) - cash down, a level-payment loan (2.3) at the new rate over the
new term (0% = principal / term), paid for up to P months (stopping when paid); cash down counted as paid; running costs of
the new car, flat every year (V2): fuel at the new mpg (and the car's fuel price), insurance x the share (blank **1.25**),
the new upkeep a year, registration unchanged (**A4**); back = the new car's value at the end - what is still owed on the
new loan. **D1 (the page's stated convention, fourth revision):** a blank new mpg is **32** (the petrol rule at the car's own
fuel price), a blank new maintenance **$500** a year, and every other blank what-if input its stated default: new price
**35,000**, sales tax **6%**, rate **7%**, term **60**, insurance share **1.25**, lease **450** a month, **3,000** due at
signing, **36** months, **12,000** miles a year, **0.25** a mile over, upkeep rise **10%** (a blank cash down is 0). The
key's earlier **A3** (a blank new mpg keeps the old car's fuel or electricity cost, a blank new maintenance the old upkeep)
is the contrast `alt_buy_blank_keeps_old`, `alt_lease_blank_keeps_old`. Before D1 the key also had no Buy without a new price
and no Lease without a payment or months, and took the other blanks as 0; no row had them blank, so no contrast is written
for those. **E1 (corrected after the fourth revision's comparison, section 11):** on an electric first car a blank new mpg
leaves the new car charged like the car (miles x kWh a mile x price a kWh, flat, V2): D1's 32 is the default of the new
mpg box, which only the petrol rule uses; an electric car is charged by its kWh (the page's README, "electric: miles x kWh a
mile x price"), and the page does not compare gas against electric (its README: "Gas against electric" under "Ideas / not
yet"). The fourth revision's reading, the new car at 32 mpg and a fuel price the electric car carries (each one in the rows
carries one, which its own year does not use), is the contrast `alt_buy_electric_new_at_32_mpg`,
`alt_lease_electric_new_at_32_mpg`; it changes the cheapest in 9 of the 96 electric first cars. A typed new mpg on an
electric first car keeps the petrol rule at that mpg (A3's typed case); no row has one (section 10). **A7 (the page's stated convention, fourth revision; the key's formula
already):** cash back = max(0, max(0, trade-in) + cash down - new price x (1 + tax)), and the financed amount is then 0;
paid = cash down + max(0, -trade-in) - cash back + payments + running costs. With cash back the cash down comes straight
back, so the cost does not depend on it (8.1).

**Lease** (`lease_way`): due at signing x ceil(P / lease months) + the monthly payment x P + max(0, miles a year - lease miles
a year) x Y x the excess charge + running costs with the upkeep halved, flat (V2) + a negative trade-in paid in cash **- a
positive trade-in** (**A5**, revised; **V3**: the page's stated convention too); back = 0. The old car goes when the lease
starts (the brief has its negative trade-in paid in cash), so its equity comes back as cash at signing, as Buy takes it off
what is financed; paid is net of it and can be below 0. The brief credited nothing, which made the lease dearer by the whole
equity (12,000 in 8.1); `lease_trade_in_credited` is the amount and `alt_lease_equity_not_credited` the brief's figure.
**A2 (the page's stated reading, V2):** the running costs are the new car's (as for buy) with the new upkeep halved;
contrast `alt_lease_old_running`: the old car's running costs with its upkeep halved (flat too). A blank lease input takes
D1's default (above).

Cost = paid - back; monthly = cost / P. **A9 (the page's stated convention, fourth revision):** the cheapest is found by a
walk keep, buy, lease: a later way replaces the current cheapest only when its cost is lower by more than $1 (as R5,
compared exactly before rounding); the period is a whole number of years. The key's earlier reading (the lowest, ties to
keep, then buy, then lease) is the contrast `alt_cheapest_lowest`. They differ only in `veh-0032` (buy 0.40 below keep: keep
stays the cheapest).

### 3.5 Law / contrast for page A

- **Sales tax and the trade-in.** The page taxes the full new price. Many states tax the price less the trade-in: TXMV "Will a
  trade-in reduce the taxable value? Yes. The value of a motor vehicle a seller receives as consideration for the purchase of
  another motor vehicle reduces the taxable value of the purchase." States differ, so this is a contrast, not a correction:
  `alt.buy_tax_after_trade_in_credit` charges the tax on max(0, price - the old car's value).
- **Car-loan interest deduction (2025-2028).** USC163 (h)(4)(A): for taxable years after 2024 and before 2029 "the term
  'personal interest' shall not include qualified passenger vehicle loan interest" (a loan after 2024 for a new vehicle whose
  final assembly was in the United States, first lien, personal use, VIN on the return; "Any lease financing" excluded;
  at most $10,000 a year, (C)(i); reduced by "$200 for each $1,000 ... by which the modified adjusted gross income ... exceeds
  $100,000 ($200,000 in the case of a joint return)", (C)(ii)); USC63 (b)(7) allows it without itemizing. The page counts no
  tax saving on the buy row; the key does not compute one (it needs the car's assembly place and MAGI), it only notes it.

## 4. Page B, "Big purchase planner" (page convention)

total = price x (1 + sales tax) (blank tax = 0). amount = max(0, total - set aside) (**B2**).

### 4.1 Whole calendar months to the date (P1: W2; contrasts W1, W3)

Brief: "months to the date = whole calendar months from today (at least 1)". **W2 (the page's count, main since
2026-10-31, P1):** (y2 - y1) x 12 + (m2 - m1), less 1 when the date's day of the month d2 is before today's d1: the day of
the month must be reached. Then at least 1; a blank date gives no save-up way (**B1**). Every figure that depends on the
months uses it: the save-up amount, earned, the goals that give way, their new months and delays. **W1 (the key's first
reading, its main until 2026-10-31; now `alt_months_w1`, with `alt_save_monthly_w1` and `alt_save_earned_w1`):** the
largest k >= 0 such that today + k months <= the date, where "+ k months" lands on the same day of the month, or on the
target month's last day when that day does not exist, and from a month's last day lands on the target month's last day
(`add_months`, `whole_months(..., 'W1')`). **W3** (`months_w3`) = the calendar-month difference, days ignored. Today is a
month's last day (October 31), where they part: by W2 the 31st is never reached in a shorter month, so every date that is
not a 31st counts one month less than the calendar difference.

| Date | W2 (main) | W1 | W3 | Why |
|---|---|---|---|---|
| 2026-10-31 (today) | 0 -> 1 | 0 -> 1 | 0 -> 1 | at least 1 |
| 2026-11-30 | 0 -> 1 | 1 | 1 | the 31st is not reached in November |
| 2026-12-30 | 1 | 1 | 2 | the 30th is before the 31st |
| 2026-12-31 | 2 | 2 | 2 | |
| 2027-02-28 | 3 | 4 | 4 | February's last day |
| 2027-06-30 | **7** | 8 | 8 | the sofa example |
| 2027-07-01 | 8 | 8 | 9 | |

Why the change: W1 was the key's own reading of "whole calendar months"; the page counts W2, and the brief asked the main
columns to follow the page's own model. W2 and W1 differ in 124 rows of purchases.csv.

The arrival of a goal after n months is the date today + n months by `add_months` (**B6**, unchanged; 11 months from
2026-10-31 is 2027-09-30). A goal's months do not depend on the purchase date, only on its own saving.

### 4.2 Save up (`save_up_monthly`)

i = cash return / 12. The monthly amount m with `S (1 + i)^n + m ((1 + i)^n - 1) / i = total` (S = set aside; deposits at the
end of each month): **m = (total - S (1 + i)^n) i / ((1 + i)^n - 1)**; i = 0: (total - S) / n; at least 0. Earned = total - min(S, total)
- m n (**B8**, revised: the set-aside money counts up to the total, as it does for the amount to finance, B2, so earned is
0 when more than the total is already set aside; the first reading wrote total - S there, a negative "earned" such as
-820.00 in pur-0009). Second derivation: saving month by month (balance x (1 + i) + m) reaches the total exactly
(asserted).

### 4.3 Finance, and how the promo payment is solved (`promo_payment`)

On the amount: promo 0 = the level payment pmt(apr / 12, term, amount); promo = term, or apr 0 = all 0%: amount / term.
0 < promo < term: one payment p for the whole term; in the k promo months the balance falls by p; in the m = term - k months
after, it grows by its interest at apr / 12 and falls by p; p leaves exactly 0 after the term. **Solved exactly, not by
search:** after k months the balance is A - k p, and it must be the present value of the m remaining payments,
`A - k p = p (1 - (1 + r)^-m) / r`, so **p = A / (k + (1 - (1 + r)^-m) / r)**. Second derivation: the final balance is linear in
p, `B_final(p) = A (1 + r)^m - p (k (1 + r)^m + sum_{t<m} (1 + r)^t)`, solved for 0 (`promo_payment_by_schedule`). Both agree
exactly; the exact schedule ends at 0 and is positive every month before (asserted on four schedules). Interest = p x term -
amount.

**Contrast, deferred interest (B9).** The page's promo is a true 0% period. A store "no interest if paid in full" offer is
different: CFPBDI "if you haven't paid off the balance ... before the deferred interest period ends, you will be charged
interest on that balance. Usually, the interest is calculated based on the balance you owed in each month since you first
made the purchase." The page's p does not clear the balance by the end of the promo, so under such a plan interest would be
charged back. The key shows `balance_after_promo` = A - k p and `deferred_interest_if_not_paid` = sum over the k promo months
of that month's opening balance x apr / 12 (the key's simple approximation; a card's daily-balance method differs slightly).

### 4.4 Pay cash (P3)

amount = total - set aside (at least 0, B2); after = usable cash - amount; **fits when usable cash >= amount** (P3, the page's
stated convention, main since 2026-10-31). The key's first reading took the brief's "fits = after >= the emergency target"
(`alt_cash_fits_keeps_emergency_target`, the contrast). The note given to the key with P3 called it "already the key's main",
which was true of the amount and of what is left but not of the fit: the key tested what is left against the emergency
target. It now follows the page's statement. (Until the third revision this sheet said the brief's test would count the
cushion twice where the usable cash already leaves the emergency fund aside. That was a guess about the app, and a wrong one.
The verifier checked the app's liquidity page: usable cash is cash, checking and savings less what goals have set aside, so
it includes the emergency fund. P3 asks only whether the money is there. On all 393 rows where the two tests differed (third revision), the
page's screen warns that what is left is under the emergency target, so the brief's test lives on as that warning.) They
differ in the rows where what is left is at least 0 but below the emergency target (395 rows of purchases.csv).

### 4.5 Goals give way (`give_way`; P2)

For each way with a monthly amount (save: m; finance: p), when that amount is more than what is spare, need = amount -
max(0, spare) (**B5**, the page's stated convention since the fourth revision: a spare below 0 counts as 0, "Nothing spare:
everything comes from goals"). The key's earlier reading took spare literally, so with a spare below 0 the goals would also
cover the month's shortfall (need = amount - spare, and a need even when nothing is to be paid); it is the contrast
`alt_save_need_spare_literal`, `alt_save_uncovered_spare_literal`, `alt_finance_need_spare_literal`,
`alt_finance_uncovered_spare_literal`. No random row has a spare below 0; three edge rows do (`pur-0033` to `-0035`). Goals give up their monthly saving in this order: priority 3, then 2, then 1;
within a priority the latest due date first (**B3**: a blank due date counts as the latest; equal dates keep the listed order);
each gives up to its whole monthly saving until the need is covered. **P2 (the page's convention, main since 2026-10-31):** a
goal already done (what is set aside has reached its target: the page's status "done") is never taken from; it is skipped,
so the next goal in the order gives way instead. The key's first reading let a done goal give and be paused like any other
(its main until 2026-10-31); that reading is the contrast `alt_save_giving_done_goals_give` and
`alt_finance_giving_done_goals_give`, with what it leaves uncovered (`alt_save_uncovered_done_goals_give`,
`alt_finance_uncovered_done_goals_give`). Why: the brief is silent; the page's README says done goals are never touched, and
a goal at its target has no arrival left to move. The verifier (third revision) found a stronger reason in the app. The
money left each month (`spare`, from the next-best-action page) already takes off only the open goals' monthly saving
(`goalSaving` counts the goals whose status is not "done"). So a done goal's monthly is already in `spare`, and letting it
give way would count that money twice. In the rows, a done goal is skipped 168 times (per way) and the givers
change in 157 ways.

A goal's arrival: g = growth / 12; **the months n are the smallest whole number with `S (1 + g)^n + M ((1 + g)^n - 1) / g >=
target`** (g = 0: S + M n), found from the first guess ceil(ln((T g + M) / (S g + M)) / ln(1 + g)) and then checked and
corrected by exact comparison, so a target reached exactly is not pushed a month later (4 months for 600 at 150, asserted);
second derivation: by doubling and bisection on that closed form (asserted on seven goals against month by month). 0 when
already reached; **B7**: none (never) without saving or growth, or beyond 1,200 months. Each goal shows old and new months,
the delay and both arrival dates, and whether each is by the due date. **B4:** a goal left at 0 after giving is paused: no
new arrival (`growth_only_months` shows how long growth alone would take). What no goal covers is "more than you have"
(`shortfall` > 0).

## 5. Page C, "Renovation" (page convention)

### 5.1 Value added, cash, cushion

value added = cost x recoup share (a project name from the national table is turned into its share before the case reaches
the key); equity change = value added - cost. Cash: today's money 0, cost = the cost; fits when usable cash >= cost; cushion =
usable cash - cost, in months = cushion / essential spending a month.

### 5.2 Home-equity line

A level-payment loan of the cost at the heloc rate (blank **8%**) over heloc years (blank **10**; D1 states the same
defaults) (**C5**: the page's model; a real line usually has an interest-only draw period and a variable rate); interest =
payment x n - cost; tax saved 5.5 (L1), today's money 5.6. Borrowable = value x **85%** - mortgage, **at least 0** (revised: "about -17,000 could be borrowed" is not a
figure; ren-0005); **R4:** fits when value x 85% - M >= C, the same as borrowable >= cost. No home: no line (**C6**).

### 5.3 Cash-out refinance, and what the 3% is a share of (convention C1)

Brief: a new loan of mortgage + cost + closing costs at the refi rate over refi years, closing costs blank = 3%. **C1
(revised): 3% of mortgage + cost**, N = 1.03 (M + C), closing = 0.03 (M + C): the brief does not say what the 3% is a share
of, and this is the page's reading. The first reading was 3% of the new loan, which includes the costs themselves, N = (M +
C) / (1 - 0.03); FMREFI's "you can expect to spend 3%-6% of your loan principal" is a range for an estimate, not a rule that
settles it. The difference is (M + C) x 0.03^2 / 0.97 = 0.000928 (M + C) (273.71 on 295,000); `alt_cost_of_new_loan` (the
`alt_refi_*` columns) gives that reading's loan, closing costs, payment, today's money (after tax, 5.6) and LTV. Against
keeping the old mortgage on its own payment until it is paid (section 2.2, last payment smaller): payment change = new - old
payment; extra interest = the new loan's interest - the old mortgage's remaining interest; today's money before tax =
PV(new payments) - PV(old payments over its remaining life) - cost (after tax: 5.6). **D1 (the page's stated convention, fourth
revision): a blank refinance rate or years takes 6.5% and 30 years** (closing costs blank 3%, as before). The key's earlier
reading (C4's first half: the refinance shown only when its rate and years are typed) is the contrast
`alt_ranking_blank_refi_not_offered`, the ranking without the refinance in those rows (`ren-0016` to `-0018`; every random
row types both). **C4 (revised; R4, the page's stated convention):** **the refinance fits when the new loan, closing costs
included, is at most 80% of the home's value** (HUD1911, section 6; the brief let it always fit, which let a new loan of 120%
of the value "fit"); the personal loan always fits. **R3 (the page's convention, main since 2026-10-31): no refinance way at
all when there is no mortgage with a payment**; the refinance columns are blank and it is not ranked. The key's first
reading (C6: a refinance with an old side of 0, its main until 2026-10-31) is the contrast `alt_refi_no_mortgage_monthly`,
`alt_refi_no_mortgage_todays_money` (after tax), `alt_refi_no_mortgage_fits` and `alt_ranking_refi_no_mortgage` (the
ranking it would give). Why: the page's README offers none ("No mortgage with a payment: no refinance"). The first reason given here, that a
new first mortgage on a home owned outright is another product, was corrected in the third revision. Fannie Mae's Selling
Guide B2-1.3-03 (read 2026-10-31 through a fetch tool; no saved copy, no hash) lets a cash-out refinance "be a new mortgage
on a property that does not have a mortgage lien against it (the borrower owns the property free and clear at the time of
refinance)". So R3 is the page's convention, not a rule of the product, and the contrast columns show what a refinance on
a home owned outright would give. In 233 of the 239 homes without a
mortgage the contrast's refinance would fit, and in 87 it would be the best. **C9:** the mortgage payment is principal and
interest only.

### 5.4 Personal loan

A level-payment loan of the cost at the loan rate (blank **12%**) over its years (blank **5**; D1 states the same defaults);
today's money = PV(payments) - cost; no tax saving (USC163 (h)(1): "no deduction shall be allowed ... for personal interest").

### 5.5 Tax saved (R1; the line by L1)

Only when the household itemizes. L = $750,000, or $375,000 when married filing separately; M = the mortgage balance (0 with
none); C = the cost; N = the new loan; top = the top rate; s_new = min(1, L / (M + C)), s_old = min(1, L / M) (0 when M = 0).

- **Line (L1, the page's stated convention since the fourth revision):** (interest x s_new - the mortgage's interest over the
  line's term x (s_old - s_new)) x top. The mortgage's interest over the line's term (`line_mortgage_interest_in_term`) is
  the old mortgage stepped month by month on its own payment (section 2.2) for the line's heloc years x 12 months, or until
  it is paid.
- **Refinance (R1):** (the new loan's whole interest x min(M + C, L) / N - the old mortgage's remaining interest x min(1, L /
  M)) x top. It is below 0 when the new loan's deductible interest is less than the old mortgage's (139 rows).
- The personal loan and cash save nothing.

**R1 (the page's stated convention, main since the second revision)** is the law reading the key already had as its law
columns (section 6): the debt that bought, built or improved the home is acquisition debt up to L, and the closing costs
rolled into the new loan are not. The contrasts: `alt_line_tax_saved_no_limit` (the whole interest x top) and
`alt_refi_tax_saved_extra_interest` (the extra interest x top, **C2**: the key's first main reading), and
`refi_tax_saved_whole_new_interest` (the new loan's whole interest x top). The former law columns `line_law_tax_saved` and
`refi_law_tax_saved` would equal main ones and are gone; the shares stay (`line_law_share` = s_new, `refi_law_share`). For
the line, R1 put s_new on the line's own interest only, interest x s_new x top; since the fourth revision that is the
contrast `alt_line_tax_saved_r1` (with `alt_line_todays_money_r1` and `alt_ranking_line_r1`). In 149 rows the household
itemizes and the line's debt is above L, so the limit cuts the line's tax saved.

**L1, the line over the limit (P936 Table 1; the third revision's law columns `line_law_tax_saved_table1` and
`line_law_todays_money_table1`, now the main `line_tax_saved` and `line_todays_money`).** R1 takes the right share but puts
it on the line's interest alone. P936 Table 1 has line 12 "Enter the total of the average balances of all mortgages", line
13 "Enter the total amount of interest that you paid on the loans from line 12", line 14 "Divide the amount on line 11 by
the amount on line 12" and line 15 "Multiply the amount on line 13 by the decimal amount on line 14. ... This is your
deductible home mortgage interest". So the share falls on all the home's interest. Once M + C > L, the line also cuts the
mortgage's own deduction from s_old to s_new while both run. The refinance's R1 already compares against the old mortgage's
deduction; R1's line figure did not. L1 takes the shares by principal at the start (C8), and the mortgage's interest over
the line's months, month by month, stopping when it is paid. Seen as Table 1 over the line's term: the deductible interest
with the line, s_new x (line interest + the mortgage's), less without it, s_old x the mortgage's (asserted on `ren-0008`).

- tax saved = top x (line interest x s_new - mortgage interest over the line's months x (s_old - s_new));
- today's money = PV(line payments) - C - top x (s_new x PVI_line - (s_old - s_new) x PVI_mortgage over the line's months)
  (section 5.6).

Both equal R1's figures when M + C <= L, with no mortgage, or without itemizing. In 147 of the 149 capped rows L1's tax saved
is lower than R1's: 504,306.40 in all against R1's 1,124,114.99 (the written figures of the 149 rows); in the other two
(`ren-0447`, `ren-0693`) the mortgage is at 0% and pays no interest. It can be below 0 (39 rows): when the mortgage alone was
already over L, the line adds deduction only if it pays more interest per dollar than the mortgage over the same months.
Example, `ren-0008`: M 900,000 at 4%, C 120,000, L 750,000, top 24%. The line's interest is 54,711.74 and the mortgage's
over the line's 120 months is 305,500.39. R1 gives 54,711.74 x 750/1,020 x 0.24 = **9,655.01**; L1 takes off 305,500.39 x
(750/900 - 750/1,020) x 0.24 = 7,188.24, leaving **2,466.77**. Today's money is **14,878.56** by L1 and **9,141.43** by R1.
The mortgage alone can be under L and still lose part of its deduction (30 rows; `ren-0019`, 8.3); the mortgage can be paid
off inside the line's term, and then only its interest until then counts (43 rows; `ren-0020`, 8.3). With R1's figure the
ranking changes in 10 rows and the best in 5 (`ren-0291`, `ren-0450`, `ren-0895`, `ren-1038`, `ren-1169`, where R1 makes the
line best and L1 does not). Another allocation, the older debt filling the limit first (the line deductible only on max(0,
L - M)), is not what Table 1 does and is not written.

### 5.6 Today's money after the tax saved (R2), and the best (R5)

**R2 (the page's stated convention, main since 2026-10-31):** today's money is after the tax saved, discounted the same way
as the payments. PVI = the sum over months m = 1, 2, ... of that month's interest x (1 + d / 12)^-m, d the plan's return.

- cash: 0;
- line (L1): PV(payments) - C - (itemizes ? top x (s_new x PVI_line - (s_old - s_new) x PVI_mortgage over the line's
  months) : 0); R1's figure, top x s_new x PVI_line only, is the contrast `alt_line_todays_money_r1`;
- refinance: PV(new payments) - PV(old payments over the old mortgage's remaining life) - C - (itemizes ? top x (share_new x
  PVI_new - share_old x PVI_old) : 0), share_new = min(M + C, L) / N, share_old = min(1, L / M);
- personal loan: PV(payments) - C.

For a level loan of A at r a month with payment p, the balance before month m is A g^(m-1) - p (g^(m-1) - 1) / r (g = 1 +
r), so that month's interest is (r A - p) g^(m-1) + p and **PVI = (r A - p) v sum_{k<n} (g v)^k + p a_n** (v = 1 / (1 + d /
12), a_n the annuity factor of 2.4; g v = 1 gives n for the sum). `rules.py` steps each loan month by month and discounts
each month's interest (`pv_interest`); derivation 2 uses the closed form (and, for the old mortgage, its level months plus
the cut last month; for the mortgage over the line's months, the same with the line's months as the limit). At d = 0, PVI is the whole interest. Asserted: the two agree on four loans. The before-tax figure (**C3**,
the key's first reading, its main until 2026-10-31) is the contrast `alt_line_todays_money_before_tax`,
`alt_refi_todays_money_before_tax`. Why the change: the page subtracts the tax saved, and the brief asked the main columns to
follow the page; discounting the tax saved month by month with the interest it comes from is the like-for-like way.

**R5, the best (the page's stated convention, main since 2026-10-31):** walk the ways that fit in the order cash, line,
refinance, loan, starting from the first that fits; a way replaces the current best only when its today's money (R2) is
lower than the best's by more than $1 (compared exactly, before rounding). **`ranking`** is that walk repeated (the best, then
the best of the ways left, and so on) and **`best`** its first. Contrasts: `alt_ranking_lowest_first` (**C7**, the key's
first reading: lowest today's money first, exact ties in the order cash, line, refinance, loan) and `alt_ranking_before_tax`
(the same walk on the before-tax figures), and `alt_ranking_line_r1` (the walk with R1's line figure, L1's contrast) and
`alt_ranking_blank_refi_not_offered` (the walk without the refinance where its rate or years is blank, D1's contrast). Why:
the page's rule; a difference of a dollar is below what a household would act
on, and the order prefers the simpler way. In the rows the margin decides only `ren-0014` (the line 0.87 below cash: cash
stays best); the after-tax ranking differs from the before-tax one in 179 rows and the best in 91.

## 6. The law and the stated limits

**163(h)(3): is a line or a cash-out refinance used for the improvement acquisition debt? Yes, for the part used to improve.**
USC163 (h)(3)(B)(i): "The term 'acquisition indebtedness' means any indebtedness which (I) is incurred in acquiring,
constructing, or substantially improving any qualified residence of the taxpayer, and (II) is secured by such residence. Such
term also includes any indebtedness secured by such residence resulting from the refinancing of indebtedness meeting the
requirements of the preceding sentence (or this sentence); but only to the extent the amount of the indebtedness resulting
from such refinancing does not exceed the amount of the refinanced indebtedness." (F)(i), "In the case of taxable years
beginning after December 31, 2017": "(I) Disallowance of home equity indebtedness interest. Subparagraph (A)(ii) shall not
apply." (Pub. L. 119-21 s.70108 struck the end date "and before January 1, 2026", so this is now permanent.) P936, Note: "Interest on home equity loans and lines of credit
are deductible only if the borrowed funds are used to buy, build, or substantially improve the taxpayer's home that secures the
loan." P936 Reminders: "you can no longer deduct the interest from a loan secured by your home to the extent the loan proceeds
weren't used to buy, build, or substantially improve your home." P936, Refinanced home acquisition debt: "the new debt will
qualify as home acquisition debt only up to the amount of the balance of the old mortgage principal just before the
refinancing. Any additional debt not used to buy, build, or substantially improve a qualified home isn't home acquisition
debt." P936, Substantial improvement: "An improvement is substantial if it: Adds to the value of your home, Prolongs your
home's useful life, or Adapts your home to new uses. Repairs that maintain your home in good condition, such as repainting
your home, aren't substantial improvements." P936 conditions: "You file Form 1040 or 1040-SR and itemize deductions on Schedule
A".

So the brief's rule was right for the line (all of it was used for the improvement) and nearly right for the refinance: the
old balance is refinanced acquisition debt and the cost is acquisition debt, but **the closing costs rolled into the new loan
were not used to buy, build or improve, so the interest on that part is not deductible**. The share (`refi_law_share` =
min(M + C, limit) / N, kept pro rata over the loan, a simplification) gives 97% of the new loan's interest with the 3%
reading; since 2026-10-31 it is the main reading (R1, the page's stated convention), no longer only a law column. The line's
share is right too, but the law puts it on all the home's interest (P936 Table 1, section 5.5): above L the line also cuts the
mortgage's deduction, which R1 left out; since the fourth revision that is the page's stated convention and the main figure
(L1). The line is a "qualified residence" loan only if secured by the home (it is). A personal (unsecured) loan's
interest is personal interest, never deductible.

**The $750,000 limit.** (F)(i)(II): "Subparagraph (B)(ii) shall be applied by substituting '$750,000 ($375,000' for
'$1,000,000 ($500,000'." P936: "For debt secured after December 15, 2017, the limit is $750,000 ($375,000 if married filing
separately)"; debt secured before December 16, 2017 keeps $1 million ($500,000), and (F)(ii) lets a refinancing keep the old
date up to the refinanced amount. The brief did not test the limit; the page does (R1, main since 2026-10-31). **C8:** the key
treats the existing mortgage as post-2017 acquisition debt and takes deductible share = min(1, 750,000 / (mortgage + cost))
by principal at the start (P936 Table 1 uses each year's average balances); asserted: 800,000 of debt gives 15/16.

**Itemizing.** The page saves the deductible interest x top rate whenever the household itemizes. The real saving is the
fall in tax, which is less when the itemized total is near the standard deduction; the inputs do not allow the key to compute
it (a note only).

**The 85% combined limit is a page convention, not a usual legal or regulatory limit.** CFPBHL describes the shape only:
"Generally a percentage of the appraised value of your home, minus the amount you owe on your mortgage"; for a cash-out
refinance "the amount of your existing loan plus the amount you want to cash out", with "Closing costs are generally higher ...
interest rate may be higher than your current mortgage". OCC34 footnote 2: "A loan-to-value limit has not been established for
permanent mortgage or home equity loans on owner-occupied, 1- to 4-family residential property. However, for any such loan with a
loan-to-value ratio that equals or exceeds 90 percent at origination, an institution should require appropriate credit
enhancement in the form of either mortgage insurance or readily marketable collateral." (OCC34's table does print 85% for
"1- to 4-family residential" construction and for "Improved property", not for an owner-occupied home-equity loan.) Lender sites
commonly quote 80% to 85%; none was used as a source. The key keeps 85% (page) and shows `cltv_after`.

**A cash-out refinance has its own limit.** HUD1911 (FHA): "The maximum LTV is 80 percent of the Adjusted Value. The maximum
CLTV is 80 percent of the Adjusted Value." The key's refinance fits only at or under it (C4, revised) and shows `ltv_after` =
N / value and `above_fha_cash_out_limit` (the same test). Fannie Mae's matrix (also commonly 80% for a one-unit main home)
could not be read; a VA cash-out refinance can go higher, which the inputs cannot tell.

## 7. Conventions in one list

R1 exact, rounded half up when shown; R2 payments not rounded to the cent. (The renovation rules R1 to R5 below are the
pages' stated conventions of 2026-10-31; where the letters clash, "R1 rounding" and "R2 payments" mean these two.)

**The pages' stated conventions (main since 2026-10-31; the second revision's and the fourth's), each with the key's
earlier reading as its contrast:** V1 Keep's
running costs: only the upkeep rises (contrast A1: all rise); V2 Buy's and Lease's running costs flat, the lease with the new
upkeep halved (contrast A1: all rise; Keep's rule on the new car); V3 Keep's back less what the old loan owes then (A6) and a
positive trade-in credited on the lease (A5). P1 whole months by W2 (contrasts W1, W3); P2 a goal already done is skipped
when goals give way (contrast: it gives and is paused); P3 pay cash: amount = total - set aside, fits when usable cash >=
amount, after = usable cash - amount (contrast: fits when after >= the emergency target). R1 tax saved within the $750,000
($375,000) limit, closing costs left out (contrasts: no limit, the extra interest C2, the whole new interest); R2 today's
money after the tax saved, discounted like the payments (contrast C3: before tax); R3 no refinance without a mortgage with a
payment (contrast C6: old side 0); R4 the refinance fits when N <= 80% of the value (C4), the line when value x 85% - M >= C;
R5 the best by a walk with a $1 margin, the ranking that walk repeated (contrast C7: lowest first, exact ties by order).
Fourth revision: **L1** the line's tax saved and today's money by P936 Table 1, (line interest x s_new - the mortgage's
interest over the line's term x (s_old - s_new)) x top, the mortgage stepped on its own payment for the line's months or
until paid (contrast: R1's line figure, the line's interest x s_new only); **A7** cash back = max(0, max(0, trade-in) +
cash down - new price x (1 + tax)), buy paid = cash down + max(0, -trade-in) - cash back + payments + running (the key's
formula already; no contrast); **A9** the cheapest by a walk keep, buy, lease with a $1 margin (contrast: the lowest, ties
keep / buy / lease); **B5** need = amount - max(0, spare) (contrast: spare taken literally); **D1** blank inputs take the
pages' defaults: refinance 6.5% / 30 years (closing 3%), line 8% / 10, loan 12% / 5; new mpg 32, new upkeep $500, new price
35,000, tax 6%, rate 7%, term 60, insurance share 1.25, lease 450 / 3,000 / 36 months / 12,000 miles / 0.25, upkeep rise 10%
(contrasts: A3, a blank new mpg or upkeep keeps the old car's; C4's first half, no refinance unless its rate and years are
typed). **E1** (the key's correction of D1 after the fourth revision's comparison): on an electric first car a blank new mpg
leaves the new car charged like the car (contrast: 32 mpg at the fuel price the electric car carries).

**The key's own conventions where the pages say nothing** (those the pages have since stated say so)**:** A2 lease running
costs are the new car's (now V2); A3 blank new mpg / maintenance keep the old car's (now D1's contrast); A4 registration
unchanged; A5 a positive trade-in is credited on the lease (revised;
contrast: the brief's no credit); A6 keep's back is the value less what the old loan still owes (revised; contrast: the
brief's); A7 a negative financed amount is 0, the excess is cash back (now stated, the same); A8 interest = sum of monthly
interest; A9 whole years, ties keep / buy / lease (the cheapest now by the $1 walk); A10 per mile blank at 0 miles. B1 blank date: no save-up way; B2 amount = max(0, total - set aside);
B3 give order ties; B4 a goal not done that gives all is paused; B5 need = amount - spare literally (now the contrast: a
spare below 0 counts as 0); B6 arrival dates by
`add_months`; B7 never = none, cap 1,200 months; B8 earned with the set-aside money counted up to the total (revised); B9
deferred-interest contrast by simple monthly interest. C1 closing costs 3% of mortgage + cost (revised; contrast: of the new
loan); C4 refinance only with rate and years (now D1's contrast: blanks take 6.5% / 30) and R4; C5 the line as a
level-payment loan, borrowable at least 0 (revised);
C6 no home: no line or refinance; C8 the limit share by principal at the start; C9 mortgage payment is principal and
interest.

## 8. Worked examples (invented people; asserted by `rules.py`)

All amounts in dollars; today is 2026-10-31. Recomputed on 2026-10-31 for the pages' stated conventions (V1, V2, P1-P3,
R1-R5). The fourth revision (L1, A7, A9, B5, D1) changes none of those figures (nothing is blank, no spare is below 0, the
kitchen is under the limit); its own examples close each subsection. `rules.py` (`worked_examples`) and derivation 2 (`pg_key.py`, `check_examples`) assert every figure in bold.

### 8.1 Ana's sedan and hatchback

**Sedan:** worth 18,000, 12,000 miles a year at 30 mpg, fuel 3.50, insurance 1,500, upkeep 800, registration 200, loss blank
(12%), loan 6,000 left at 6% paying 350 a month.

- value lost 18,000 x 0.12 = **2,160.00**; fuel 12,000 / 30 x 3.50 = **1,400.00**;
- loan year at 0.5% a month: month 1 interest 30.00, balance 5,680.00; month 2 interest 28.40, balance 5,358.40; ... month 12
  interest 11.95, balance **2,052.62**; paid 4,200.00, interest **252.62**;
- total 2,160 + 1,400 + 1,500 + 800 + 200 + 252.62 = **6,312.62**; per mile **0.526052**; monthly **526.05**.

**Hatchback (electric):** worth 22,000, 8,000 miles, 0.30 kWh a mile at 0.16, insurance 1,300, upkeep 300, registration 250,
no loan: value lost 2,640; electricity 8,000 x 0.30 x 0.16 = 384; total **4,874.00**; per mile **0.609250**; monthly
**406.17**.

**What-if for the sedan, 5 years (60 months):** new price 32,000, sales tax 8%, 35 mpg, 7% over 60 months, cash down 3,000,
insurance share blank (1.25), new upkeep 300; lease 399 a month, 2,000 due at signing, 36 months, 10,000 miles a year, 0.20
a mile over; upkeep rise blank (10%).

| | Keep | Buy | Lease |
|---|---|---|---|
| Loan | old loan paid off in month 18 (last payment 338.55): **6,288.55** | trade-in 18,000 - 6,000 = 12,000; financed 32,000 x 1.08 - 12,000 - 3,000 = **19,560**; payment 19,560 x (0.07/12) / (1 - 0.705405037910) = **387.31**; 60 payments **23,238.69**; owed at the end 0 | leases ceil(60/36) = 2: due **4,000**; payments 399 x 60 = **23,940**; over-miles 2,000 x 5 x 0.20 = **2,000** |
| Running, year 1 | 1,400 + 1,500 + 200 + 800 = 3,900 | 1,200 + 1,875 + 200 + 300 = 3,575 | 1,200 + 1,875 + 200 + 150 = 3,425 |
| Running, 5 years | V1: 3,100 x 5 + 800 x 6.1051 = **20,384.08** | V2: 3,575 x 5 = **17,875.00** | V2: 3,425 x 5 = **17,125.00** |
| Trade-in credited (A5) | | | the 12,000 equity: **-12,000** |
| Paid | 6,288.55 + 20,384.08 = **26,672.63** | 3,000 + 23,238.69 + 17,875 = **44,113.69** | 4,000 + 23,940 + 2,000 + 17,125 - 12,000 = **35,065.00** |
| Back | 18,000 x 0.88^5 (0.5277319168) = **9,499.17** - 0 still owed | 32,000 x 0.8 x 0.85^4 (0.52200625) = **13,363.36** - 0 | 0 |
| Cost | **17,173.45** (exactly 17,173.4534; the rounded parts give 17,173.46) | **30,750.33** | **35,065.00** |
| Monthly | **286.22** | **512.51** | **584.42** |

Keep's running costs by year (V1, only the upkeep rising): **3,900.00, 3,980.00, 4,068.00, 4,164.80, 4,271.28**; buy
**3,575.00** and lease **3,425.00** every year (V2). Cheapest: **keep**. The old loan is paid off in month 18, so Keep owes
nothing at the end (A6 takes 0 off). Contrasts: every running cost rising (A1, the key's first reading): keep **20,599.26**,
buy **34,701.06**, lease **38,849.97** (their year-4 running costs 4,758.33 and 4,558.68 are exactly 4,758.325 and 4,558.675);
Keep's rule (the upkeep rising) on the new car: buy **31,081.86**, lease **35,230.77** (exactly 35,230.765); the lease with
the old car's running costs (1,400 + 1,500 + 200 + 400 = 3,500 a year, flat) **35,440.00**; the lease without the 12,000
equity (the brief's) **47,065.00**; buy with the tax on 32,000 - 18,000 only (1,120 instead of 2,560): financed **18,120**,
payment **358.80**, cost **29,039.50**; the new car loses **0.582395** of its price in 5 years (sources say "around 60%").
Over **one** year (`veh-0002`) every reading gives year 1 at today's figures, and the old loan still owes **2,052.62** at the
end: Keep pays 4,200 + 3,900 = **8,100** and gets back 15,840 - 2,052.62 = **13,787.38**, a cost of **-5,687.38** (the brief's
**-7,740.00**). Keep is the cheapest by the walk (A9) and by the lowest (the contrast).

**Blank new mpg and upkeep (D1, `veh-0025`):** the 5-year what-if with the new mpg and the new upkeep blank takes 32 mpg and
$500. Buy's year is 12,000 / 32 x 3.50 + 1,875 + 200 + 500 = 1,312.50 + 2,575 = **3,887.50**, five years **19,437.50**,
cost 30,750.33 + 19,437.50 - 17,875 = **32,312.83**; the lease's year 1,312.50 + 1,875 + 200 + 250 = 3,637.50, five years
**18,187.50**, cost **36,127.50**. The contrast (A3: the sedan's 1,400 and 800 kept, 4,275 and 3,875 a year): buy
**34,250.33**, lease **37,315.00**. Keep stays the cheapest. With every what-if field blank but the 5 years (`veh-0026`):
35,000 x 1.06 - 12,000 = 25,100 financed at 7% over 60 months (497.01 a month), two leases of 3,000 due and 450 a month
(no miles over 12,000), buy 34,641.93, lease 39,187.50.

**An electric first car with a blank new mpg (E1, `veh-0007`):** Ana's hatchback (carrying a 3.50 fuel price) over 6 years
against the sedan's what-if with the new mpg blank. The new car is charged like the hatchback, 8,000 x 0.30 x 0.16 = 384 a
year: buy runs 6 x (384 + 1,300 x 1.25 + 250 + 300) = **15,354.00** and costs **18,353.11**; the lease runs 6 x (384 + 1,625
+ 250 + 150) = **14,454.00** and costs **25,182.00**; keep costs **3,701.79** and is the cheapest. The contrast (32 mpg at
3.50, 875 a year): buy **21,299.11**, lease **28,128.00**. A3 equals E1 here (the new upkeep is typed).

**Cash back (A7, `veh-0027`, `-0028`):** the sedan without its loan, worth 40,000, against a 24,000 car at 6% (25,440 with
the tax). With 3,000 down the cash back is 40,000 + 3,000 - 25,440 = **17,560** (nothing financed, no payment); with none,
**14,560**. Paid = 3,000 - 17,560 + 17,875 = **3,315**, and 0 - 14,560 + 17,875 = **3,315**: with cash back the cash down
comes straight back. Back = 24,000 x 0.8 x 0.85^4 = **10,022.52**; buy costs **-6,707.52**, keep 20,384.08 - 40,000 x
0.88^5 (21,109.28) = **-725.20**, lease 4,000 + 23,940 + 2,000 + 17,125 - 40,000 = **7,065.00**: buy is the cheapest.

**The $1 margin (A9, `veh-0032`):** a wagon worth 5,000, no loan, 12,000 miles at 20 mpg and 3.50 (2,100 of fuel), insurance
1,000, upkeep 1,500, registration 100, kept one year: paid 4,700, back 4,400, cost **300.00**. A 15,000 car (no tax) at 0%
over 12 months, 40 mpg (1,050), insurance share 1.00, upkeep 149.60: financed 10,000, paid 10,000 + 2,299.60, back 12,000,
cost **299.60**. The lease (450 a month, 3,000 due, the 5,000 equity credited) costs **5,624.80**. Buy is 0.40 below keep,
not more than $1, so **keep** stays the cheapest; the lowest (the contrast) is buy.

### 8.2 Ben's sofa

A 3,000 sofa with 6% sales tax (total **3,180**) wanted on 2027-06-30: **7** whole months by W2 (P1: the 30th is before
today's 31st; W1 would say 8, W3 8), 1,000 set aside, cash return 4% (i = 1/300). Inputs: spare 80, usable cash 6,000,
emergency target 5,000.

- **Save up:** (1 + i)^7 = 1.023567967293; m = (3,180 - 1,023.567967) x (1/300) / 0.023567967293 = 7.18810678 /
  0.023567967293 = **304.99** (304.994771); earned = 3,180 - 1,000 - 2,134.96 = **45.04**. (By W1's 8 months, the contrast:
  m **266.00**, earned **51.97**.)
- **Finance** 2,180 at 0% for 12 months, then 24.99% (r = 0.020825), 24 months in all: (1 + r)^-12 = 0.780880236814; the
  annuity factor (1 - 0.780880236814) / 0.020825 = 10.5219574159; p = 2,180 / (12 + 10.5219574159) = **96.79** (96.7944286);
  interest 96.7944286 x 24 - 2,180 = **143.07**. The balance after the 12 free months is **1,018.47**; month 13 adds 21.21 of
  interest (942.88 after the payment) and month 24 ends at exactly 0. For comparison: 24.99% from the start **116.34** a month
  (interest **612.14**); all 0%: **90.83**. Contrast: under a deferred-interest plan the 1,018.47 left would bring back about
  **411.74** of interest.
- **Pay cash (P3):** amount 3,180 - 1,000 = 2,180; after = 6,000 - 2,180 = **3,820**; 6,000 >= 2,180: **fits**. The contrast
  (what is left at least the emergency target, the key's first reading): 3,820 is below 5,000, so it would not.
- With 4,000 set aside instead (more than the total): save 0 a month, earned **0** (B8), nothing to finance.
- **Goals** (growth 4% a year unless said): Holiday, priority 3, due 2027-12-31, target 2,000, set aside 400, 150 a month;
  Car fund, priority 2, due 2029-12-31, target 10,000, set aside 2,500, 200 a month; Rainy-day top-up, priority 1, due
  2028-06-30, target 5,000, set aside 3,000, 100 a month, growth 0. None is done, so P2 changes nothing here.

| | Need | Holiday (p3) | Car fund (p2) | Top-up (p1) |
|---|---|---|---|---|
| Before | | 11 months (1,936.24 after 10, 2,092.69 after 11): 2027-09-30, on time | 35 months (9,987.13 after 34, 10,220.42 after 35): 2029-09-30, on time | 20 months (exactly 5,000 at 20) |
| Save up (304.99 > 80) | **224.99** | gives 150: **paused** (growth alone: **484** months) | gives **74.99** -> **125.01** a month: **52** months (**9,899.08** after 51, **10,057.08** after 52), **2031-02-28**, late, **17** months later | gives 0 |
| Finance (96.79 > 80) | **16.79** | gives 16.79 -> 133.21: **12** months (1,904.84 after 11, 2,044.40 after 12), 2027-10-31 | gives 0 | gives 0 |

Nothing is left uncovered in either way (no "more than you have"). By W1 (the contrast) the save-up need would be 186.00 and
the Car fund would give 36.00 (41 months).

**A goal already done (P2, `pur-0020`):** Gift fund, priority 3, due 2027-06-30, target 1,000, set aside 1,500 (done), 50 a
month, growth 1%, with the Car fund above. Save up needs 224.99: the Gift fund is skipped; the Car fund gives its whole 200
and is **paused**; **24.99** a month is more than you have. The contrast (the done goal gives too): Gift fund **50.00**
(paused), Car fund **174.99** -> 25.01 a month (169 months), nothing uncovered. Finance needs 16.79: the Car fund gives
**16.79** (183.21 a month: **37** months, 2 later); the contrast takes the **16.79** from the Gift fund.

**A spare below 0 (B5, `pur-0033`):** the sofa with spare -150, counted as 0. Save up needs the whole **304.99**: the Holiday
gives 150 (paused) and the Car fund **154.99**, leaving **45.01** a month (**116** months). Finance needs **96.79**, all from
the Holiday (**53.21** a month, **29** months). Taken literally (the contrast) the needs would be **454.99** (every goal gives
all it saves, 450, and **4.99** is more than you have) and **246.79** (the Holiday 150, the Car fund 96.79). With 4,000 set
aside (`pur-0034`) nothing is needed in either way, while the literal reading would still take **150** a month from the
goals.

### 8.3 Cy and Dee's kitchen

A 30,000 kitchen, recoup 70%, on a 380,000 home with 265,000 left on the mortgage at 3.5% paying 1,437 a month; line blank
(8%, 10 years); refinance at 6.25% over 30 years, costs blank (3%); personal loan blank (12%, 5 years). Inputs: usable cash
40,000, plan return 5%, top rate 24%, itemizes yes, essential spending 4,000 a month; not married filing separately (L =
750,000). Value added **21,000**; equity change **-9,000**.

| Way | Payment | Interest | PV of payments at 5% | Before tax | Tax saved (R1) | PV of the tax saved (R2) | Today's money (R2) | Fits (R4) |
|---|---|---|---|---|---|---|---|---|
| Cash | | 0 | | 0 | 0 | 0 | **0** | 40,000 >= 30,000: yes; cushion **10,000** = **2.5** months |
| Line | 30,000 at 8%/120: **363.98** (363.98278307) | **13,677.93** | 363.98278307 x 94.28135033 = **34,316.79** | **4,316.79** | 295,000 is under L: 13,677.93 x 1 x 0.24 = **3,282.70** | PVI 11,511.4354 x 1 x 0.24 = **2,762.74** | **1,554.04** (exactly 1,554.0438) | borrowable 380,000 x 0.85 - 265,000 = **58,000**: yes |
| Refinance | new loan 295,000 x 1.03 = **303,850** (closing **8,850**) at 6.25%/360: **1,870.86**; change **+433.86** | new **369,658.42** - old **115,861.11** = **253,797.31** extra | new **348,506.21**; old (266 payments, last 56.11) **230,312.77** | **88,193.44** | (369,658.42 x 295,000/303,850 - 115,861.11 x 1) x 0.24 = **58,327.33** | PVI new **223,281.07**, old **80,936.87**: (223,281.07 x 100/103 - 80,936.87) x 0.24 = **32,601.81** | **55,591.64** (exactly 55,591.6357) | 303,850 / 380,000 = 0.799605, at most 80%: yes |
| Personal loan | 30,000 at 12%/60: **667.33** | **10,040.01** | 667.3334 x 52.99070632 = 35,362.47 | 5,362.47 | 0 | 0 | **5,362.47** | always |

Ranking (R5): the walk starts at cash (0); the line (1,554.04), the refinance and the loan are not lower, so the best is
**cash**; of the rest the line, then the loan, then the refinance: **cash, line, loan, refi** (the same before tax and sorted
plainly). With usable cash 25,000 and no itemizing: cash does not fit (cushion -5,000), no tax is saved, today's money is the
before-tax figure (line 4,316.79), and the ranking is line, loan, refi. On a 330,000 home the line could borrow 15,500 (it does
not fit) and the refinance's 303,850 is 0.92 of the value (it does not fit either): cash, loan. On a 300,000 home, 300,000 x
0.85 is below the mortgage: what could be borrowed is **0**.

**No mortgage (R3):** the same kitchen on a home owned outright: the line can borrow 380,000 x 0.85 = **323,000**; there is no
refinance; ranking **cash, line, loan**. The contrast (C6, an old side of 0): a new loan of **30,900** at **190.26** a month,
today's money 5,441.31 before tax and **150.46** after (PVI 22,706.55 x 100/103 x 0.24 = 5,290.85), which fits and would rank
**cash, refi, line, loan**.

**The $1 margin (R5, `ren-0014`):** a 2,000 project, recoup 1.5, no itemizing, plan return 8.01% against the line's 8%: the
line's today's money is **-0.87** (-0.870759), not more than $1 below cash's 0, so **cash** stays best (ranking cash, line,
loan, refi); sorted plainly (the contrast) the line would be first: **line, cash, loan, refi**.

Contrasts: the 3% read as a share of the new loan gives a new loan of 295,000 / 0.97 = **304,123.71** (closing **9,123.71**),
payment **1,872.54**, today's money 88,507.38 before tax and **55,905.57** after. The new loan is **0.799605** of the home's
value with the key's reading (just under the 80% cash-out limit: it fits) and **0.800326** with the other (just above it: it
would not): the reading decides whether such a refinance fits. Tax on the refinance: on the extra interest (C2, the key's first
main reading) **60,911.35**, on all its new interest **88,718.02**; the main R1 figure 58,327.33 is the same with either 3%
reading (the deductible part is the interest on the 295,000). The line's combined loan-to-value after borrowing is
**0.776316**; with no limit its tax saved is the same 3,282.70. The mortgage's interest over the line's 120 months is
77,188.86 (`line_mortgage_interest_in_term`); 295,000 is under L, so the line takes none of its deduction (L1 = R1).

**The line over the limit (L1, `ren-0008`, section 5.5):** M 900,000 at 4% paying 5,000, C 120,000 (line 8%, 10 years), L
750,000, top 24%, plan return 5%. The line's interest is **54,711.74**, the mortgage's over the line's 120 months
**305,500.39**. Tax saved = (54,711.74 x 750/1,020 - 305,500.39 x (750/900 - 750/1,020)) x 0.24 = **2,466.77** (R1, the
contrast: **9,655.01**); today's money **14,878.56** (R1: **9,141.43**). Both readings rank cash, line, loan, refi. With
the mortgage under the limit (`ren-0019`: M 700,000 at 5% paying 4,200, C 100,000) the mortgage still loses 1/16 of its
deduction while the line runs: tax saved 5,687.63 against R1's 10,258.45. A mortgage paid off in 60 months, inside the
line's 120 (`ren-0020`, married filing separately), counts its interest until then: 41,996.52.

**A blank refinance rate (D1, `ren-0016`):** the kitchen with the refinance rate blank takes 6.5% over the typed 30 years:
payment **1,920.54** on 303,850; tax saved (R1) **62,494.83**; today's money **97,448.28** before tax and **62,438.67** after;
it fits (0.799605 of the value) and ranks last: **cash, line, loan, refi**. Before D1 the key offered no refinance there:
**cash, line, loan** (the contrast).

## 9. Outputs (suggested columns)

The columns as written on 2026-10-31, fourth revision (README.md lists every column). A blank output means "does not
apply".

- Page A per car: `value_lost`, `fuel`, `insurance`, `maintenance`, `registration`, `loan_interest`, `total`, `per_mile`,
  `monthly`. What-if per way: keep `loan_paid`, `loan_months`, `owed_end`, `running` (V1), `paid`, `back`, `cost`, `monthly`;
  buy `trade_in`, `negative_trade_in_cash`, `financed`, `cash_back` (A7), `payment`, `loan_paid`, `owed_end`, `running`
  (V2), `value_end`, `paid`, `back`, `cost`, `monthly`; lease `leases`, `due_total`, `payments`, `excess_miles_charge`,
  `running` (V2), `paid`, `cost`, `monthly`; `cheapest` (the A9 walk); `lease_trade_in_credited`. Blank inputs take D1's
  defaults (an electric first car's new car charged like the car, E1). Contrasts: `alt_keep_rise_all`, `alt_buy_rise_all`,
  `alt_lease_rise_all` (A1, the key's first reading of what rises), `alt_buy_rise_upkeep_only`,
  `alt_lease_rise_upkeep_only` (Keep's rule on the new car), `alt_lease_old_running` (A2), `alt_lease_equity_not_credited`
  and `alt_keep_owed_end_ignored` (the brief's A5 and A6), `alt_buy_tax_after_trade_in_credit` (TXMV), `new_car_loss_at_end`;
  fourth revision: `alt_cheapest_lowest` (A9's earlier reading), `alt_buy_blank_keeps_old`, `alt_lease_blank_keeps_old`
  (A3, D1's contrast); E1's correction: `alt_buy_electric_new_at_32_mpg`, `alt_lease_electric_new_at_32_mpg` (an electric
  first car's blank new mpg at 32 mpg and the fuel price it carries). Gone: `alt_keep_rise_upkeep_only` (now Keep's main
  figure).
- Page B: `total`, `months` (W2) and `months_w3`, `save_monthly`, `earned`, `amount`, `finance_payment`, `finance_interest`,
  `cash_after`, `cash_fits` (P3); per way and goal: `need` (amount - max(0, spare), B5), `gives`, `monthly_new`, `old_months`,
  `new_months`, `paused`, `shortfall` (done goals skipped, P2). Contrasts: `alt_months_w1`, `alt_save_monthly_w1`, `alt_save_earned_w1` (P1's
  contrast); `alt_save_giving_done_goals_give`, `alt_save_uncovered_done_goals_give`, `alt_finance_giving_done_goals_give`,
  `alt_finance_uncovered_done_goals_give` (P2's); `alt_cash_fits_keeps_emergency_target` (P3's); `alt_level_payment`,
  `alt_level_interest`, `alt_all_zero_payment`, `balance_after_promo`, `deferred_interest_if_not_paid`; fourth revision:
  `alt_save_need_spare_literal`, `alt_save_uncovered_spare_literal`, `alt_finance_need_spare_literal`,
  `alt_finance_uncovered_spare_literal` (B5's earlier reading). Gone: `months_w2` (now `months`).
- Page C: `value_added`, `equity_change`; per way `payment`, `interest`, `pv_payments`, `todays_money` (after tax, R2; the
  line's by L1), `tax_saved` (the line's by L1, the refinance's by R1), `fits` (R4); `borrowable`, `cushion`,
  `cushion_months`; `line_mortgage_interest_in_term` (L1); refinance (blank without a mortgage, R3; a blank rate or years
  6.5% / 30, D1) `new_loan`, `closing_costs`, `payment_change`, `old_months_left`, `extra_interest`, `pv_new`, `pv_old`;
  `ranking` and `best` (R5). Contrasts and law: `cltv_after`, `ltv_after`, `above_fha_cash_out_limit`, `line_law_share`,
  `refi_law_share`, `tax_saved_whole_new_interest`, `alt_cost_of_new_loan` (the `alt_refi_*` columns, after tax),
  `alt_line_tax_saved_no_limit`, `alt_refi_tax_saved_extra_interest` (R1's), `alt_line_todays_money_before_tax`,
  `alt_refi_todays_money_before_tax` (R2's), `alt_refi_no_mortgage_monthly`, `alt_refi_no_mortgage_todays_money`,
  `alt_refi_no_mortgage_fits`, `alt_ranking_refi_no_mortgage` (R3's), `alt_ranking_lowest_first` (R5's),
  `alt_ranking_before_tax`; fourth revision: `alt_line_tax_saved_r1`, `alt_line_todays_money_r1`, `alt_ranking_line_r1`
  (L1's: R1's line figure), `alt_ranking_blank_refi_not_offered` (D1's: C4's first half). Gone: `line_law_tax_saved` and
  `refi_law_tax_saved` (second revision), `line_law_tax_saved_table1` and `line_law_todays_money_table1` (fourth revision:
  now the main `line_tax_saved` and `line_todays_money`).

## 10. Not verified, open points, findings

- **Not verified on an official source:** the 85% line limit (a page convention; CFPBHL gives no percentage, OCC34 sets none);
  new-car depreciation 20% then 15% (a page convention matching RAMSEY years 1-4; no official average exists); the used-car
  12%, insurance 1.25, upkeep rise 10%, lease upkeep halved, line 8% / 10 years and loan 12% / 5 years (page conventions);
  Fannie Mae's cash-out limit (matrix not readable; HUD1911's FHA 80% is cited instead); the $1 margins of R5 and A9 (page
  conventions); D1's defaults (new mpg 32, upkeep $500, new price 35,000, tax 6%, rate 7%, term 60, the lease's 450 / 3,000 /
  36 / 12,000 / 0.25, the refinance's 6.5% over 30 years): page conventions, no source sought.
- **Stated by the pages on 2026-10-31, now the main readings** (each earlier reading of the key is its `alt_*` column): V1, V2
  (what rises), P1 (W2), P2 (done goals skipped), P3 (pay cash fits when the usable cash covers the amount), R1 (tax within the
  limits), R2 (today's money after tax), R3 (no refinance without a mortgage), R5 (the $1 walk); and with the fourth revision
  L1 (the line by P936 Table 1), A7 (cash back), A9 (the cheapest by a $1 walk), B5 (a spare below 0 counts as 0), D1 (the
  defaults for blank inputs). **One discrepancy in the
  note that came with them:** P3 was called "already the key's main"; the amount and what is left were, but the key's fit
  tested what is left against the emergency target. The key now follows P3's formula and keeps its test as
  `alt_cash_fits_keeps_emergency_target` (they differ in the rows where what is left is between 0 and the target).
- **What the page does where the brief leaves room and the pages said nothing new** (the independence rule forbids reading
  its code): A4, A8, A10, B3, B4 (for goals not done), B6 to B9, C1 (the page's reading adopted), C5, C8, C9. Each has its
  contrast column or note so a mismatch can be placed.
- **Open points of the fourth revision.** (1) and (2), an electric first car with a blank new mpg, are settled by E1
  (section 3.4): the new car is charged like the car, as the page does; the doubt raised here ("the same kind of car") was
  the page's reading. Every electric first car in the rows still carries a fuel price (drawn from a second random stream,
  so no other draw moved); only E1's contrast (32 mpg at that price) uses it, and it changes the cheapest in 9 of the 96. A
  finding for the owner from the comparison (not a figure the key checks): the page charges an electric household's new car
  like the car whatever the new mpg box says, so the box (shown as 32 when blank) does nothing there; a typed new mpg on an
  electric first car, which no row has, would be priced by petrol in the key (A3's typed case) and by the car's kWh on the
  page. (3) L1 steps the mortgage only
  when it has a payment; a balance with no payment (no row has one) adds no interest. (4) A7 with cash back makes the cost
  independent of the cash down (it comes straight back), as the formula says (8.1).
- **Doubts for the owner:** Keep's upkeep rises while the new car's running costs stay flat (V1 against V2), which leans the
  comparison toward buying or leasing (3.3; the cheapest changes in 36 rows under A1); a home owned outright gets no
  refinance (R3), while a cash-out first mortgage would be possible (the contrast fits in 233 of 239 such homes).
- **Findings to confirm against the page (from the brief's wording):** the lease row drops a positive trade-in's equity
  (12,000 in 8.1, making the lease look 12,000 dearer than it is; credited by the key, A5, and stated by the page, V3); keep
  ignores an old loan still owed at the end (taken off, A6, V3); the promo is modelled as a true 0% period, while store "no
  interest if paid in full" offers charge the interest back (CFPBDI); the full new price is taxed although many states tax
  only the price less the trade-in (TXMV). The earlier findings on the refinance's tax (closing-cost interest counted, no
  $750,000 limit) and on the refinance's fit (80% cash-out limit) are now the pages' stated conventions (R1, R4).
- **Finding of the third revision, settled in the fourth:** the line's tax saved by R1 left out that the limit's share also
  cuts the mortgage's own deduction once the home debt is over L (P936 Table 1, section 5.5). The page now states L1, which
  is that law figure, and it is the main column; R1's figure is the contrast `alt_line_tax_saved_r1` (in 147 of the 149
  capped rows it is higher: 1,124,114.99 against L1's 504,306.40 in all; the best differs in 5 rows).
- **Not modelled:** points and their deduction (P936), the car-loan interest deduction of 163(h)(4) (2025-2028), the tax
  saving's timing beyond discounting it with the month's interest (R2) and the standard-deduction offset, variable line rates
  and interest-only draw periods, mortgage insurance premiums ((h)(3)(F)(i)(III), added by Pub. L. 119-21; its effective date
  was not checked), state taxes, and the Publication 936 Table 1 average-balance method (the key's limit share uses principal
  at the start).
- The **2026** Publication 936 is not published yet; the 2025 edition is applied, and 163(h)(3) as amended by Pub. L. 119-21
  (no end date) confirms the same rules for 2026.

## 11. Compared with the pages (2026-10-31)

The test `tests/golden-property-goals.test.mjs` runs the three pages' `compute()` on every row. The first run (with the
first readings above) left 7,735 row-parts apart by thirteen causes. Each was weighed against the pages' README, their
screens (`view.js`) and the sources:

- **The key was wrong, revised here:** C1 (the brief does not say what the 3% is a share of; the page's 3% of mortgage + cost
  is as good a reading), B8 (a negative "earned" when more than the total is set aside), 5.2 (a negative "could be
  borrowed"), and C4 (the brief's "always fits" let a refinance of more than the home's value fit; the page tests a limit,
  and HUD1911 gives the cash-out one).
- **The key now holds the like-for-like figure where the page is wrong:** A5 (the lease drops the old car's equity) and A6
  (Keep leaves in what the old loan still owes); the page matched the brief's figures, which are kept as contrasts.
- **The page is wrong, the key unchanged:** Pay cash takes the whole total from usable cash, not the total less what is set
  aside (4.4, the page's README says the latter); the refinance's tax saved is floored at 0 (C2), so a refinance that cuts
  the interest gives up a deduction the page does not count; the refinance fits by the line's 85% combined limit without its
  closing costs, not by the 80% cash-out limit (C4).
- **Conventions the page states, for the owner:** what rises on Keep, Buy and Lease (A1: the page raises only the kept car's
  upkeep, as its screen says), whole months (W1 against the app's W2), a done goal giving way (B4: the page's README says done
  goals are never touched), today's money before or after the tax saved (C3: the page's is after it), and a refinance on a
  home without a mortgage (C6: the page's README offers none).

**Second revision, 2026-10-31: the pages' stated conventions are the main columns.** The brief said the main columns check
each page's own model exactly and put other readings, the law and doubts in contrast columns; the comparison above showed
places where the main column held the key's own reading instead of the page's stated one. The pages' conventions were then
given to the key, and the pages now do exactly these (V1 to V3, P1 to P3, R1 to R5, section 7). What changed in the key:

| Rule | Main column now | The key's earlier main, now the contrast |
|---|---|---|
| V1 | Keep: only the upkeep rises (`keep_running`, `keep_cost`) | every running cost rises: `alt_keep_rise_all` |
| V2 | Buy and Lease flat (`buy_running`, `lease_running`, costs) | every running cost rises: `alt_buy_rise_all`, `alt_lease_rise_all` (and Keep's rule: `alt_*_rise_upkeep_only`) |
| V3 | unchanged (A6, A5 already main) | `alt_keep_owed_end_ignored`, `alt_lease_equity_not_credited` |
| P1 | `months` = W2, and every save-up figure from it | `alt_months_w1`, `alt_save_monthly_w1`, `alt_save_earned_w1` |
| P2 | done goals skipped in `*_giving`, `*_uncovered` | `alt_*_giving_done_goals_give`, `alt_*_uncovered_done_goals_give` |
| P3 | `cash_fits` = usable cash >= amount | `alt_cash_fits_keeps_emergency_target` |
| R1 | `line_tax_saved`, `refi_tax_saved` within L, closing costs out | `alt_line_tax_saved_no_limit`, `alt_refi_tax_saved_extra_interest` |
| R2 | `*_todays_money` after the tax saved | `alt_line_todays_money_before_tax`, `alt_refi_todays_money_before_tax` |
| R3 | no refinance without a mortgage (refi columns blank, not ranked) | `alt_refi_no_mortgage_*`, `alt_ranking_refi_no_mortgage` |
| R4 | unchanged (C4 and the line's 85% already main) | |
| R5 | `ranking` / `best` by the $1 walk | `alt_ranking_lowest_first` (and `alt_ranking_before_tax`) |

The first-run causes "Pay cash takes the whole total" and "the refinance fits by the 85% limit" are settled by P3 and R4 as
the pages now do them, and "the refinance's tax saved is floored at 0" by R1 (no floor). The edge row `ren-0014` changed:
the exact tie of the line with cash (C7) became, after tax, a line well below cash, so the row now pins R5's margin
instead (no itemizing, the line 0.87 below cash). Both derivations were changed, each its own way (`rules.py` steps every
loan's interest month by month; `pg_key.py` uses closed forms), and agree on every value.

**Third revision, 2026-10-31 (a verifier's review).** Against the second revision every row of every part agreed with the
pages. The verifier then checked the key against the sources and found two things:

- **R1 is not the whole law for the line.** P936 Table 1 puts the limit's share on all the home's interest (section 5.5).
  Two law columns were added in both derivations: `line_law_tax_saved_table1` and `line_law_todays_money_table1`. `rules.py`
  steps the mortgage over the line's months and sums each month's interest and its PV. `pg_key.py` uses its closed-form loan
  with the line's months as the limit, plus the closed-form interest PV. One new deliberate mistake keeps the mortgage's
  whole deduction (`line_law_mortgage_kept`); the row guard refuses it at `ren-0008`. No main column changed. The page's
  stated R1 stays the main reading, and the difference is a finding for the owner (section 10).
- **Section 4.4's reason for P3 was a wrong guess about the app.** The usable cash includes the emergency fund. The text
  was corrected; no figure changed.

**Fourth revision, 2026-10-31: more of the pages' stated conventions.** The pages now state five more conventions ("each is
the page's stated convention"); each is the key's main reading in both derivations, and the key's earlier main reading is
kept as an `alt_*` column where it differs:

| Rule | Main column now | The key's earlier main, now the contrast |
|---|---|---|
| L1 | `line_tax_saved`, `line_todays_money` by P936 Table 1 (the third revision's law columns), so `ranking` and `best` too; `line_mortgage_interest_in_term` added | R1's line figure: `alt_line_tax_saved_r1`, `alt_line_todays_money_r1`, `alt_ranking_line_r1` |
| A7 | `cash_back`, `financed`, `buy_paid` (the key's formula already; now exercised: `veh-0027` to `-0031`) | none (no difference) |
| A9 | `cheapest` by the walk keep, buy, lease with a $1 margin | `alt_cheapest_lowest` (the lowest, ties keep / buy / lease) |
| B5 | `save_need`, `finance_need` (and what gives and what is uncovered) with a spare below 0 counted as 0 | `alt_save_need_spare_literal`, `alt_save_uncovered_spare_literal`, `alt_finance_need_spare_literal`, `alt_finance_uncovered_spare_literal` |
| D1 | blank what-if, refinance, line and loan inputs take the pages' defaults (a blank refinance rate or years 6.5% / 30, a blank new mpg 32, a blank new upkeep $500, ...) | A3: `alt_buy_blank_keeps_old`, `alt_lease_blank_keeps_old`; C4's first half: `alt_ranking_blank_refi_not_offered` |

Gone: `line_law_tax_saved_table1` and `line_law_todays_money_table1` (they would equal the main line columns). Edge rows
added at the end of each file's edges: `veh-0025` to `-0032` (D1: a blank new mpg and upkeep, every what-if field blank;
A7: five cars worth more than, or as much as, the new car with its tax, with and without cash down; A9: buy 0.40 below
keep), `pur-0033` to `-0035` (B5: spare -150 and -200) and `ren-0016` to `-0020` (D1: the refinance rate, years or both
blank; L1: a mortgage under the limit that the line takes over it, and a mortgage paid off inside the line's term). The
electric first car of `veh-0007` and of the random rows now carries a fuel price (section 10). The random rows are the same
draws as in the third revision: each file draws as many as it did then and keeps the first that fit after its edges, so
every earlier random row but the last 8, 3 and 5 draws is found again by its inputs (its id moved by the number of edges
added). Matched that way against the third revision, nothing else changed: in vehicles.csv only the 96 electric-first-car
rows (their buy and lease running costs and costs; the cheapest in 9), in purchases.csv nothing, in renovations.csv only
the line's tax saved and today's money in 145 rows and with them the ranking in 10 and the best in 5. Five new deliberate
mistakes, one per new rule, are each refused (README.md). Both derivations were changed, each its own way, and agree on
every value.

**Corrected 2026-10-31, after the fourth revision's comparison (E1).** The test's first run against the fourth revision
found one cause, 201 row-parts in 96 rows of vehicles.csv (buy 96, lease 96, whatif 9): every electric first car, all with a
blank new mpg (`veh-0007`: buy 18,353.11 on the page, 21,299.11 in the key; lease 25,182.00 and 28,128.00; `veh-0481`: the
cheapest buy on the page, keep in the key). A switched copy of the page's compute (its new car on petrol at the new mpg and
the car's fuel price) gave exactly the page's figures switched off and the key's on every vehicles row switched on. The key
was wrong: D1 gives the box's default, which the page takes (32), but the page charges an electric car by its kWh and does
not compare gas against electric (its README; section 3.4), so the 32 does not enter there. Both derivations were changed,
each its own way (`rules.py`: `_whatif_inputs` charges the new car like an electric first car when its mpg is blank, and
`blanks='petrol32'` gives the contrast; `pg_key.py`: `veh_2` keeps the old car's charging for the new car and builds the
contrast from the new mpg), and agree on every value:

| Rule | Main column now | The fourth revision's main, now the contrast |
|---|---|---|
| E1 | on an electric first car with a blank new mpg, `buy_running`, `buy_paid`, `buy_cost`, `lease_running`, `lease_paid`, `lease_cost` (and their monthly figures, the contrasts built on the new car's running costs, and `cheapest`) with the new car charged like the car | `alt_buy_electric_new_at_32_mpg`, `alt_lease_electric_new_at_32_mpg` |

Nothing else changed: purchases.csv and renovations.csv are byte for byte the fourth revision's, and in vehicles.csv only the
96 electric-first-car rows moved (their main buy and lease figures now equal the fourth revision's A3 contrast, the upkeep
being typed on all of them, and the new contrast equals the fourth revision's main). One new deliberate mistake undoes E1
(`electric_new_at_32_mpg`); the D1 mistake `blank_mpg_keeps_old_fuel` is now refused at the first petrol row with a blank new
mpg (README.md). Against the corrected key every row of every part agrees with the pages.
