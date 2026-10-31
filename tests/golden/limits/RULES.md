# Contribution limits answer key: the rules

This file states, in plain words, the rules behind the answer key for the two contribution-limit pages: how much
a household may put into 401(k)s, IRAs, a Roth IRA, an HSA and a health FSA in a year, what an HSA paid through
payroll saves in tax, when IRA and HSA money for a year is due, and how much a giver can put into a 529 plan
without using up lifetime exemption. Each rule comes with the source text it rests on, the address and the date
it was read. Where no source decides, the file says which convention the key adopts. Section 10 works one example
per rule by hand, with invented people.

`tools/golden_limits/rules.py` holds the same figures as data, with the source and the date read on the line of
each figure, plus small pure functions and `work_household(case)`, which returns every output for one household
case. It uses Python 3's standard library only, and the arithmetic is exact (`Fraction`). Importing it runs
`check_tables()`, which rebuilds what it can from the statutes' own structure (bracket base amounts, phase-out
widths, the 60-63 catch-up, the FSA carryover), checks the IRS's own worked numbers (Pub. 590-A, Pub. 969, the Form
8959 and Form 709 instructions, five years of filing deadlines), checks every worked example of section 10, and
fails loudly if anything disagrees.

**Independence.** The key was written from the Internal Revenue Code, the regulations, the IRS notices, revenue
procedures and publications, SSA's Federal Register notices and the D.C. Code. Nobody opened `modules/`, `core/`
or `tests/*.test.mjs` while writing it, and it never imports or runs the app. The only things taken from
`tools/golden_health/` and `tools/golden_estate/` are their layout and conventions; no figure or code is shared.
The pages' documented model (the brief) is the spec. Where the law says otherwise, the key follows the law and
section 12 lists every such difference; a contrast output keeps the page's simplification only where the brief
asks for one.

All sources were read on **2026-10-31**. Section 15 lists them with their sha256. Tax years: **2025 and 2026**
for everything; **2027 only for the HSA limits** (and the deadline, which is a rule). Section 14 says what the
IRS had and had not published for 2027.

---

## 1. The household case and the outputs

One CSV row is one household in one year: `year`; `today` (a date in that year; only checked); `filing_status`
(`single`, `married_joint`, `married_separate`, `head_of_household`); `lived_apart` (0/1, used only for
`married_separate`: the spouses lived apart the whole year); adults `A` and, for the two married statuses, `B`,
each with `birth_date`, yearly `pay`, `k401` (pre-tax 401(k)), `roth401k` (Roth 401(k), same employer),
`k401_match` (employer match), `trad_ira`, `roth_ira` (direct), `hsa_payroll` (the person's own HSA money taken
from pay through the employer), `hsa_employer` (employer HSA deposits); and for the household `coverage`
(`none`, `self` = only A is HSA-eligible with self-only cover, `family` = one family high-deductible plan covering
everyone), `other_income` (taxable interest), `fsa_election`, `fsa_spent` (a health FSA through A's employer).

Single and head-of-household rows have adult A only; married rows have A and B (`work_household` refuses
anything else).

| Rule | Outputs (per adult `A_`/`B_` unless marked household) | Contrast (the page's simplification) |
|---|---|---|
| 1 401(k) | `k401_limit`, `k401_catch_up`, `k401_used`, `k401_room`, `k401_over`; extra: `k401_in_income` | `annual_additions`, `limit_415c`, `over_415c`, `exceeds_415c` |
| 2 IRA | `ira_limit`, `ira_catch_up`, `ira_used`, `ira_room`, `ira_over`; recorded: `ira_compensation`, `ira_comp_ok` | |
| 3 Roth | `magi`, `roth_status`, `roth_reduced_limit`, `roth_allowed`, `roth_over` | |
| (IRA) | `trad_ira_page_deduction` (the page's "fully deductible") | `trad_ira_deductible` (the real 219(g) amount); household `agi_real_deduction` |
| 4 HSA | `hsa_eligible`, `hsa_limit`, `hsa_used`, `hsa_room`, `hsa_over`; household `hsa_limit_household`, `hsa_total`, `hsa_room_household`, `hsa_over_household`; extra household `hsa_excess_to_remove` | |
| 5 Saving | household `income_tax_saved` (and `_with`, `_without`), `fica_saved_ss`, `fica_saved_medicare`, `fica_saved`, `addl_medicare_saved` | `fica_saved_flat` = 7.65% x household HSA payroll money |
| 6 FSA | household `fsa_limit`, `fsa_carryover`, `fsa_over`, `fsa_unspent`, `fsa_with_hsa`; extra `fsa_forfeit` | |
| 7 Due | household `ira_hsa_deadline` | |
| 8 529 | household `gift_exclusion`, `qtp_five_year_max` (per giver) | |
| Income | per adult `magi`, `agi`; joint returns also household `magi`, `agi` | joint `agi_real_deduction` |

Money is exact while it is worked. Shown, it is rounded half up to the cent. Every IRA phase-out result is a whole
multiple of $10 by law; with whole-dollar inputs only the tax and payroll-tax figures have cents.

---

## 2. Ages and income

### 2.1 Ages: the age reached by December 31

Every catch-up rule turns on the age a person reaches by the end of the year, so the key uses
**age = year - birth year**, whatever the day of the birthday.

> "who would attain age 50 by the end of the taxable year" (26 U.S.C. 414(v)(5)(A)); "The employee's 50th or
> higher birthday would occur before the end of the employee's taxable year." (26 CFR 1.414(v)-1(g)(3)(ii));
> "attained the age of 50 before the close of the taxable year" (219(b)(5)(B)(i)); "attained age 55 before the
> close of the taxable year" (223(b)(3)(A)).

A birthday on December 31 counts for that year (convention; the sources speak of the birthday occurring before
the end of the year, and the brief says "the year a person reaches the age").

### 2.2 Wages, AGI and MAGI

The brief's model: wages = pay - pre-tax 401(k) (the Roth 401(k) is not subtracted); AGI = wages + other income -
traditional IRA (as deductible) - HSA payroll money. The key keeps that model and adds what the law adds; each
addition changes nothing in a row without that feature (section 12 lists them):

* **W-2 wages (box 1)** per person = pay - pre-tax 401(k) + the excess pre-tax deferral that 402(g) puts back in
  income (section 3.3) - the FSA salary reduction up to its limit (A only; section 7) - HSA payroll money + the
  person's HSA money over the limit (section 5.4).
* **Payroll-tax (FICA) wages** per person = pay - FSA salary reduction - HSA payroll money + HSA money over the
  limit. 401(k) deferrals, pre-tax or Roth, stay in: "Nothing in any paragraph of subsection (a) (other than
  paragraph (1)) shall exclude from the term 'wages'— (A) any employer contribution under a qualified cash or
  deferred arrangement (as defined in section 401(k)) to the extent not included in gross income by reason of
  section 402(e)(3) or consisting of designated Roth contributions" (3121(v)(1)(A)).
* **MAGI** (for the Roth limit and the traditional-IRA phase-out) = box-1 wages on the return + other income. It is
  AGI with the IRA deduction added back: "Adjusted gross income of any taxpayer shall be determined ... without
  regard to sections 85(c), 135, 137, 221, and 911 or the deduction allowable under this section" (219(g)(3)(A));
  for a Roth IRA "adjusted gross income shall be determined in the same manner as under section 219(g)(3), except
  that any amount included in gross income under subsection (d)(3) [conversions] shall not be taken into account"
  (408A(c)(3)(B)(i)). The rows have no conversions, Social Security, student-loan interest or foreign income, so
  nothing else is added back. MAGI does not depend on whether the traditional IRA is deductible.
* **AGI** = MAGI - traditional IRA as deductible (the page's assumption, kept inside the 219(b) dollar limit;
  section 4.5).
* **Which return.** A joint return adds both spouses and the other income. On separate returns each spouse has
  their own wages and **half the other income** (convention: the brief gives one household figure). Single and
  head of household: A's.

---

## 3. Rule 1: the 401(k) limit (402(g), 414(v), 402A)

### 3.1 The limit, and pre-tax and Roth share it

> "the elective deferrals of any individual for any taxable year shall be included in such individual's gross
> income to the extent the amount of such deferrals for the taxable year exceeds the applicable dollar amount. The
> preceding sentence shall not apply to the portion of such excess as does not exceed the designated Roth
> contributions of the individual for the taxable year." (402(g)(1)(A))

> "The amount of elective deferrals which an employee may designate under paragraph (1) shall not exceed the excess
> (if any) of— (A) the maximum amount of elective deferrals excludable from gross income of the employee for the
> taxable year (without regard to this section), over (B) the aggregate amount of elective deferrals of the
> employee for the taxable year which the employee does not designate under paragraph (1)." (402A(c)(2))

So **used = pre-tax + Roth 401(k)**, measured against one limit.

| | 2025 | 2026 | Source |
|---|---|---|---|
| 402(g) limit | $23,500 | $24,500 | Notice 2024-80: "The limitation under section 402(g)(1) ... is increased from $23,000 to $23,500"; Notice 2025-67: "is increased from $23,500 to $24,500" |
| Catch-up, 50 and over | $7,500 | $8,000 | Notice 2024-80: "414(v)(2)(B)(i) ... remains $7,500"; Notice 2025-67: "is increased from $7,500 to $8,000" |
| Catch-up, reaching 60, 61, 62 or 63 | $11,250 | $11,250 | Notice 2024-80: "414(v)(2)(E)(i) ... that applies for individuals who attain age 60, 61, 62, or 63 in 2025 is $11,250"; Notice 2025-67: "in 2026 remains $11,250"; 26 CFR 1.414(v)-1(c)(2)(i)(B) "$11,250" |
| 415(c) annual additions (contrast) | $70,000 | $72,000 | Notice 2024-80: "415(c)(1)(A) is increased in 2025 from $69,000 to $70,000"; Notice 2025-67: "increased in 2026 from $70,000 to $72,000" |
| Roth catch-up wage threshold (prior-year FICA wages) | $145,000 | $150,000 | Notice 2024-80: "The Roth catch-up wage threshold for 2024 ... for 2025 ... remains $145,000"; Notice 2025-67: "The Roth catch-up wage threshold for 2025 ... for 2026 ... is increased from $145,000 to $150,000" |

Sources: https://www.irs.gov/pub/irs-drop/n-24-80.pdf and https://www.irs.gov/pub/irs-drop/n-25-67.pdf, read
2026-10-31; https://www.ecfr.gov/current/title-26/section-1.414(v)-1 (eCFR up to date as of 2026-10-29).

### 3.2 The catch-up, and the higher amount for 60 to 63

> "the applicable dollar amount is $5,000 (the adjusted dollar amount, in the case of an eligible participant who
> would attain age 60 but would not attain age 64 before the close of the taxable year)" (414(v)(2)(B)(i));
> the adjusted dollar amount is "the greater of— (I) $10,000, or (II) an amount equal to 150 percent of the dollar
> amount which would be in effect under such clause for 2024" (414(v)(2)(E)(i)).

`check_tables()` rebuilds it: max($10,000, 150% x $7,500) = $11,250. A person reaching 64 or more goes back to the
ordinary catch-up. The catch-up can never exceed pay minus the deferrals inside the limit: "the excess (if any) of—
(I) the participant's compensation (as defined in section 415(c)(3)) for the year, over (II) any other elective
deferrals" (414(v)(2)(A)(ii)); the key applies that cap, which binds only on very low pay.

**Outputs:** `limit` (402(g)), `catch_up`, `used` = pre-tax + Roth, `room` = max(0, limit + catch-up - used),
`over` = max(0, used - limit - catch-up).

### 3.3 What happens to an excess (extra output `k401_in_income`)

Pre-tax catch-ups stay out of income although SECURE 2.0 struck 402(g)(1)(C): "any catch-up contributions under
section 414(v) that are made to the plan on behalf of the participant that are not designated as Roth
contributions are not includible in the participant's gross income under section 402(g)(1)(A)" (Notice 2023-62,
s.III.A, https://www.irs.gov/pub/irs-drop/n-23-62.pdf). The money over limit + catch-up is an excess deferral;
the part not covered by Roth money goes into this year's income (402(g)(1)(A), last sentence quoted above; 26 CFR
1.402(g)-1(a) "except to the extent the excess deferrals are comprised of designated Roth contributions, and thus,
are already includible in gross income"). So **in_income = max(0, over - Roth 401(k))**. It must be paid back by
April 15 of the next year (402(g)(2)(A)(ii)), or it is taxed again when distributed (1.402(g)-1(e)(8)(iii)).

### 3.4 The Roth catch-up rule (414(v)(7)): reported, not applied

> "in the case of an eligible participant whose wages (as defined in section 3121(a)) for the preceding calendar
> year from the employer sponsoring the plan exceed $145,000, paragraph (1) shall apply only if any additional
> elective deferrals are designated Roth contributions" (414(v)(7)(A)).

Notice 2023-62 s.IV made 2024 and 2025 a transition: "until taxable years beginning after December 31, 2025, (1)
those catch-up contributions will be treated as satisfying the requirements of section 414(v)(7)(A), even if the
contributions are not designated as Roth contributions". So the rule bites from **2026**, on 2025 wages over
$150,000. The case has no prior-year wages, so the key cannot apply it; `roth_catch_up_required()` takes last
year's wages for a page that asks.

### 3.5 Contrast: the 415(c) annual-additions limit

> "such annual addition is greater than the lesser of— (A) $40,000, or (B) 100 percent of the participant's
> compensation" (415(c)(1)); "the term 'annual addition' means the sum of any year of— (A) employer contributions,
> (B) the employee contributions, and (C) forfeitures" (415(c)(2)); compensation "shall include— (i) any elective
> deferral ... and (ii) any amount ... not includible in the gross income of the employee by reason of section 125"
> (415(c)(3)(D)).

Catch-ups are outside it: such a contribution shall not "be subject to any otherwise applicable limitation
contained in sections 401(a)(30), 402(h), 403(b), 408, 415(c), and 457(b)(2)" (414(v)(3)(A)(i)); "A catch-up
contribution made in accordance with section 414(v) and § 1.414(v)-1 does not give rise to an annual addition"
(26 CFR 1.415(c)-1(b)(2)(ii)(B)); "Excess deferrals that are distributed in accordance with § 1.402(g)-1(e)(2) or
(3) do not give rise to annual additions" ((b)(2)(ii)(D)).

**Contrast outputs:** `annual_additions` = deferrals - the part treated as catch-up + match, where the part treated
as catch-up = min(catch-up, max(0, deferrals - 402(g) limit)); an excess deferral above that stays in, as not yet
distributed (convention). `limit_415c` = min(dollar limit, pay); `over_415c` = the excess; `exceeds_415c` 0/1.

---

## 4. Rules 2 and 3: the IRA limit and the Roth IRA income limit

### 4.1 Rule 2: one limit for traditional and Roth IRAs

> "The aggregate amount of contributions for any taxable year to all Roth IRAs maintained for the benefit of an
> individual shall not exceed the excess (if any) of— (A) the maximum amount allowable as a deduction under
> section 219 with respect to such individual for such taxable year (computed without regard to subsection (g) of
> such section), over (B) the aggregate amount of contributions for such taxable year to all other individual
> retirement plans (other than Roth IRAs) maintained for the benefit of the individual." (408A(c)(2))

> "In the case of an individual who has attained the age of 50 before the close of the taxable year, the deductible
> amount for such taxable year shall be increased by the applicable amount." (219(b)(5)(B)(i)); "In the case of
> any taxable year beginning in a calendar year after 2023, the $1,000 amount under subparagraph (B)(ii) shall be
> increased ... If any amount after adjustment under the preceding sentence is not a multiple of $100, such amount
> shall be rounded to the next lower multiple of $100." (219(b)(5)(C)(iii), added by SECURE 2.0 s.108)

| | 2025 | 2026 | Source |
|---|---|---|---|
| IRA limit | $7,000 | $7,500 | Notice 2024-80: "The deductible amount under section 219(b)(5)(A) ... remains $7,000"; Notice 2025-67: "is increased from $7,000 to $7,500" |
| IRA catch-up, 50 and over | $1,000 | $1,100 | Notice 2024-80: "219(b)(5)(B)(ii) ... remains $1,000"; Notice 2025-67: "is increased from $1,000 to $1,100"; Pub. 590-A (2025), What's New for 2026: "$7,500 ($8,600 for individuals age 50 or older)" |

**Outputs:** `limit`, `catch_up`, `used` = traditional + Roth, `room` = max(0, limit + catch-up - used), `over` =
max(0, used - limit - catch-up).

**Compensation (recorded, assumed enough).** The limit is the lesser of the dollar amount and "an amount equal to
the compensation includible in the individual's gross income" (219(b)(1)(B)). On a joint return the lower earner
may add "the compensation includible in the gross income of such individual's spouse ... reduced by" the spouse's
IRA deduction, nondeductible contributions and Roth contributions (219(c)(1)(B), (c)(2)(A) "such individual files a
joint return"). The key records that figure (`ira_compensation`, using box-1 wages: Pub. 590-A "Compensation
includes wages, salaries, tips ...") and `ira_comp_ok` = 1 when it reaches the limit with catch-up. Every IRA and
Roth output assumes `ira_comp_ok` = 1, as the brief says; on separate returns there is no spousal IRA.

### 4.2 Rule 3: the Roth IRA reduction

> "(A) Dollar limit. The amount determined under paragraph (2) for any taxable year shall not exceed an amount equal
> to the amount determined under paragraph (2)(A) for such taxable year, reduced (but not below zero) by the amount
> which bears the same ratio to such amount as— (i) the excess of— (I) the taxpayer's adjusted gross income for
> such taxable year, over (II) the applicable dollar amount, bears to (ii) $15,000 ($10,000 in the case of a joint
> return or a married individual filing a separate return). The rules of subparagraphs (B) and (C) of section
> 219(g)(2) shall apply to any reduction under this subparagraph." (408A(c)(3)(A))

> "(B) No reduction below $200 until complete phase-out. No dollar limitation shall be reduced below $200 under
> paragraph (1) unless (without regard to this subparagraph) such limitation is reduced to zero. (C) Rounding. Any
> amount determined under this paragraph which is not a multiple of $10 shall be rounded to the next lowest $10."
> (219(g)(2)(B), (C))

Source: https://uscode.house.gov/us/usc/119-136/t26/s408A/ and .../s219/, the OLRC edition "current through Public
Law 119-136 (October 22, 2026)", read 2026-10-31. The congress.gov API lists 138 laws of the 119th Congress, the
last being 119-136, so the edition is complete as of today.

Pub. 590-A (2025) says the same in worksheet form (https://www.irs.gov/pub/irs-pdf/p590a.pdf, read 2026-10-31):

> TIP: "Round your reduced contribution limit up to the nearest $10. If your reduced contribution limit is more than
> $0, but less than $200, increase the limit to $200."
> Worksheet 2-2, line 5: "Divide line 3 by line 4 and enter the result as a decimal (rounded to at least three
> places). If the result is 1.000 or more, enter 1.000"; line 8: "Subtract line 7 from line 6. Round the result up
> to the nearest $10. If the result is less than $200, enter $200"; line 10: "Subtract line 9 [contributions for
> the year to other IRAs] from line 6"; line 11: "Enter the lesser of line 8 or line 10. This is your reduced Roth
> IRA contribution limit".

**The rule the key applies** (`phase_out`, method `law`), with L = IRA limit + catch-up:

1. MAGI at or below the start: no reduction. At or above the end: 0.
2. Between: reduction = L x (MAGI - start) / (end - start), **rounded down to $10**; reduced limit = L - reduction.
3. If that is above $0 but below $200, it becomes **$200**.
4. **roth_allowed = max(0, min(reduced limit, L - traditional IRA))**; **roth_over** = max(0, Roth - roth_allowed).

Rounding the reduction down to $10 and rounding the result up to $10 are the same thing because L is always a
multiple of $10. Pub. 590-A's line 5 allows "at least three places"; the exact ratio is the law. A three-place
ratio (half up) is available as method `worksheet`; it can differ by $10 when the rounded ratio crosses a $10 step
(`check_tables()` holds one such case).

### 4.3 The phase-out ranges, and married people filing separately

| MAGI range where the Roth limit shrinks | 2025 | 2026 | width |
|---|---|---|---|
| married filing jointly | $236,000 - $246,000 | $242,000 - $252,000 | $10,000 |
| single, head of household, married filing separately and apart all year | $150,000 - $165,000 | $153,000 - $168,000 | $15,000 |
| married filing separately, lived together at any time | $0 - $10,000 | $0 - $10,000 | $10,000 |

Notice 2024-80: "the adjusted gross income phase-out range for taxpayers making contributions to a Roth IRA is
between $236,000 and $246,000 for married couples filing jointly ... For singles and heads of household, the
income phase-out range is between $150,000 and $165,000 ... For a married individual filing a separate return,
the phase-out range is not subject to an annual cost-of-living adjustment and remains between $0 and $10,000."
Notice 2025-67: "between $242,000 and $252,000 ... between $153,000 and $168,000 ... remains between $0 and
$10,000."

Living apart: "(C) Marital status. Section 219(g)(4) shall apply for purposes of this paragraph." (408A(c)(3)(C));
"A husband and wife who— (A) file separate returns for any taxable year, and (B) live apart at all times during
such taxable year, shall not be treated as married individuals for purposes of this subsection." (219(g)(4)).
Pub. 590-A Table 2-1 puts "married filing separately (and you didn't live with your spouse at any time during the
year)" in the single row. On separate returns each spouse's MAGI is their own.

### 4.4 The status label

`roth_status` follows the bands of Pub. 590-A (2025) Table 2-1 ("Effect of Modified AGI on Roth IRA Contribution",
https://www.irs.gov/publications/p590a, read 2026-10-31) literally:

> married filing jointly: "less than $236,000" "you can contribute up to $7,000 ($8,000 if you are age 50 or older)";
> "at least $236,000 but less than $246,000" "the amount you can contribute is reduced"; "$246,000 or more" "you can't
> contribute to a Roth IRA". Married filing separately and you lived with your spouse at any time during the year:
> "zero (-0-)" up to the limit; "more than zero (-0-) but less than $10,000" reduced; "$10,000 or more" can't. Single,
> head of household, or married filing separately and you didn't live with your spouse: "less than $150,000";
> "at least $150,000 but less than $165,000"; "$165,000 or more".

So **ok** below the start, and at exactly 0 on the separate-and-together range; **partial** from the start of the
joint and single ranges (above 0 on the separate one) up to the end; **over** at or above the end. At exactly a
start the statute reduces nothing (the "excess" of income over the applicable amount is zero), so the allowed
amount is the full limit at every start; only the label turns on the table. (Until 2026-10-31 the key said ok at
every start; a check against the sources found that Pub. 590-A's table supports `partial` at the joint and single
starts, so the key now follows the table.)

### 4.5 Contrast: the real traditional IRA deduction (219(g))

The page treats every traditional IRA dollar as deductible. The key keeps that assumption in AGI, but inside the
dollar limit, which applies to everyone (219(b)(1)(A), (b)(5)): `trad_ira_page_deduction` = min(traditional,
L). The real deduction is the contrast `trad_ira_deductible`:

> "If (for any part of any plan year ending with or within a taxable year) an individual or the individual's spouse
> is an active participant, each of the dollar limitations contained in subsections (b)(1)(A) and (c)(1)(A) for
> such taxable year shall be reduced (but not below zero) by the amount determined under paragraph (2)."
> (219(g)(1)); the ratio is to "$10,000 ($20,000 in the case of a joint return)" (219(g)(2)(A)(ii)); "If this
> subsection applies to an individual for any taxable year solely because their spouse is an active participant,
> then, in applying this subsection to the individual (but not their spouse)— (A) the applicable dollar amount
> under paragraph (3)(B)(i) shall be $150,000; and (B) the amount applicable under paragraph (2)(A)(ii) shall be
> $10,000." (219(g)(7))

Active participant, as the brief says: any 401(k) money for the person (pre-tax, Roth or match). Pub. 590-A:
"Generally, you are covered by a defined contribution plan for a tax year if amounts are contributed or allocated
to your account for the plan year that ends with or within that tax year."

| Who | 2025 | 2026 | Source |
|---|---|---|---|
| in a plan, single or head of household (or separate and apart all year) | $79,000 - $89,000 | $81,000 - $91,000 | Notice 2024-80 "between $79,000 and $89,000"; Notice 2025-67 "between $81,000 and $91,000" |
| in a plan, joint return | $126,000 - $146,000 | $129,000 - $149,000 | Notice 2024-80 / 2025-67 "if the spouse who makes the IRA contribution is an active participant" |
| not in a plan, spouse in one, joint return | $236,000 - $246,000 | $242,000 - $252,000 | Notice 2024-80 / 2025-67 "For an IRA contributor who is not an active participant and is married to someone who is an active participant" |
| either spouse in a plan, separate return, lived together | $0 - $10,000 | $0 - $10,000 | Notice 2024-80 / 2025-67 "remains $0 to $10,000"; Pub. 590-A Tables 1-2 and 1-3 |
| nobody in a plan, or separate and apart with only the spouse in one | full deduction | full deduction | 219(g)(1), (g)(4); Pub. 590-A Table 1-3 "You are entitled to the full deduction if you didn't live with your spouse at any time during the year" |

The reduction uses the same $10 rounding and $200 floor (219(g)(2)(B), (C)). Pub. 590-A Worksheet 1-2 line 4:
"Multiply line 3 by the percentage below that applies to you. If the result isn't a multiple of $10, round it to
the next highest multiple of $10. (For example, $611.40 is rounded to $620.) However, if the result is less than
$200, enter $200." `trad_ira_deductible` = min(traditional, reduced limit); `agi_real_deduction` (joint returns)
is the AGI with the real deductions. A check: the 219(g)(7) amount and the joint Roth start are both $150,000
indexed from 2005 to the nearest $1,000, so they are equal every year ($236,000 in 2025, $242,000 in 2026), and
`check_tables()` asserts it.

---

## 5. Rule 4: the HSA limit (223(b))

### 5.1 The limits

> "The monthly limitation for any month is 1/12 of— (A) in the case of an eligible individual who has self-only
> coverage under a high deductible health plan as of the first day of such month, $2,250. (B) in the case of an
> eligible individual who has family coverage ..., $4,500." (223(b)(2)), indexed by 223(g).

| | self-only | family | Source |
|---|---|---|---|
| 2025 | $4,300 | $8,550 | Rev. Proc. 2024-25 s.2.01(1) "is $4,300 ... is $8,550" (https://www.irs.gov/pub/irs-drop/rp-24-25.pdf) |
| 2026 | $4,400 | $8,750 | Rev. Proc. 2025-19 s.2.01(1) "is $4,400 ... is $8,750" (https://www.irs.gov/pub/irs-drop/rp-25-19.pdf); Pub. 15-B (2026) the same |
| 2027 | $4,500 | $9,000 | Rev. Proc. 2026-24 s.3.01(1) "For calendar year 2027 ... is $4,500 ... is $9,000" (https://www.irs.gov/pub/irs-drop/rp-26-24.pdf) |

The case covers the whole year, so the monthly sum is the yearly figure.

### 5.2 The catch-up: $1,000 at 55, into the person's own HSA

> "In the case of an individual who has attained age 55 before the close of the taxable year, the applicable
> limitation ... shall be increased by the additional contribution amount." (223(b)(3)(A)); the table ends "2009 and
> thereafter $1,000" (223(b)(3)(B)). It is not indexed: 223(g)(1) indexes only (b)(2), (c)(2)(A) and (c)(1)(E).

> Pub. 969 (2025): "If both spouses are 55 or older and not enrolled in Medicare, each spouse's contribution limit
> is increased by the additional contribution. If both spouses meet the age requirement, the total contributions
> under family coverage can't be more than $10,550. Each spouse must make the additional contribution to their own
> HSA." (https://www.irs.gov/pub/irs-pdf/p969.pdf)

### 5.3 Spouses share one family limit; employer money counts

> "In the case of individuals who are married to each other, if either spouse has family coverage— (A) both spouses
> shall be treated as having only such family coverage ..., and (B) the limitation under paragraph (1) (after the
> application of subparagraph (A) and without regard to any additional contribution amount under paragraph (3))—
> ... (ii) after such reduction, shall be divided equally between them unless they agree on a different division."
> (223(b)(5)); Pub. 969: "Caution: The rules for married people apply only if both spouses are eligible
> individuals."

> "The limitation ... shall be reduced (but not below zero) by the sum of— ... (B) the aggregate amount contributed
> to health savings accounts of such individual which is excludable from the taxpayer's gross income for such
> taxable year under section 106(d)" (223(b)(4)); Pub. 969: "You must reduce the amount you or any other person
> can contribute to your HSA by the amount of any contributions made by your employer that are excludable from
> your income. This includes amounts contributed to your account by your employer through a cafeteria plan." and
> "Contributions to an employee's account by an employer using the amount of an employee's salary reduction
> through a cafeteria plan are treated as employer contributions."

So a person's **hsa_used = own payroll money + employer deposits**. The key treats spouses as married for
223(b)(5) on separate returns and when they lived apart (convention: 223 has no living-apart rule of its own, and
the Code's general one, 7703(b), applies only to someone keeping a home for a child they can claim; the rows have
no dependents).

### 5.4 The outputs, and the per-person convention

* `hsa_eligible`: from `coverage` as the case defines it (self: A only; family: everyone; none: nobody).
* `hsa_limit` per person, the most that person could have in the year **given the other spouse's actual money**.
  With family cover and two married spouses: limit_p = catch-up_p + max(0, family - max(0, used_q - catch-up_q)).
  That is the brief's min(family + catch-up_p - used_p, family + both catch-ups - both uses) + used_p, with one
  clamp: the other spouse's own excess never eats into this person's catch-up (the two agree whenever the other
  spouse is within their own maximum). Otherwise: the self-only or family amount + own catch-up when eligible, 0
  when not.
* `hsa_room` = max(0, limit - used); `hsa_over` = max(0, used - limit).
* Household: `hsa_limit_household` = the coverage amount + the catch-ups of eligible people 55 and over;
  `hsa_total` = all HSA money; `hsa_room_household`, `hsa_over_household` against it.

The per-person "over" answers "how much of this person's money is over if the other's stays as it is". When both
spouses lean on the shared limit, both can show the same dollars over (section 10.4), so the two are not
additive. And the household over can miss money that is really over when a spouse 55 or older does not use their
own catch-up, because that catch-up cannot go into the other spouse's HSA. The key therefore adds one extra
household figure, **`hsa_excess_to_remove`** = max(0, need_A + need_B - family), need_p = max(0, used_p -
catch-up_p): the least money the couple must take out, at the division of the family limit they would agree on.

**Medicare.** "The limitation under this subsection for any month with respect to an individual shall be zero for
the first month such individual is entitled to benefits under title XVIII of the Social Security Act and for each
month thereafter." (223(b)(7)). The rows have no one 65 or older, so this is a note only.

**FSA conflict.** A general-purpose health FSA ends HSA eligibility (223(c)(1)(A)(ii): an eligible individual is
"not, while covered under a high deductible health plan, covered under any health plan— (I) which is not a high
deductible health plan"). The key does not zero the HSA limit for such a row; it reports `fsa_with_hsa` = 1
(section 7) and leaves the HSA outputs as if the case's coverage held, because the brief allows such rows only to
test the page's warning.

---

## 6. Rule 5: the tax the HSA payroll money saves

### 6.1 Income tax

**income_tax_saved** = household federal income tax without the HSA payroll money minus with it. "Without"
puts every adult's HSA payroll money back in pay and keeps the employer deposits; the HSA position is worked
again, because the excess can change. Tax = the rate schedule on (AGI - standard deduction), nothing else (no
dependents, no credits, no one 65 or older). Separate returns are worked one by one and added.

Brackets: Rev. Proc. 2024-40 s.2.01 Tables 1-4 for 2025 (https://www.irs.gov/pub/irs-drop/rp-24-40.pdf) and Rev.
Proc. 2025-32 s.4.01 for 2026 (https://www.irs.gov/pub/irs-drop/rp-25-32.pdf). Pub. L. 119-21 did not change
the 2025 tables: Rev. Proc. 2025-32 s.3 modifies only s.2.15(1) (standard deduction) and s.2.25 (section 179) of
Rev. Proc. 2024-40. `check_tables()` rebuilds every printed "$X plus N% of the excess over" amount from the bracket
lines, exactly.

| Upper bound of each bracket (10, 12, 22, 24, 32, 35%; 37% above) | 2025 | 2026 |
|---|---|---|
| married filing jointly | 23,850; 96,950; 206,700; 394,600; 501,050; 751,600 | 24,800; 100,800; 211,400; 403,550; 512,450; 768,700 |
| head of household | 17,000; 64,850; 103,350; 197,300; 250,500; 626,350 | 17,700; 67,450; 105,700; 201,750; 256,200; 640,600 |
| single | 11,925; 48,475; 103,350; 197,300; 250,525; 626,350 | 12,400; 50,400; 105,700; 201,775; 256,225; 640,600 |
| married filing separately | 11,925; 48,475; 103,350; 197,300; 250,525; 375,800 | 12,400; 50,400; 105,700; 201,775; 256,225; 384,350 |

| Standard deduction | 2025 | 2026 |
|---|---|---|
| married filing jointly | $31,500 | $32,200 |
| head of household | $23,625 | $24,150 |
| single, married filing separately | $15,750 | $16,100 |

2025: "Section 63(c)(7) as amended by the OBBBA provides the standard deduction amounts under § 63(c)(2) for any
taxable year beginning in 2025 as follows: ... $31,500 ... $23,625 ... $15,750 ... $15,750 ... Accordingly, section
2.15(1) of Rev. Proc. 2024-40 is removed." (Rev. Proc. 2025-32 s.3.01; the removed figures were $30,000, $22,500,
$15,000.) The statute: 63(c)(7)(A) "by substituting '$23,625' for '$4,400' in subparagraph (B), and ... '$15,750'
for '$3,000' in subparagraph (C)", joint = "200 percent of the dollar amount in effect under subparagraph (C)"
(63(c)(2)(A)); Pub. L. 119-21 s.70102(c): "The amendments made by this section shall apply to taxable years
beginning after December 31, 2024." (https://www.congress.gov/119/plaws/publ21/PLAW-119publ21.htm). 2026: Rev.
Proc. 2025-32 s.4.14(1).

Conventions: exact taxable income, no IRS Tax Table (which uses $50 steps under $100,000 and can differ by a few
dollars); head of household is taxed as given although the status needs a qualifying person and the rows have no
dependents.

### 6.2 Payroll tax: Social Security only below the wage base

> "a tax equal to 6.2 percent of the wages (as defined in section 3121(a))" (3101(a)); "a tax equal to 1.45 percent
> of the wages" (3101(b)(1)); wages exclude, for 3101(a), the part paid after "remuneration ... equal to the
> contribution and benefit base (as determined under section 230 of the Social Security Act)" (3121(a)(1)).

| Social Security wage base | Source |
|---|---|
| 2025: $176,100 | SSA, "Cost-of-Living Increase and Other Determinations for 2025", 89 FR 85276 (Oct 25, 2024): "The OASDI contribution and benefit base is $176,100 for remuneration paid in 2025"; irs.gov COLA page "Taxable wage base ... 176,100" |
| 2026: $184,500 | SSA, same title for 2026, 90 FR 49047 (Nov 3, 2025): "... is $184,500 for remuneration paid in 2026"; irs.gov COLA page "184,500" |
| 2027: $192,300 (not used) | SSA, same title for 2027, 91 FR 67380 (Oct 26, 2026): "... is $192,300 for remuneration paid in 2027" |

(ssa.gov answered "Access Denied" to this reader; SSA's own notices were read on govinfo:
https://www.govinfo.gov/content/pkg/FR-2024-10-25/pdf/2024-24871.pdf, .../FR-2025-11-03/pdf/2025-19763.pdf,
.../FR-2026-10-26/pdf/2026-21796.pdf.)

HSA money through a cafeteria plan is not payroll-tax wages, up to the limit: Pub. 15-B (2026): "Up to specified
dollar limits, cash contributions to the HSA of a qualified individual (determined monthly) are exempt from
federal income tax withholding, social security tax, Medicare tax, and FUTA tax if you reasonably believe that the
employee can exclude the benefits from gross income." (https://www.irs.gov/pub/irs-pdf/p15b.pdf; see also
3121(a)(5)(G).)

Per person: **SS saved = 6.2% x (min(FICA wages without, base) - min(FICA wages with, base))**, **Medicare saved
= 1.45% x (FICA wages without - with)**. `fica_saved` = the sum over adults of both parts, also given apart as
`fica_saved_ss` and `fica_saved_medicare`. Someone whose wages stay above the base after the HSA money saves no
Social Security tax at all.

### 6.3 The additional Medicare tax

> "a tax equal to 0.9 percent of wages which are received with respect to employment ... and which are in excess
> of— (A) in the case of a joint return, $250,000, (B) in the case of a married taxpayer (as defined in section
> 7703) filing a separate return, ½ of the dollar amount determined under subparagraph (A), and (C) in any other
> case, $200,000." (3101(b)(2); the same thresholds for self-employment income in 1401(b)(2)(A))

A joint return adds both spouses' wages: Form 8959 instructions (2025): "Medicare wages and self-employment income
are combined to determine if your income exceeds the threshold", and Example 5: "Erin has $150,000 in wages and
Frank has $175,000 in wages ... their combined $325,000 in wages exceeds the $250,000 threshold for joint filers.
Erin and Frank are liable for Additional Medicare Tax on $75,000 of wages" (https://www.irs.gov/pub/irs-pdf/i8959.pdf;
`check_tables()` reproduces it); "The threshold amounts below aren't indexed for inflation." The key uses the
liability, not the employer's withholding (3102(f)(1): withholding only "in excess of $200,000" from that employer).
**addl_medicare_saved** = liability without - with, per return, added.

### 6.4 Contrast: the page's flat 7.65%

`fica_saved_flat` = 7.65% x the household's HSA payroll money. It overstates the saving for anyone above the
Social Security wage base and leaves out the additional Medicare tax.

---

## 7. Rule 6: the health FSA (125(i))

> "if a benefit is provided under a cafeteria plan through employer contributions to a health flexible spending
> arrangement, such benefit shall not be treated as a qualified benefit unless the cafeteria plan provides that an
> employee may not elect for any taxable year to have salary reduction contributions in excess of $2,500 made to
> such arrangement." (125(i)(1)), indexed "rounded to the next lowest multiple of $50" (125(i)(2)).

| | 2025 | 2026 | Source |
|---|---|---|---|
| salary-reduction limit | $3,300 | $3,400 | Rev. Proc. 2024-40 s.2.16 "the dollar limitation under § 125(i) on voluntary employee salary reductions for contributions to health flexible spending arrangements is $3,300"; Rev. Proc. 2025-32 s.4.15 "is $3,400" |
| carryover maximum | $660 | $680 | same sections: "If the cafeteria plan permits the carryover of unused amounts, the maximum carryover amount is $660" / "$680" |

The carryover began as $500 (Notice 2013-71: "permits § 125 cafeteria plans to be amended to allow up to $500 of
unused amounts remaining at the end of a plan year in a health FSA to be paid or reimbursed to plan participants
for qualified medical expenses incurred during the following plan year, provided that the plan does not also
incorporate the grace period rule") and was indexed by Notice 2020-33 s.III.A to "an amount equal to 20 percent of
the maximum salary reduction contribution under § 125(i) for that plan year" (20% x $3,300 = $660; 20% x $3,400 =
$680; `check_tables()` asserts both). https://www.irs.gov/pub/irs-drop/n-13-71.pdf,
https://www.irs.gov/pub/irs-drop/n-20-33.pdf.

**Outputs:** `fsa_limit`, `fsa_carryover`, `fsa_over` = max(0, election - limit), `fsa_unspent` = max(0, election
- spent), `fsa_with_hsa` = 1 when an FSA is elected and any HSA money exists. Extra: `fsa_forfeit` = max(0, unspent
- carryover maximum), what is lost if the plan has a carryover (a plan may instead have a grace period, or neither;
the case does not say).

The FSA conflict: Pub. 969 "An employee covered by an HDHP and a health FSA or an HRA that pays or reimburses
qualified medical expenses can't generally make contributions to an HSA"; Pub. 15-B (2026) "an employee's
participation in a health FSA or HRA generally disqualifies the individual (and employer) from making
contributions to their HSA". A limited-purpose or post-deductible FSA would be allowed; the case's FSA is a
general one.

The salary reduction is kept out of wages: Pub. 969 "You don't pay federal income tax or employment taxes on the
salary you contribute or the amounts your employer contributes to the FSA." The key excludes the election **up to
the limit** (convention; section 13).

---

## 8. Rule 7: the deadline for IRA and HSA money

> "For purposes of this section, a taxpayer shall be deemed to have made a contribution to an individual retirement
> plan on the last day of the preceding taxable year if the contribution is made on account of such taxable year and
> is made not later than the time prescribed by law for filing the return for such taxable year (not including
> extensions thereof)." (219(f)(3))

The right subsections for the other accounts: for HSAs, 223(d)(4): "Rules similar to the following rules shall
apply for purposes of this section: ... (B) Section 219(f)(3) (relating to time when contributions deemed made)."
For Roth IRAs, 408A(c)(6): "For purposes of this section, the rule of section 219(f)(3) shall apply."

> "returns made on the basis of the calendar year shall be filed on or before the 15th day of April following the
> close of the calendar year" (6072(a)).

> "When the last day prescribed under authority of the internal revenue laws for performing any act falls on
> Saturday, Sunday, or a legal holiday, the performance of such act shall be considered timely if it is performed on
> the next succeeding day which is not a Saturday, Sunday, or a legal holiday. ... the term 'legal holiday' means a
> legal holiday in the District of Columbia" (7503); "the term legal holiday includes the legal holidays in the
> District of Columbia as found in D.C. Code Ann. 28-2701" (26 CFR 301.7503-1(b)).

> D.C. Code 28-2701 lists "District of Columbia Emancipation Day, April 16" among the holidays and adds: "When a day
> set apart as a legal holiday, other than the day of the inauguration of the President, falls on a Saturday, the
> next preceding day is a holiday. When a day set apart as a legal holiday falls on a Sunday, the next succeeding
> day is a holiday." (https://code.dccouncil.gov/us/dc/council/code/sections/28-2701)

**ira_hsa_deadline** = April 15 of the next year, moved to the next day that is not a Saturday, Sunday or D.C.
legal holiday. 401(k) money has no such grace: it must come out of pay in the year.

| Tax year | Deadline | Check |
|---|---|---|
| 2015 | Mon Apr 18, 2016 (Emancipation Day observed Fri Apr 15) | Pub. 590-A (2015): "contributions for 2015 by April 18, 2016" |
| 2016 | Tue Apr 18, 2017 (Sat 15, Sun 16, observed Mon 17) | Pub. 590-A (2016): "contributions for 2016 by April 18, 2017" |
| 2021 | Mon Apr 18, 2022 (observed Fri Apr 15) | Pub. 590-A (2021): "by April 18, 2022" |
| 2022 | Tue Apr 18, 2023 (Sat 15, Sun 16, observed Mon 17) | Pub. 590-A (2022): "by April 18, 2023" |
| **2025** | **Wed Apr 15, 2026** | Pub. 590-A (2025): "most people can make contributions for 2025 by April 15, 2026"; Pub. 969 (2025): "You can make contributions to your HSA for 2025 through April 15, 2026." |
| **2026** | **Thu Apr 15, 2027** | the rule (no IRS statement yet) |
| **2027** (HSA only) | **Tue Apr 18, 2028** (Sat 15, Sun 16, observed Mon 17) | the rule |

Not modelled: disaster postponements (7508A) and the statewide holidays that 7503 adds for filings at offices
outside the District.

---

## 9. Rule 8: 529 gifts

> "In the case of gifts (other than gifts of future interests in property) made to any person by the donor during
> the calendar year, the first $10,000 of such gifts to such person shall not ... be included in the total amount
> of gifts made during such year." (2503(b)(1)), indexed and "rounded to the next lowest multiple of $1,000"
> (2503(b)(2)).

> "If the aggregate amount of contributions described in subparagraph (A) during the calendar year by a donor
> exceeds the limitation for such year under section 2503(b), such aggregate amount shall, at the election of the
> donor, be taken into account for purposes of such section ratably over the 5-year period beginning with such
> calendar year." (529(c)(2)(B))

> Form 709 instructions (2025), Line B: "If in 2025, you contributed more than $19,000 to a qualified tuition plan
> (QTP) on behalf of any one person, you may elect to treat up to $95,000 of the contribution for that person as if
> you had made it ratably over a 5-year period. ... You can only apply the election to a maximum of $95,000."
> (https://www.irs.gov/pub/irs-pdf/i709.pdf)

| | 2025 | 2026 | Source |
|---|---|---|---|
| annual exclusion, per giver per person | $19,000 | $19,000 | Rev. Proc. 2024-40 s.2.43(1) "For calendar year 2025, the first $19,000 of gifts to any person"; Rev. Proc. 2025-32 s.4.42(1) "For calendar year 2026, the first $19,000"; Rev. Proc. 2026-25 s.2.02 the same |
| five-year election amount, per giver per beneficiary | $95,000 | $95,000 | 5 x the exclusion (529(c)(2)(B); Form 709 instructions) |

A couple is two givers: each spouse may elect on their own $95,000 (or split gifts under 2513). The statute itself
spreads "such aggregate amount" without a cap; the five-times cap is the IRS's reading (Form 709 instructions) and
the brief's. `qtp_election()` also works the Form 709 example: Pat gives $100,000, elects on $95,000, and reports
$5,000 + $19,000 = $24,000 for the first year.

---

## 10. Worked examples (invented people)

Each example is checked number for number by `_check_examples()` in `rules.py`.

### 10.1 Rosa, 61, pre-tax and Roth 401(k) money over the limit (2026)

Rosa was born 1965-03-14, so she reaches 61 in 2026, inside the 60-63 window. Pay $150,000; pre-tax 401(k)
$26,000; Roth 401(k) $10,000; employer match $6,000.

* limit $24,500; catch-up **$11,250** (60-63); together $35,750.
* used = 26,000 + 10,000 = **$36,000** (one limit for both kinds, 402A(c)(2)).
* room **$0**; over = 36,000 - 35,750 = **$250**.
* in income this year: max(0, 250 - 10,000) = **$0**: the excess is covered by Roth money, which is taxed already.
  It still has to be paid back by April 15, 2027, or it is taxed a second time when it leaves the plan. Had all
  $36,000 been pre-tax, the $250 would be in her 2026 wages.
* Contrast 415(c): the part treated as catch-up = min(11,250, 36,000 - 24,500) = 11,250; annual additions = 36,000
  - 11,250 + 6,000 = **$30,750**, under min($72,000, $150,000) = $72,000: not exceeded.
* At 64 the catch-up falls back to $8,000; in 2025 a 60-year-old's is $11,250.

### 10.2 Dev and Mara, joint, inside the Roth phase-out with a traditional IRA (2026)

Dev, born 1981 (45), pay $150,000, pre-tax 401(k) $10,000 (so he is an active participant), Roth IRA $4,260.
Mara, born 1974 (52), pay $105,000, no workplace plan, traditional IRA $6,000, Roth IRA $3,000. Interest $1,321.
No HSA, no FSA.

* MAGI = (150,000 - 10,000) + 105,000 + 1,321 = **$246,321**; the 2026 joint range is $242,000 - $252,000, so
  both are **partial**; excess 4,321, ratio 0.4321.
* Dev: L = $7,500. Reduction 7,500 x 0.4321 = 3,240.75, down to **$3,240**; reduced limit **$4,260**. He has no
  traditional IRA, so allowed = min(4,260, 7,500 - 0) = **$4,260**; Roth over $0.
* Mara: L = 7,500 + 1,100 = $8,600. Reduction 8,600 x 0.4321 = 3,716.06, down to **$3,710**; reduced limit
  **$4,890**. Allowed = min(4,890, 8,600 - 6,000) = **$2,600**; Roth over = 3,000 - 2,600 = **$400**. Her IRA
  total 9,000 is $400 over the shared $8,600 (rule 2), the same $400.
* Pub. 590-A Worksheet 2-2 for Mara: line 5 0.432; line 7 0.432 x 8,600 = 3,715.20; line 8 8,600 - 3,715.20 =
  4,884.80, up to **$4,890**: the same.
* Traditional deduction, the contrast. Mara is not in a plan but Dev is, so her range is $242,000 - $252,000 with a
  $10,000 width (219(g)(7)): limit 8,600 - 3,710 = $4,890; real deduction = min(6,000, 4,890) = **$4,890**; the
  page deducts **$6,000**. AGI on the page's assumption 246,321 - 6,000 = **$240,321**; with the real deduction
  **$241,431**. (Dev's own traditional deduction would use the joint-participant range $129,000 - $149,000, which
  their MAGI is far above.)

### 10.3 Sam and Lee, married filing separately: together vs apart (2026)

Sam, born 1986 (40), pay $90,000; Lee, born 1988 (38), pay $9,000. Each puts $7,500 in a Roth IRA. No workplace
plans, no other income.

* **Lived together at some time:** the range is $0 - $10,000 on each separate return.
  Sam: MAGI $90,000 is past the end: **over**, allowed $0, Roth over **$7,500**. Lee: MAGI $9,000, ratio 0.9,
  reduction 7,500 x 0.9 = $6,750, limit **$750** (**partial**), Roth over **$6,750**.
* **Lived apart all year:** treated as single (219(g)(4) via 408A(c)(3)(C)): range $153,000 - $168,000. Both are
  **ok**: allowed **$7,500** each, nothing over.
* The $200 floor: had Lee's MAGI been $9,990 (living together), the reduction is 7,500 x 0.999 = 7,492.50, down to
  $7,490, leaving $10, which the floor raises to **$200**.
* Neither is in a workplace plan, so a traditional IRA would be fully deductible either way.

### 10.4 Ana (56) and Ben (52): one family HSA limit with employer money (2026)

Family HDHP. Ana: payroll HSA $3,000 + employer $1,000 = **$4,000**. Ben: payroll $5,000 + employer $500 =
**$5,500**. Family limit $8,750; Ana's catch-up $1,000 (55 or older); Ben none.

* Ana's limit = 1,000 + max(0, 8,750 - max(0, 5,500 - 0)) = 1,000 + 3,250 = **$4,250**; room **$250**.
* Ben's limit = 0 + max(0, 8,750 - max(0, 4,000 - 1,000)) = **$5,750**; room **$250**.
* Household: limit 8,750 + 1,000 = **$9,750**; total **$9,500**; room **$250**; nothing over. (The two $250s are
  the same $250: whoever adds it uses it up.)
* If Ben adds $1,000 more ($6,500): Ana's limit falls to 1,000 + 8,750 - 6,500 = $3,250, so she shows **$750**
  over; Ben shows 6,500 - 5,750 = **$750** over; the household is **$750** over. Only $750 has to come out
  (`hsa_excess_to_remove` = (4,000 - 1,000) + 6,500 - 8,750 = 750), and at the division nearest to equal halves it
  is Ben's: Ana's share is 3,000, Ben's 5,750.
* Swap the ages (Ana 52, Ben 56) with Ana at $9,750 and Ben at $0: the household limit is again $9,750 and the
  household shows nothing over, but Ben's $1,000 catch-up cannot go into Ana's account, so Ana is **$1,000** over
  and `hsa_excess_to_remove` = **$1,000**.
* With the same money and an FSA elected through Ana's employer, `fsa_with_hsa` = 1.

### 10.5 Kai, above the Social Security wage base: what the HSA payroll money saves (2026)

Kai, born 1981 (45), single, pay $210,000, pre-tax 401(k) $24,500 (exactly the limit), self-only HDHP, HSA by
payroll **$4,400** (exactly the limit), no other income.

* With the HSA money: wages 210,000 - 24,500 - 4,400 = 181,100; taxable 181,100 - 16,100 = 165,000; tax 17,966 +
  24% x (165,000 - 105,700) = 17,966 + 14,232 = **$32,198**.
* Without: wages 185,500; taxable 169,400; tax 17,966 + 24% x 63,700 = 17,966 + 15,288 = **$33,254**.
* **income_tax_saved = $1,056** (24% x 4,400).
* Payroll-tax wages (the 401(k) stays in): with 205,600, without 210,000. Both are above the $184,500 base, so
  **Social Security saved $0**. Medicare 1.45% x 4,400 = **$63.80**. **fica_saved = $63.80**.
* Additional Medicare (single, $200,000): without 0.9% x 10,000 = $90.00; with 0.9% x 5,600 = $50.40;
  **addl_medicare_saved = $39.60**.
* The page's flat contrast: 7.65% x 4,400 = **$336.60**, $272.80 too much, and no $39.60.
* At pay $186,000 instead: payroll-tax wages 181,600 with, 186,000 without; Social Security saved 6.2% x (184,500 -
  181,600) = **$179.80**; Medicare $63.80; no additional Medicare (under $200,000); income tax saved still $1,056.

### 10.6 Jo, an FSA over the limit (2026)

Jo elects $3,600 to the FSA at work and spends $2,900.

* `fsa_limit` **$3,400**; `fsa_over` = 3,600 - 3,400 = **$200** (the plan may not allow it).
* `fsa_unspent` = 3,600 - 2,900 = **$700**; `fsa_carryover` maximum **$680**, so if the plan carries over,
  **$20** is lost (`fsa_forfeit`); with no carryover or grace period, all $700 is lost.
* No HSA money, so `fsa_with_hsa` = 0; with any HSA money it would be 1.
* Wages leave out the $3,400 within the limit; the $200 over stays in wages (convention).

### 10.7 Deadlines and 529 in brief

* IRA and HSA money for 2025 by **April 15, 2026**; for 2026 by **April 15, 2027**; HSA money for 2027 by
  **April 18, 2028**.
* 529 in 2025 or 2026: $19,000 a year per giver per child, or **$95,000** at once with the five-year election; two
  parents can put in **$190,000** for one child, each electing.

---

## 11. Where Pub. 590-A (2025) disagrees with itself

The key follows the statute in both cases; both are checked in `check_tables()`.

1. **Worksheet 1-2, Example 1** (joint return, the spouse in a plan, MAGI $126,500): the text says "You can take a
   deduction of only $6,825", and the illustrated worksheet enters 6,825 on line 4. But line 4's own instruction
   says "If the result isn't a multiple of $10, round it to the next highest multiple of $10", which turns 19,500 x
   0.35 = 6,825 into **$6,830**, and the statute gives the same: reduction 7,000 x 500 / 20,000 = 175, rounded to
   "the next lowest $10" = 170, limit **$6,830**.
2. **Worksheet 2-2, Example**: the text says "Your modified AGI for 2025 is $150,000 ... You figure your reduced Roth
   IRA contribution of $6,530 as shown on Worksheet 2-2", but the illustrated worksheet has line 1 **151,000**,
   line 5 0.067, line 7 469 and line 8 **6,540**. At $150,000 nothing is reduced ($7,000); at $151,000 the law and
   the worksheet both give **$6,540**. Neither figure in the text matches its own worksheet.

(Pub. 590-A's What's New for 2026 also prints "$252,0000"; the notice says $252,000.)

---

## 12. Where the law differs from the page's model (the key follows the law)

Each item changes nothing in a row that lacks the feature.

1. **FSA salary reduction is not wages.** The brief's wages are pay - pre-tax 401(k). The law keeps the FSA salary
   reduction out of income and payroll tax (Pub. 969; 3121(a)(5)(G)), so the key subtracts it (up to the limit)
   from A's wages, which lowers MAGI and AGI and can change the Roth result.
2. **An excess pre-tax 401(k) deferral is income** (402(g)(1)(A)), section 3.3.
3. **HSA money over the limit is income and payroll-tax wages.** 106(d)(1) excludes employer money "to the extent
   such amounts do not exceed the limitation under section 223(b)"; Pub. 969: "Excess contributions made by your
   employer are included in your gross income"; Pub. 15-B exempts it from payroll tax "Up to specified dollar
   limits". A person who is not eligible has all of it over. The brief's AGI subtracts all HSA payroll money.
4. **The "fully deductible" traditional IRA stops at the dollar limit** (219(b)(1)): the page assumption ignores
   only the workplace-plan phase-out.
5. **The payroll-tax saving** counts Social Security only below the wage base and adds the additional Medicare tax
   (contrast column: the page's flat 7.65%).
6. **The real traditional IRA deduction** under 219(g) (contrast column).

---

## 13. Conventions, and what could not be verified

**Conventions** (no source decides):

1. Age = year - birth year; a December 31 birthday counts for that year (2.1).
2. Roth status exactly at the start of a range follows Pub. 590-A Table 2-1: `partial` at the joint and single
   starts, `ok` at exactly 0 on the separate-and-together range (4.4).
3. The phase-out uses the exact ratio (the law); the three-place worksheet ratio, half up, is a side method (4.2).
4. Active participant = any 401(k) money of the person's own (pre-tax, Roth or match), as the brief says.
5. HSA eligibility comes from `coverage`; an FSA with an HSA is only flagged (5.4).
6. The per-person HSA limit is the brief's formula, clamped (5.4). For what is really over (income and payroll
   tax), the spouses divide the family limit so as to leave the least money over and, among such divisions, as
   close to equal halves as possible (223(b)(5)'s default); `hsa_excess_to_remove` reports the total.
7. Income tax from the rate schedule on exact taxable income; no Tax Table; head of household used as given;
   separate returns split the other income in half (6.1, 2.2).
8. The FSA election is excluded from wages up to the limit; the part over stays in wages.
9. For 415(c), deferrals over the 402(g) limit count as catch-up first, up to the catch-up limit; an excess
   deferral above that is an annual addition (not yet distributed).
10. Compensation is assumed to cover every IRA limit (recorded as `ira_compensation`, `ira_comp_ok`).
11. Deadlines use D.C. legal holidays only; no disaster postponements.
12. The tax outputs are left empty (None) for anyone 65 or older (the senior deduction of Pub. L. 119-21 s.70103 and
    the additional standard deduction are not modelled), and every output that needs an unpublished 2027 figure is
    None.
13. Display: half up to the cent.
14. Spouses are married for the shared family HSA limit on separate returns too, and when they lived apart (5.3).

**Not verified:**

* The 2027 retirement-plan notice and the 2027 inflation-adjustment revenue procedure: not published by
  2026-10-31 (section 14). The key has no 2027 figure for them and invents none.
* Whether an FSA election over the 125(i) limit is excluded up to the limit or not at all (125(i)(1) speaks of the
  plan's terms, not of the employee's tax): convention 8.
* The order of the catch-up inside 415(c) when an excess deferral is not distributed: convention 9.
* How the IRS would divide an HSA excess between spouses who never agreed on a division (the statute says equal
  halves "unless they agree"): convention 6.
* SSA's own web page for the wage base (ssa.gov refused this reader); SSA's Federal Register notices and the IRS
  COLA page were used instead.

---

## 14. 2027: what the IRS had published by 2026-10-31

**Published:** the HSA limits, $4,500 self-only and $9,000 family (Rev. Proc. 2026-24, s.3.01(1)). The catch-up
stays $1,000 (statutory). The deadline for 2027 money follows the rule: April 18, 2028. SSA also published the 2027
wage base ($192,300, 91 FR 67380), which the key records but does not use.

**Not published:** the 2027 retirement-plan amounts (402(g), 414(v), 415(c), the IRA limit and catch-up, the
Roth and traditional phase-outs, the Roth catch-up wage threshold) and the 2027 inflation adjustments (brackets,
standard deduction, FSA limit and carryover, gift exclusion). The checks, all on 2026-10-31: the irs.gov COLA page
(last reviewed 24-Aug-2026) shows the columns 2026, 2025, 2024, 2023 only; the IRS news releases for October 2026
(IR-2026-117 to IR-2026-129, last reviewed 29-Oct-2026), September and August 2026 have no such release; irs-drop
`n-26-64` to `n-26-75` and `rp-26-35` to `rp-26-45` answered 404, and the published `rp-26-25` to `rp-26-34` are on
other subjects (Trump-account gifts, the 2027 premium credit table, exempt organizations, letter rulings, accounting
methods, the IRA and plan correction programs). A 2027 row therefore carries only the HSA outputs and the deadline.

---

## 15. Sources

All read on 2026-10-31. sha256 of the copy read: first 8 ... last 10 hex digits.

| Tag | Source | sha256 |
|---|---|---|
| USC402, USC402A, USC414, USC415, USC219, USC408A, USC223, USC106, USC125, USC7503, USC6072, USC63, USC3101, USC3102, USC3121, USC1401, USC529, USC2503, USC7703 | 26 U.S.C. sections, OLRC, "current through Public Law 119-136 (October 22, 2026)", https://uscode.house.gov/us/usc/119-136/t26/s<N>/ | 5e82a2eb...06a671254f, fdd63642...25a1c2069b, aa3909ba...2833ad01fd, a569b3e0...e80eb43d67, 205d6464...52444227ff, 0c54c46d...06d58c05a2, b7b5bdd4...b9d6f0bd15, bc00c0cb...ad9cd8798d, a134d73f...c6d7bf300c, 6fd6414b...56dff7aeac, 222fc98f...402f83081b, ed5cc3db...c6cabf21e4, 04bdb134...e071c36d77, 19f91715...de3697dba2, a97b7469...b7ec1e4ccd, fe306dfb...0cd9f4a969, 3b8244e8...7656bb9c1e, 8ed278a2...47bb78f2a0, 3b86233b...f919086579 |
| CGLAWS | congress.gov API, laws of the 119th Congress (138; highest 119-136, Oct 22, 2026), https://api.congress.gov/v3/law/119 | a69dcbda...4523e89947 |
| PL11921 | Pub. L. 119-21 s.70102, https://www.congress.gov/119/plaws/publ21/PLAW-119publ21.htm | 84000b07...c584e9004d |
| CFR402G, CFR414V, CFR415C, CFR7503, CFR3101 | 26 CFR 1.402(g)-1, 1.414(v)-1, 1.415(c)-1, 301.7503-1, 31.3101-2, eCFR "up to date as of 2026-10-29", https://www.ecfr.gov/current/title-26/section-<N> | 76bbb386...b829726970, 58d82560...871f70d248, 78f6c111...1446d88e12, 2c8d416a...506c8ea75c, 24667e5f...6842367d05 |
| DC2701 | D.C. Code 28-2701, https://code.dccouncil.gov/us/dc/council/code/sections/28-2701 | fbf67571...f780e9db41 |
| N2480, N2567 | IRS Notices 2024-80 and 2025-67, https://www.irs.gov/pub/irs-drop/n-24-80.pdf, n-25-67.pdf | cbf7843c...4ed22e59ad, 1eea8f14...11dc0a1f8d |
| N2362 | IRS Notice 2023-62, https://www.irs.gov/pub/irs-drop/n-23-62.pdf | e1022cce...043c1534b9 |
| N1371, N2033 | IRS Notices 2013-71 and 2020-33, https://www.irs.gov/pub/irs-drop/n-13-71.pdf, n-20-33.pdf | 134ffa91...0fbc7d2d8a, 5149c59b...076ff2f73a |
| RP2425, RP2519, RP2624 | Rev. Procs. 2024-25, 2025-19, 2026-24 (HSA), https://www.irs.gov/pub/irs-drop/rp-24-25.pdf, rp-25-19.pdf, rp-26-24.pdf | 6093d2e3...c1ac65dc00, ff2ba4ba...c11da35bf4, bcb6b41a...f45afcb715 |
| RP2440, RP2532 | Rev. Procs. 2024-40 and 2025-32, https://www.irs.gov/pub/irs-drop/rp-24-40.pdf, rp-25-32.pdf | 4de9db6b...d4c302af1f, e9ada115...a96214635b |
| RP2625 | Rev. Proc. 2026-25, https://www.irs.gov/pub/irs-drop/rp-26-25.pdf | ccc5c989...1d42d22884 |
| P590A, P590A15, P590A16, P590A21, P590A22 | IRS Pub. 590-A (2025), https://www.irs.gov/pub/irs-pdf/p590a.pdf; prior editions https://www.irs.gov/pub/irs-prior/p590a--<year>.pdf | ca0e4287...cc06a0e1c7, eafd9d5b...e6a030a27f, cbdcb506...b5d5afa97b, 0c1105ca...34f7c68147, b84d1e67...a48847553c |
| P969 | IRS Pub. 969 (2025), https://www.irs.gov/pub/irs-pdf/p969.pdf | d51681ec...407a5b522f |
| P15B | IRS Pub. 15-B (2026), https://www.irs.gov/pub/irs-pdf/p15b.pdf | a0af8513...77b639ec46 |
| I8959, I709 | Instructions for Forms 8959 and 709 (2025), https://www.irs.gov/pub/irs-pdf/i8959.pdf, i709.pdf | 1d223be7...abf687b68f, 7de1ce38...8a47b75bcf |
| IRSCOLA | https://www.irs.gov/retirement-plans/cola-increases-for-dollar-limitations-on-benefits-and-contributions | f71666b8...c0cb6be4ff |
| IRSNEWS | IRS news releases, October (current month), September and August 2026 | 36a52141...4ea56d25a1, a13ebe25...2f0b25adac, e0eec8c5...251c67ba15 |
| SSA25, SSA26, SSA27 | SSA cost-of-living determinations for 2025, 2026, 2027: 89 FR 85276, 90 FR 49047, 91 FR 67380 (govinfo PDFs) | dea3f4c9...d3aeec5de6, 4d275490...d8d9326f97, 700ede41...444e40a20c |
