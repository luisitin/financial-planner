# Business answer keys: sole proprietor, S corporation, retirement plans

Three independent answer keys for the pages that deal with running a small business:

| Script | Writes | Rows | What it checks |
|---|---|---|---|
| `sole_key.py` | `tests/golden/business/sole.csv` | 2,000 | a sole proprietor (Schedule C) in a household: self-employment tax, the self-employed health insurance deduction, the QBI deduction, AGI, taxable income, the household's income tax with and without the business, and the additional Medicare tax on self-employment income |
| `scorp_key.py` | `tests/golden/business/scorp.csv` | 1,000 | the same household when the business is an S corporation the owner wholly owns: payroll taxes on the owner's salary, the K-1 income, the health insurance deduction, the QBI deduction and the household's income tax with and without the business |
| `plans_key.py` | `tests/golden/business/plans.csv` | 1,000 | the most a self-employed person with no employees can put in a SEP, a solo 401(k) and a SIMPLE IRA for the year |

`rules.py` holds every figure as data, with its source on the same line. `household.py` works the
household's Form 1040 two ways and is shared by the first two keys.
`tests/golden/business/RULES.md` works three rows of each CSV by hand.

**Independence.** These scripts were written from the IRS forms, instructions, publications,
notices and the Code only. Nobody opened `modules/`, `core/` or `tests/*.test.mjs` while writing
them, and they never import or run the app. The only code reused is
`tools/golden_career/rules.py` (an audited key's tables: brackets, standard deductions,
qualified-dividend rate tops, AMT figures). Each script computes every row in two separate ways
(the forms line by line, and the statute written differently) and refuses to write the CSV if the
two disagree by a cent. In fact they agree exactly, before rounding, on every column of every row.

## Run

```
python3 tools/golden_business/sole_key.py
python3 tools/golden_business/scorp_key.py
python3 tools/golden_business/plans_key.py
```

Python 3 standard library only (made with 3.13). Money is `decimal.Decimal`, exact until the CSV,
where it is rounded half-up to cents. The runs are deterministic (`random.Random(20261101)`,
`(20261102)` and `(20261103)`), so running again writes byte-identical files. The scripts set
`sys.dont_write_bytecode`, so no `__pycache__` lands in the repo. Each run prints its coverage.

## Sources (all read on 2026-10-30)

| Tag | Source | URL |
|---|---|---|
| SE25 / SE26 | Schedule SE (Form 1040) 2025; 2026 draft | https://www.irs.gov/pub/irs-pdf/f1040sse.pdf , https://www.irs.gov/pub/irs-dft/f1040sse--dft.pdf |
| SSA26 | SSA 2026 COLA fact sheet (wage bases 2025 and 2026) | https://www.ssa.gov/news/en/cola/factsheets/2026.html |
| P15 | Publication 15 (2026) | https://www.irs.gov/pub/irs-pdf/p15.pdf |
| F1040 | Form 1040 (2025) and its instructions (Qualified Dividends and Capital Gain Tax Worksheet) | https://www.irs.gov/pub/irs-pdf/f1040.pdf , https://www.irs.gov/pub/irs-pdf/i1040gi.pdf |
| S1 | Schedule 1 (Form 1040) 2025 | https://www.irs.gov/pub/irs-pdf/f1040s1.pdf |
| F7206 | Form 7206 (2025) and instructions; 2026 draft | https://www.irs.gov/pub/irs-pdf/f7206.pdf , https://www.irs.gov/pub/irs-pdf/i7206.pdf , https://www.irs.gov/pub/irs-dft/f7206--dft.pdf |
| F8995 | Form 8995 (2025) and instructions | https://www.irs.gov/pub/irs-pdf/f8995.pdf , https://www.irs.gov/pub/irs-pdf/i8995.pdf |
| D8995 | Form 8995 (2026) draft of 2026-05-01 and its draft instructions | https://www.irs.gov/pub/irs-dft/f8995--dft.pdf , https://www.irs.gov/pub/irs-dft/i8995--dft.pdf |
| FAQ199A | IRS section 199A FAQs, Q&A 25 and 39 | https://www.irs.gov/newsroom/tax-cuts-and-jobs-act-provision-11011-section-199a-qualified-business-income-deduction-faqs |
| REG | Treas. Reg. 1.199A-3(b)(1)(vi) | https://www.ecfr.gov/current/title-26/section-1.199A-3 |
| F8959 | Form 8959 (2025) and instructions | https://www.irs.gov/pub/irs-pdf/f8959.pdf |
| F8960 | Form 8960 (2025) and instructions | https://www.irs.gov/pub/irs-pdf/f8960.pdf |
| S8812 | Schedule 8812 (2025) and instructions (Credit Limit Worksheet A, Earned Income Worksheet); 2026 draft | https://www.irs.gov/pub/irs-pdf/f1040s8.pdf , https://www.irs.gov/pub/irs-pdf/i1040s8.pdf , https://www.irs.gov/pub/irs-dft/f1040s8--dft.pdf |
| RP24 / RP25 | Rev. Proc. 2024-40 (2025), Rev. Proc. 2025-32 (2026) | https://www.irs.gov/pub/irs-drop/rp-24-40.pdf , https://www.irs.gov/pub/irs-drop/rp-25-32.pdf |
| N2480 / N2567 | Notice 2024-80 (2025 plan limits), Notice 2025-67 (2026 plan limits) | https://www.irs.gov/pub/irs-drop/n-24-80.pdf , https://www.irs.gov/pub/irs-drop/n-25-67.pdf |
| P560 | Publication 560 (2025), incl. the Deduction Worksheet for Self-Employed | https://www.irs.gov/pub/irs-pdf/p560.pdf |
| SIMPLE | IRS "Retirement topics - SIMPLE IRA contribution limits" (reviewed 2026-03-06) | https://www.irs.gov/retirement-plans/plan-participant-employee/retirement-topics-simple-ira-contribution-limits |
| TD10033 | T.D. 10033, final catch-up contribution regulations (Sept. 2025) | https://public-inspection.federalregister.gov/2025-17865.pdf |
| N0801 | Notice 2008-1 (health insurance of 2% S corporation shareholders) | https://www.irs.gov/pub/irs-drop/n-08-01.pdf |
| IRC | 26 U.S.C. 24, 32, 162, 199A, 401, 402, 408, 414, 415, 1401, 1402 (current text with the 2025 amendment notes) | https://www.law.cornell.edu/uscode/text/26/199A (and /24, /32, /162, /401, ...) |

Plus, through `tools/golden_career/rules.py`: the 2025 and 2026 brackets (RP24 s.2.01, RP25 s.4.01),
standard deductions (OBBBA s.70102, RP25 s.4.14), qualified-dividend rate tops (RP24 s.2.03,
RP25 s.4.03) and the AMT figures (used only by the AMT guard).

## The figures

| | 2025 | 2026 | Source |
|---|---|---|---|
| Social Security wage base | 176,100 | 184,500 | SE25 / SE26 line 7; SSA26; P15 |
| SE tax | 12.4% on net earnings up to (base - W-2 social security wages), 2.9% on all; net earnings = 92.35% of profit; none under $400 of net earnings; half deductible | same | IRC 1401(a), (b)(1), 1402(a)(12), (b)(1), (b)(2), 164(f); SE25 lines 4a-13 |
| FICA on wages | 6.2% employee + 6.2% employer to the base (per employer); 1.45% + 1.45% on all | same | IRC 3101, 3111, 3121(a)(1); P15 |
| Additional Medicare tax | 0.9% over 250,000 joint / 125,000 separate / 200,000 others | same | IRC 3101(b)(2), 1401(b)(2); F8959 |
| Net investment income tax | 3.8% of the smaller of NII and MAGI over the same three thresholds | same | IRC 1411; F8960 |
| Child tax credit | 2,200 per child under 17; refundable part up to 1,700 per child; phase-out 50 per 1,000 or part over 400,000 joint / 200,000 others; ACTC 15% of earned income over 2,500 | 2,200; 1,700; same phase-out | IRC 24(b), (d), (h); OBBBA s.70104; RP24 s.2.05; RP25 s.4.05; S8812 |
| 199A threshold | 197,300 (single, HoH, separate) / 394,600 joint | 201,750 (single, HoH) / 201,775 separate / 403,500 joint | RP24 s.2.27; RP25 s.4.26; F8995 / D8995 headers |
| 199A(i) minimum deduction | none | 400 if QBI from materially participated businesses is at least 1,000 | IRC 199A(i) (OBBBA s.70105(b), from tax years after 2025 by s.70105(c)); RP25 s.2.12; D8995 lines 16-17 |
| 415(c) dollar limit | 70,000 | 72,000 | N2480; N2567; P560 step 8 |
| 401(a)(17) compensation limit | 350,000 | 360,000 | N2480; N2567; P560 step 6 |
| 402(g) elective deferral limit | 23,500 | 24,500 | N2480; N2567; P560 |
| 401(k) catch-up, 50+ / 60-63 | 7,500 / 11,250 | 8,000 / 11,250 | IRC 414(v)(2)(B)(i), (E)(i); N2480; N2567 |
| SIMPLE deferral, 25 or fewer employees (408(p)(2)(E)(i)(I)) | 17,600 (general limit 16,500) | 18,100 (general 17,000) | N2480; N2567; P560 ch. 3 |
| SIMPLE catch-up, 50+ in such a plan / 60-63 | 3,850 / 5,250 (general 50+ limit 3,500) | 3,850 / 5,250 (general 4,000) | IRC 414(v)(2)(B)(iii), (E)(ii); N2480; N2567; TD10033 |
| SIMPLE employer match | dollar for dollar up to 3% of compensation | same | IRC 408(p)(2)(A)(iii); P560 ch. 3 |
| SEP / profit-sharing rate for the owner | 25% of compensation = 20% of net earnings before the contribution | same | IRC 402(h)(2), 404(a)(3); P560 Rate Table for Self-Employed |

`rules.py` cross-checks itself when it loads: 92.35% = 1 - half of 15.3%, the employee and employer
rates add up to the SE rates, 0.25 / 1.25 = 0.20, the 60-63 catch-ups equal the statute's
"greater of $10,000 / $5,000 or 150%" formulas, and the 2025 small-employer SIMPLE amounts equal
110% of the 2024 ones.

## Sole proprietor key (`sole_key.py`)

### Inputs and outputs

Inputs: `case_id, year, filing_status, owner_wages, other_wages, qualified_dividends,
kids_under_17, profit, health_premiums, retirement`. `owner_wages` is the owner's own W-2 pay
(box 1 = box 3 = box 5). `other_wages` is the spouse's W-2 pay (joint returns only). `retirement` is
the owner's deductible SEP contribution for themselves.

Outputs (all money, two decimals):
- `se_tax` Schedule SE line 12; `se_half` line 13 (Schedule 1 line 15).
- `sehi` Form 7206 line 14 (Schedule 1 line 17).
- `qbi` the QBI deduction: Form 8995 line 15 (2025) or line 17 (2026).
- `agi_with` Form 1040 line 11a; `taxable_income_with` line 15.
- `tax_with`, `tax_without`: regular income tax (line 16, with the Qualified Dividends and Capital
  Gain Tax Worksheet) - nonrefundable child tax credit (line 19, never below 0) + net investment
  income tax (Form 8960 line 17) - additional child tax credit (line 28). No self-employment tax, no
  additional Medicare tax. It can be negative. `tax_without` is the same household with no
  business at all (no profit, no SE tax, no health or retirement deduction, no QBI).
- `addl_medicare_se` Form 8959 line 13 only (Part II, the self-employment part).

### Derivation 1 (the forms)

1. Schedule SE: line 2 = profit; line 4a = 92.35% of a profit (a loss as it is); stop with no SE tax
   if line 4c is under $400; line 9 = 176,100 / 184,500 - the owner's box 3 wages (not the
   spouse's), floor 0; line 10 = 12.4% x the smaller of lines 6 and 9; line 11 = 2.9% x line 6;
   line 13 = half of line 12.
2. Form 7206: line 4 = profit; lines 5-6 = 100% (one business); line 7 = Schedule 1 line 15;
   line 9 = the SEP contribution; line 14 = the smaller of the premiums and line 10. Only when there
   is a profit.
3. Form 8995 line 1(c), QBI = profit - SE tax deduction - SEHI - SEP contribution (all attributable
   to the one business). Line 4 floors it at 0, line 5 = 20%. Line 11 = AGI - standard deduction.
   Line 12 = qualified dividends. Line 14 = 20% x (line 11 - line 12, floor 0). Line 15 = the
   smaller. 2026: line 16 = 400 when line 1(c) is at least 1,000, line 17 = the larger.
4. Form 1040: line 1z = both spouses' wages; line 3b = dividends (all qualified); Schedule 1 line 3
   = profit; Schedule 1 lines 15-17; line 11a AGI; line 12e standard deduction; line 13a = the QBI
   deduction; line 15 = max(0, AGI - 12e - 13a); line 16 by the worksheet (exact formula, no Tax
   Table, as in `tests/golden/taxes/`).
5. Schedule 8812: lines 1-14 with the phase-out rounded up to the next 1,000 and Credit Limit
   Worksheet A = line 18 (no other credits); Part II-A lines 16a-20 and 27 with line 18a from the
   Earned Income Worksheet: wages + Schedule C line 31 (0 if the two total 0 or less) - Schedule 1
   line 15. (The worksheet uses the whole profit, also when net earnings are under $400.)
6. Form 8960 lines 2-17 on the dividends, MAGI = AGI.
7. Form 8959 Part II: line 8 = Schedule SE line 6 (0 when SE stopped at line 4c), line 11 =
   threshold - both spouses' Medicare wages (floor 0), line 13 = 0.9% x (line 8 - line 11, floor 0).

### Derivation 2 (the statute), checked on every row

- Net earnings = profit - 7.65% x profit (IRC 1402(a)(12) written as a deduction, not 92.35%);
  1402(b)(1) and (b)(2) for the wage base and the $400 floor; 1401(a), (b)(1); 164(f).
- SEHI by 162(l)(2)(A) with 401(c)(2) earned income (net earnings "with regard to" the 404 and
  164(f) deductions): min(premiums, profit - half SE tax - SEP).
- Additional Medicare by 1401(b)(2) written as the increase over the tax on wages alone:
  0.9% x (max(0, wages + SE income - threshold) - max(0, wages - threshold)).
- QBI by Treas. Reg. 1.199A-3(b)(1)(vi) as profit minus the attributable deductions times their
  proportion (100%); the deduction by 199A(a), (b)(2)(A), (b)(3)(A), (e)(1) and (i)(1).
- AGI and taxable income by IRC 61-63; tax by the Rev. Proc. "base plus rate" tables with IRC
  1(h)(1)(A)-(D) stacking capped at the tax on all income; the credit by IRC 24(b)(1) with the
  $1,000 steps counted in whole cents, 24(b)(3), (d)(1), (h)(5), (h)(6); earned income by 32(c)(2)(A)
  (wages + profit - the 164(f) deduction); NIIT by 1411(a)(1).

### The generator

- 250 rows for each year (2025, 2026) and status (single, married_joint, married_separate,
  head_of_household). Case ids are `sole-<year>-<status>-<nnn>`. Inputs are whole dollars except a
  `retirement` set exactly at the SEP maximum (to the cent, rounded down).
- Owner wages: 25% are 0, 5% exactly the wage base, 8% above it, 12% within 30,000 under it, the rest
  log-uniform or uniform from 1,000 to 170,000. Spouse wages: 0 in 30% of joint rows, else up to 250,000.
- Qualified dividends: 0 in half the rows, otherwise mostly log-uniform 10 to 60,000.
- Children: 0-2; head of household always 1-2.
- Profit: about 10% losses down to -20,000 but never below -(wages + spouse wages + dividends); about
  8% under 1,500 (incl. 0, 433 and 434 where net earnings cross $400, and 1,082-1,083 near QBI of
  1,000); 5% set to the largest whole dollar that keeps taxable income before the QBI deduction at
  or under the threshold; the rest up to 400,000 (35% log-uniform, 65% uniform).
- Health premiums: 0 in half the rows and in every loss row; otherwise usually up to half the profit
  (max 30,000), sometimes anything up to 30,000.
- SEP contribution: 0 in 70% of rows; otherwise from 1 to the SEP maximum for that profit
  (Publication 560 steps 1-8), a quarter of them exactly at it.
- A row is redrawn if taxable income before the QBI deduction (with the business) is over the
  year's 199A threshold, or if the household would owe AMT with or without the business (Form 6251
  with Part III; no row ever did).

Coverage in the CSV:
- 280 losses; 51 with a profit but net earnings under $400.
- 417 where the wage base splits Schedule SE line 6; 111 with the owner's wages at or over the base.
- 833 claim the health deduction, 77 of them limited by the earned income; 480 SEP contributions.
- 807 QBI deductions limited by 20% of taxable income; 124 rows in 2026 where the $400 minimum
  applies; 375 with QBI of 0 or less; 101 within $1 of the threshold.
- 175 with the credit phased out partly or fully; 343 with an ACTC (159 limited by 15% of earned
  income); 262 with NIIT; 511 with additional Medicare on SE income; 343 with a negative `tax_with`.

## S corporation key (`scorp_key.py`)

### Inputs and outputs

Inputs: `case_id, year, filing_status, owner_other_wages, other_wages, qualified_dividends,
kids_under_17, profit, salary, costs, health_premiums`. `profit` is the corporation's profit
before the owner's salary, the employer payroll tax, its running costs and the premiums.

Outputs:
- `employer_tax` = 6.2% x min(salary, wage base) + 1.45% x salary (the corporation's share; the
  base counts per employer).
- `employee_tax` = 6.2% x the salary up to what the base leaves after the other job (anything
  withheld above that comes back as the excess social security credit, Schedule 3 line 11) +
  1.45% x salary + the 0.9% additional Medicare tax the salary adds on top of the household's
  other Medicare wages (both spouses on a joint return).
- `passed` = K-1 box 1 = profit - salary - employer tax - costs - premiums (a loss is allowed in
  full: basis, at-risk and passive rules assumed not to bite).
- `sehi` = min(premiums, the Medicare wages (W-2 box 5) from the corporation) (Form 7206 line 11).
- `qbi`, `tax_with`, `tax_without` as in the sole key. `tax_with` has the salary and the premiums
  in wages (W-2 box 1, Notice 2008-1), the K-1 income in AGI and the SEHI deduction.

### Derivation 1 and 2

1. The corporation's W-2 (box 1 = salary + premiums, boxes 3/5 = salary, box 4 = 6.2% to the base,
   box 6 = 1.45%), Form 941's employer share, Form 1120-S lines 7, 12, 18, 19, 21; Schedule 3
   line 11 for the excess social security; Form 8959 Part I worked with and without the salary;
   Form 7206 line 11; Form 8995 line 1(c) = K-1 box 1 - SEHI; then the same household Form 1040.
2. IRC 3111(a)/(b) with the 3121(a)(1) base per employer and 3121(a)(2)(B) (premiums are not FICA
   wages); 3101(a) with the 31(b)/6413(c) refund written as "6.2% of at most one base a year, the
   other job first"; 3101(b)(2) written as 0.9% x min(salary, household Medicare wages + salary -
   threshold); 1366(a) for the K-1; 162(l)(5)(A) (3121 wages are the earned income); then the
   household statute derivation.

### The generator

- 125 rows for each year and status; case ids `scorp-<year>-<status>-<nnn>`; whole-dollar inputs.
- Other job: 45% none, 7% at or over the base, 10% within 40,000 under it, the rest 2,000-170,000.
- Profit 5,000-400,000 (3% exactly 5,000). Salary: 10% 0, 8% the whole profit, 10% around the
  wage base (when the profit allows), the rest 20-80% of the profit; never more than the profit.
- Costs: 20% 0, 5% exactly 4,000, the rest 1-4,000. Premiums: 0 in half the rows, usually up to a
  quarter of the profit (max 30,000), sometimes anything up to 30,000.
- Same redraw rules as the sole key (199A threshold, AMT guard).

Coverage: 104 salaries of 0 and 71 equal to the profit; 34 over the base (employer tax capped); 65
with an excess social security credit (17 where the other job used the whole base); 94 where the
salary adds additional Medicare tax; 180 K-1 losses; 447 claim the health deduction, 70 limited by
the box 5 wages; 168 QBI deductions limited by 20% of taxable income; 63 rows with the 2026 $400
minimum; 46 with the credit phased out; 221 with an ACTC; 109 with NIIT.

## Retirement plans key (`plans_key.py`)

Inputs: `case_id, year, age, owner_wages, job_deferrals, profit`. Age is attained by December 31.
`owner_wages` (W-2 social security wages from a job) only sets the SE wage base. `job_deferrals`
are the elective deferrals already made in that job's 401(k) this year (never catch-ups).

Outputs:
- `se_half` Schedule SE line 13. `earned` = profit - `se_half` (Publication 560 step 3).
- `sep_max` = min(20% x earned, 25% x the 401(a)(17) limit, the 415(c) dollar limit) (P560 steps 1-8).
- `solo_max` = employer contribution + elective deferral + catch-up (P560 steps 1-19, below).
- `simple_comp` = net earnings from self-employment before SIMPLE contributions = 92.35% of profit
  (Schedule SE line 4; IRC 408(p)(6)(A)(ii); P560 ch. 3 "Compensation").
- `simple_max` = the owner's salary reduction contribution with any catch-up + the employer match.

### Derivation 1 (Publication 560, step by step)

- Solo 401(k), the Deduction Worksheet for Self-Employed: step 9 = the deferral = the 402(g) room
  left after `job_deferrals`, at most step 3; step 10 = 415(c) - step 9; step 12 = (step 3 - step 9)
  / 2; step 13 = the employer contribution = the smallest of steps 7, 10, 12; step 15 = the
  smaller of step 9 and step 3 - step 13; step 17 = the catch-up limit for the age; step 18 = the
  smaller of step 17 and step 3 - step 13 - step 15; step 19 = steps 13 + 15 + 18. Steps 20-21
  (Roth) change only the deduction, not the contribution, and are not used.
- SIMPLE IRA (P560 chapter 3): regular deferral = the smallest of the plan limit, the 402(g) room
  left after `job_deferrals` and the compensation; catch-up = the smaller of the catch-up limit and
  compensation - the regular deferral; match = the smaller of all deferrals and 3% of compensation.

### Derivation 2 (the statute in closed form)

- SE tax by 1401/1402 as in the sole key; earned income by 401(c)(2)(A)(vi).
- SEP: the 25% limit of 402(h)(2) / 404(a)(3) on compensation net of the contribution, written as
  earned x rate / (1 + rate); 401(a)(17) as 25% x the limit; 415(c)(1)(A).
- Solo: with d = min(402(g) room, earned), the regular total is
  min(415(c) dollar limit, d + earned x 0.25 / 1.25, (earned + d) / 2) (415(c)(1)(B) 100% of
  compensation, where compensation is earned income net of the employer contribution and includes
  deferrals, 415(c)(3)(B), (D)); then the catch-up outside 415(c) (414(v)(3)(A)) but within
  compensation (414(v)(2)(A)(ii)): `solo_max` = min(earned, regular total + catch-up limit).
- SIMPLE: deferrals = min(compensation, min(plan limit, 402(g) room) + catch-up limit);
  `simple_max` = deferrals + min(deferrals, 3% x compensation).
- A third check, outside the scripts: a brute-force scan over the employer amount (in exact
  fractions) of the solo 401(k) constraints found the same maximum on all 1,000 rows.

### The generator

- 500 rows a year; case ids `plans-<year>-<nnn>`. Ages: 40% drawn from 49, 50, 59, 60, 63, 64, the
  rest uniform 25-70. Wages: 40% 0, 8% over the base, 10% within 50,000 under it, the rest
  3,000-170,000. Job deferrals: only with wages; 0 in half of those rows, 20% of the rest at the
  smaller of the 402(g) limit and the wages, else uniform. Profit 500-600,000: 5% at the smallest
  whole dollar whose SEP maximum reaches the 415(c) cap, 3% exactly 500 or 600,000, 8% 500-5,000,
  25% log-uniform, the rest uniform.

Coverage: 393 under 50, 420 at 50-59 or 64+, 187 at 60-63; 314 with job deferrals (44 using the
whole 402(g) limit); 286 SEPs at the 415(c) cap; 400 solo plans with employer + deferral at the
415(c) cap; 440 solo and 449 SIMPLE catch-ups; 291 solo maxima equal to all of the earned income;
255 SIMPLE deferrals limited by compensation; 221 rows where the 402(g) room is under the SIMPLE
limit; 67 where the match is below 3% because the deferral is smaller; 95 with wages at or over the
wage base.

## Choices (where the rules are unclear or the brief had to be read)

1. **S corporation QBI is reduced by the health insurance deduction.** IRS FAQ 39 says the
   shareholder's 162(l) deduction "will be a deduction in determining QBI. This may result in QBI
   being reduced at both the entity and the shareholder level", in line with Treas. Reg.
   1.199A-3(b)(1)(vi). So `qbi` uses K-1 box 1 - `sehi`. The brief described QBI as the K-1 income
   itself; the difference is 20% of `sehi` where neither limit binds. Some tax software skips this
   reduction. Set `QBI_LESS_SEHI = False` in `scorp_key.py` for the other reading.
2. **The 2026 $400 minimum overrides the taxable-income limit.** The 2026 draft Form 8995
   instructions (line 17): "If the smaller of line 10 or 14 is less than $400, enter $400 if the
   aggregate qualified business income ... is at least $1,000." The $1,000 test uses line 1(c), the
   QBI after the SE tax, SEHI and retirement reductions. Taxable income then floors at 0.
3. **Taxable income before the QBI deduction** = AGI - standard deduction (Form 8995 line 11,
   IRC 199A(e)(1)), used for both the threshold screen and the 20% limit.
4. **Additional Medicare added by an S corporation salary** is the household's Form 8959 Part I
   tax with the salary minus without it (both spouses' wages count on a joint return). The 0.9% the
   employer withholds over 200,000 is not the tax; only the return's figure is used.
5. **Excess social security** is treated as never paid (the other job and the corporation are
   unrelated employers, so the credit applies); the employer share is never refunded.
6. **Earned income for the ACTC** follows the Schedule 8812 Earned Income Worksheet: W-2 box 1
   (including the S corporation premiums) + Schedule C line 31 - Schedule 1 line 15. S corporation
   K-1 income is not earned income.
7. **SIMPLE IRA higher limits apply** (an employer with 25 or fewer employees and no plan in the
   prior three years, 408(p)(2)(E)(i)(I) and (iv)): 17,600 / 18,100 and a 3,850 catch-up.
8. **SIMPLE catch-up at 60-63 is 5,250.** Read literally, 414(v)(2)(B)(iii) gives a higher-limit
   SIMPLE plan 3,850 at every age 50+, because only clause (ii) carries the age 60-63 parenthetical.
   T.D. 10033 (final regulations) lets such a plan give participants aged 60-63 the 150% amount
   instead when that is larger. The key assumes the plan does.
9. **The SIMPLE deferral can be the whole compensation** (it must be expressed as a percentage of
   compensation, 408(p)(2)(A)(ii)). The catch-up is limited to compensation minus the regular
   deferral (414(v)(2)(A)(ii); P560). The match is on all elective contributions, catch-ups
   included (408(p)(2)(A)(iii) matches "the amount the employee elects", and catch-ups are elected
   deferrals). So with a small profit `simple_max` can reach 103% of `simple_comp`.
10. **402(g) across plans.** The job's deferrals use up the 402(g) limit first. The SIMPLE or solo
    401(k) regular deferral gets what is left. The catch-up sits on top whatever the job did,
    because the job made none and the catch-up limit is per plan (P560: deferrals "aren't treated as
    catch-up contributions until they exceed" the limit). Note: SECURE 2.0 s.603(b)(1) struck
    402(g)(1)(C). The key follows P560 and the plan limits notices, which still treat catch-ups as
    on top of 402(g).
11. **Solo 401(k) deferral** is at most the earned income (profit - half SE tax), and the
    deferral is maximised before the employer contribution. That ordering gives the largest total
    (each dollar of deferral costs at most a dollar of employer contribution); the brute-force
    scan confirms it.
12. **415(c) per employer.** The job's 401(k) deferrals do not count against the solo plan's
    415(c) limit (unrelated employers). Only 402(g) is shared.
13. **No Tax Table and no rounding to whole dollars** anywhere: exact Decimal arithmetic, rounded
    half-up to cents only in the CSV. The IRS Tax Table would move the tax by a few dollars on
    rows under 100,000.

## What the keys leave out (on purpose)

- The earned income credit, all credits other than the child tax credit and the additional child
  tax credit, and other dependents. At most 2 children (so Schedule 8812 Part II-B never applies).
- Itemized deductions, Schedule 1-A deductions (tips, overtime, car loan interest, the senior
  deduction), age 65+ and blindness, interest, capital gains other than qualified dividends, Social
  Security, IRAs.
- Everything above the 199A threshold: the W-2 wage and property limits, the phase-in and specified
  service businesses (rows over the threshold are redrawn).
- QBI loss carryforwards in or out (Form 8995 line 3 is 0; a loss year's line 18 is not shown).
- AMT (the generators redraw a row that would owe it; none did). Excess business loss (461(l)),
  basis, at-risk and passive limits. Net operating losses.
- The months rule of 162(l)(2)(B): nobody is eligible for a subsidized employer health plan through
  the owner's job or the spouse's. No long-term care premiums, no premium tax credit interaction,
  no Form 2555.
- Schedule SE optional methods, church employee income, farm income; the spouse has no SE income.
- S corporation: FUTA and state unemployment tax, state taxes, reasonable compensation (a salary of
  0 is taken at face value), distributions, built-in gains, related or common-paymaster employers.
- Plans: Roth versus pre-tax (the same limits), the SIMPLE 2% nonelective alternative and the
  SECURE 2.0 extra nonelective contribution (408(p)(2)(A)(iv), up to 10% / $5,000), SIMPLE 401(k),
  defined benefit plans, a SEP and a 401(k) for the same business in the same year, the 457 and
  403(b) special catch-ups, employees, the deadline rules, and the Roth catch-up wage test (it
  changes the type, not the amount).

## Cross-checks done outside the scripts

- `household.py` against `tests/golden/taxes/federal-2025.csv` and `-2026.csv` on the 512 rows with
  only wages, qualified dividends and up to 2 children: tax and taxable income match that key's
  rounded columns (four rows differ by a cent only when its rounded additional Medicare column is
  subtracted from its rounded total).
- `household.amt_guard` against `tests/golden/career/amt.csv` (1,223 rows with no itemizing and no
  separate-return addition): the tentative minimum tax and the regular tax match to the cent.
- The solo 401(k) brute-force scan described above.

## Not sure / to recheck

- 2026 figures from drafts: the Form 8995 (2026) draft and its draft instructions (the minimum
  deduction lines), and the 2026 drafts of Schedule SE, Schedule 8812 and Form 7206. The figures
  match RP25 and Notice 2025-67. Recheck when the final 2026 forms come out.
- Choice 1 (S corporation QBI less SEHI) rests on an IRS FAQ, which is not binding guidance.
- Choice 8 (SIMPLE 60-63 at 5,250 in a higher-limit plan) depends on the plan document permitting it.

## CSV columns

`sole.csv`: `case_id, year, filing_status, owner_wages, other_wages, qualified_dividends,
kids_under_17, profit, health_premiums, retirement, se_tax, se_half, sehi, qbi, agi_with,
taxable_income_with, tax_with, tax_without, addl_medicare_se`.

`scorp.csv`: `case_id, year, filing_status, owner_other_wages, other_wages, qualified_dividends,
kids_under_17, profit, salary, costs, health_premiums, employer_tax, employee_tax, passed, sehi,
qbi, tax_with, tax_without`.

`plans.csv`: `case_id, year, age, owner_wages, job_deferrals, profit, se_half, earned, sep_max,
solo_max, simple_comp, simple_max`.

All money has two decimals; `year`, `age` and `kids_under_17` are integers.
