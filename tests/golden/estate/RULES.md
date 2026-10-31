# Estate and gift tax answer key: the rules

This file states, in plain words, the rules behind the answer key for two calculators: the federal
**estate tax** (one person, or a married couple) and **gifts** (the yearly allowance per person, the
lifetime exemption, gifts split between spouses, 529 college savings front-loading, and when a gift tax
return is due). Each rule comes with the source text it rests on, the address, and the date it was read.
Where no source decides, the file says which convention the key adopts. Section 9 works five examples by
hand, using invented households.

`tools/golden_estate/rules.py` holds the same figures as data, with the source and the date read on the
line of each figure, plus small pure functions. It uses Python 3's standard library only, and the
arithmetic is exact (`Fraction`). Importing it runs `check_tables()`. That function rebuilds every figure
it can from the statute's own formula, replays the examples printed in the regulations and the IRS
instructions, checks the worked examples below, and fails loudly if anything disagrees.

**Independence.** The key was written from the law, the regulations and the IRS's own publications.
Nobody opened `modules/`, `core/` or `tests/*.test.mjs` while writing it, and it never imports or runs
the app. The only things taken from `tools/golden_health/` and `tools/golden_debt/` are their layout and
conventions. No figure or code is shared with them. The pages' model (their README) is the spec. Where the
law says otherwise, the key follows the law and section 10 records the difference.

All sources were read on **2026-10-31**. Section 13 lists them with their sha256. The U.S. Code text is
the Office of the Law Revision Counsel edition "current through Public Law 119-136 (October 22, 2026)",
at `https://uscode.house.gov/us/usc/119-136/t26/s<section>/`. The congress.gov API lists 119-136 as the
latest public law of the 119th Congress (https://api.congress.gov/v3/law/119), so no later law is missing
from that edition. The regulations are eCFR title 26, "up to date as of 2026-10-29", at
`https://www.ecfr.gov/current/title-26/section-<section>`.

---

## 1. The tax rate table (26 U.S.C. 2001(c))

**Rule.** One rate table serves the estate tax and the gift tax. The "tentative tax" on an amount is read
from it. Every exemption since 2011 is above $1,000,000, so in practice any tax due is **40% of the amount
above the exemption**.

> "(c) Rate schedule. If the amount with respect to which the tentative tax to be computed is: | The
> tentative tax is:
> Not over $10,000 | 18 percent of such amount.
> Over $10,000 but not over $20,000 | $1,800, plus 20 percent of the excess of such amount over $10,000.
> Over $20,000 but not over $40,000 | $3,800, plus 22 percent of the excess of such amount over $20,000.
> Over $40,000 but not over $60,000 | $8,200 plus 24 percent of the excess of such amount over $40,000.
> Over $60,000 but not over $80,000 | $13,000, plus 26 percent of the excess of such amount over $60,000.
> Over $80,000 but not over $100,000 | $18,200, plus 28 percent of the excess of such amount over $80,000.
> Over $100,000 but not over $150,000 | $23,800, plus 30 percent of the excess of such amount over $100,000.
> Over $150,000 but not over $250,000 | $38,800, plus 32 percent of the excess of such amount over $150,000.
> Over $250,000 but not over $500,000 | $70,800, plus 34 percent of the excess of such amount over $250,000.
> Over $500,000 but not over $750,000 | $155,800, plus 37 percent of the excess of such amount over $500,000.
> Over $750,000 but not over $1,000,000 | $248,300, plus 39 percent of the excess of such amount over $750,000.
> Over $1,000,000 | $345,800, plus 40 percent of the excess of such amount over $1,000,000."
> (26 U.S.C. 2001(c), https://uscode.house.gov/us/usc/119-136/t26/s2001/, read 2026-10-31)

**Which laws shaped it.** The amendment notes of the same page were read for this.
- **2012 law** (the American Taxpayer Relief Act, Pub. L. 112-240, signed Jan. 2, 2013): "substituted in
  table separate tentative tax rates for amounts over $500,000 but not over $750,000, over $750,000 but
  not over $1,000,000, and over $1,000,000 ... for single tentative tax rate for amounts over $500,000."
  That gave the 37%, 39% and 40% rows.
- **2017 law** (Pub. L. 115-97): "amended subsec. (g) generally". It changed only the rule for refiguring
  old gift tax at today's rates, not the table.
- **2025 law** (Pub. L. 119-21): it does not appear in the source credit or the notes of section 2001, so
  the table is unchanged. That law changed the exemption instead (section 2).

The IRS prints the same table as "Table A—Unified Rate Schedule" in the Instructions for Form 706 (Rev.
July 2026). `check_tables()` checks that the rows meet, and that each row's "$X plus" is the previous
row's tax plus its rate on its width (for example, $345,800 = $248,300 + 39% x $250,000).

## 2. The exemption and the yearly gift allowance

### 2.1 The basic exclusion amount ("the exemption")

**Rule.** The exemption is the "basic exclusion amount" of the year of death: **2024 $13,610,000; 2025
$13,990,000; 2026 $15,000,000.** The credit against the tax is the tentative tax on that amount.

> "(1) In general. For purposes of this section, the applicable credit amount is the amount of the
> tentative tax which would be determined under section 2001(c) if the amount with respect to which such
> tentative tax is to be computed were equal to the applicable exclusion amount. (2) Applicable exclusion
> amount. For purposes of this subsection, the applicable exclusion amount is the sum of— (A) the basic
> exclusion amount, and (B) in the case of a surviving spouse, the deceased spousal unused exclusion
> amount. (3) Basic exclusion amount. (A) In general. For purposes of this subsection, the basic exclusion
> amount is $15,000,000." (26 U.S.C. 2010(c)(1)-(3)(A), https://uscode.house.gov/us/usc/119-136/t26/s2010/)

The $15,000,000 comes from the 2025 law, section 70106 (not another section number):

> "SEC. 70106. EXTENSION AND ENHANCEMENT OF INCREASED ESTATE AND GIFT TAX EXEMPTION AMOUNTS. (a) In
> General.--Section 2010(c)(3) is amended-- (1) in subparagraph (A) by striking ``$5,000,000'' and
> inserting ``$15,000,000'', (2) in subparagraph (B)-- (A) in the matter preceding clause (i), by striking
> ``2011'' and inserting ``2026'', and (B) in clause (ii), by striking ``calendar year 2010'' and inserting
> ``calendar year 2025'', and (3) by striking subparagraph (C). (b) Effective Date.--The amendments made by
> this section shall apply to estates of decedents dying and gifts made after December 31, 2025."
> (Pub. L. 119-21, 139 Stat. 72, https://www.govinfo.gov/content/pkg/PLAW-119publ21/html/PLAW-119publ21.htm)

The struck subparagraph (C) was the 2017 doubling, "after December 31, 2017, and before January 1, 2026
... substituting '$10,000,000' for '$5,000,000'" (amendment notes of 2010). So there is no 2026 "sunset".

| Year of death | Basic exclusion amount | Source (all read 2026-10-31) |
|---|---|---|
| 2024 | $13,610,000 | Rev. Proc. 2023-34 s.3.41: "For an estate of any decedent dying in calendar year 2024, the basic exclusion amount is $13,610,000 for determining the amount of the unified credit against estate tax under § 2010." https://www.irs.gov/pub/irs-drop/rp-23-34.pdf |
| 2025 | $13,990,000 | Rev. Proc. 2024-40 s.3.41, the same words with 2025 and $13,990,000. https://www.irs.gov/pub/irs-drop/rp-24-40.pdf |
| 2026 | $15,000,000 | The statute above. Rev. Proc. 2025-32 s.2.14: "Section 70106 of the OBBBA amends § 2010(c)(3) by increasing the basic exclusion amount to $15,000,000 for calendar year 2026 ... The basic exclusion amount will be adjusted for inflation for calendar year 2027 and future years." https://www.irs.gov/pub/irs-drop/rp-25-32.pdf. IR-2025-103 (Oct. 9, 2025): "Estates of decedents who die during 2026 have a basic exclusion amount of $15,000,000, up from a total of $13,990,000 for estates of decedents who died in 2025." |

The IRS page "What's new — Estate and gift tax" (last reviewed 23-Jul-2026) lists every year from 2011
through 2026, and the Instructions for Form 706 (Rev. July 2026) print a "Table of Basic Exclusion Amounts"
with a "Credit Equivalent at 2026 Rates". `check_tables()` rebuilds each credit from the rate table. For
example, 2026: $345,800 + 40% x ($15,000,000 - $1,000,000) = **$5,945,800**, which matches the
instructions' "The basic credit amount is $5,945,800". 2024 gives $5,389,800 and 2025 $5,541,800.

**One regulation is out of date.** 26 CFR 20.2010-1(e)(3)(iii) still reads "For any decedent dying after
calendar year 2017, and before calendar year 2026, ... substituting '$10,000,000' for '$5,000,000.'" The
statute governs, and the key ignores that text.

### 2.2 From 2027 the exemption is indexed (the law), but the 2027 figure is not published yet

> "(B) Inflation adjustment. In the case of any decedent dying in a calendar year after 2026, the dollar
> amount in subparagraph (A) shall be increased by an amount equal to— (i) such dollar amount, multiplied
> by (ii) the cost-of-living adjustment determined under section 1(f)(3) for such calendar year by
> substituting 'calendar year 2025' for 'calendar year 2016' in subparagraph (A)(ii) thereof. If any
> amount as adjusted under the preceding sentence is not a multiple of $10,000, such amount shall be
> rounded to the nearest multiple of $10,000." (26 U.S.C. 2010(c)(3)(B))

Section 1(f)(3) has a special rule for base years after 2016:

> "(C) Special rule for adjustments with a base year after 2016. For purposes of any provision of this
> title which provides for the substitution of a year after 2016 for '2016' in subparagraph (A)(ii),
> subparagraph (A) shall be applied by substituting 'the C-CPI-U for calendar year 2016' for 'the CPI for
> calendar year 2016' and all that follows in clause (ii) thereof." ... "(B) Determination for calendar
> year. The C-CPI-U for any calendar year is the average of the C-CPI-U as of the close of the 12-month
> period ending on August 31 of such calendar year." (26 U.S.C. 1(f)(3)(C), (f)(6)(B),
> https://uscode.house.gov/us/usc/119-136/t26/s1/)

In plain words: for a death in year Y (2027 or later), the exemption is $15,000,000 times the average
chained CPI (C-CPI-U) for the 12 months ending August 31 of year Y-1, divided by the same average for the
12 months ending August 31, 2025. It never goes down ("the percentage (if any)"), and it is rounded to the
nearest $10,000. `bea_indexed()` does this from the two averages, but the key does not supply them.

**The 2027 figures were not published by 2026-10-31.** The 2026 figures came out on Oct. 9, 2025
(IR-2025-103). The key looked on 2026-10-31 and found no 2027 figures:
- The IRS news releases for October 2026 (IR-2026-117 to IR-2026-129, page last reviewed 29-Oct-2026)
  and for September 2026 (IR-2026-103 to IR-2026-116) contain no inflation release.
  https://www.irs.gov/newsroom/news-releases-for-current-month,
  https://www.irs.gov/newsroom/news-releases-for-september-2026
- The Internal Revenue Bulletins 2026-36 (Aug. 31) through 2026-45 (Nov. 2, 2026) contain no such revenue
  procedure. https://www.irs.gov/irb
- Of `https://www.irs.gov/pub/irs-drop/rp-26-NN.pdf` for NN = 20 to 60, numbers 20-26, 28, 30 and 32-34
  exist, and none is the annual inflation procedure. The 2027 Marketplace table (2026-26) and the 2027
  HSA figures (2026-24) are there, but not the general one. Numbers 35 to 60 answered 404.
- Third-party sites print estimates of the 2027 figures. The key does not use any of them.

So the key, like the page, **carries the 2026 figure forward** for 2027 and later and marks it
"unpublished" (`basic_exclusion(2027)` returns `(15000000, False)`). Section 10.3 records this as a
difference from the law.

### 2.3 The annual exclusion (the yearly gift allowance per recipient)

**Rule.** Each giver may give each recipient up to the annual exclusion in a calendar year without it
counting. **2024 $18,000; 2025 $19,000; 2026 $19,000.** The amount is indexed and rounded *down* to a
multiple of $1,000.

> "(1) In general. In the case of gifts (other than gifts of future interests in property) made to any
> person by the donor during the calendar year, the first $10,000 of such gifts to such person shall not,
> for purposes of subsection (a), be included in the total amount of gifts made during such year. ...
> (2) Inflation adjustment. In the case of gifts made in a calendar year after 1998, the $10,000 amount
> contained in paragraph (1) shall be increased by an amount equal to— (A) $10,000, multiplied by (B) the
> cost-of-living adjustment determined under section 1(f)(3) for such calendar year by substituting
> 'calendar year 1997' for 'calendar year 2016' in subparagraph (A)(ii) thereof. If any amount as adjusted
> under the preceding sentence is not a multiple of $1,000, such amount shall be rounded to the next lowest
> multiple of $1,000." (26 U.S.C. 2503(b), https://uscode.house.gov/us/usc/119-136/t26/s2503/)

| Year of gift | Annual exclusion | Source (read 2026-10-31) |
|---|---|---|
| 2024 | $18,000 | Rev. Proc. 2023-34 s.3.43(1): "For calendar year 2024, the first $18,000 of gifts to any person (other than gifts of future interests in property) are not included in the total amount of taxable gifts under § 2503 made during that year." |
| 2025 | $19,000 | Rev. Proc. 2024-40 s.3.43(1), the same words with 2025 and $19,000 |
| 2026 | $19,000 | Rev. Proc. 2025-32 s.4.42(1), the same words with 2026 and $19,000. IR-2025-103: "the annual exclusion for gifts remains at $19,000" |
| 2027 | not published | See 2.2. The key carries $19,000 forward and marks it unpublished |

The base year 1997 is before 2016, so rule (C) of 2.2 does not apply. The adjustment is the C-CPI-U for
the year before, divided by (CPI for 1997 x C-CPI-U for 2016 / CPI for 2016) (26 U.S.C. 1(f)(3)(A)-(B)).
`annual_exclusion_indexed()` writes that formula out. The price-index values were not available to this
reader (section 12), so the key only checks that every published figure is a multiple of $1,000 and at
least $10,000. The 2024-2026 rows above were also checked against the IRS page "What's new — Estate and
gift tax".

For a spouse who is not a U.S. citizen, the allowance is larger ($185,000 / $190,000 / $194,000 for
2024 / 2025 / 2026; Rev. Procs. 2023-34 s.3.43(2), 2024-40 s.3.43(2), 2025-32 s.4.42(2)). The page does
not enter gifts to a spouse, so this is not used.

## 3. Estate tax for one person

**Rule (the page's formula, which is the law when no gift tax was ever paid).**

    taxable estate = estate - charitable bequests
    tax = max(0, tentative tax(taxable estate + lifetime taxable gifts) - tentative tax(exemption))

> "(b) Computation of tax. The tax imposed by this section shall be the amount equal to the excess (if
> any) of— (1) a tentative tax computed under subsection (c) on the sum of— (A) the amount of the taxable
> estate, and (B) the amount of the adjusted taxable gifts, over (2) the aggregate amount of tax which
> would have been payable under chapter 12 with respect to gifts made by the decedent after December 31,
> 1976, if the modifications described in subsection (g) had been applicable at the time of such gifts.
> For purposes of paragraph (1)(B), the term 'adjusted taxable gifts' means the total amount of the
> taxable gifts (within the meaning of section 2503) made by the decedent after December 31, 1976, other
> than gifts which are includible in the gross estate of the decedent." (26 U.S.C. 2001(b))

> "(a) General rule. A credit of the applicable credit amount shall be allowed to the estate of every
> decedent against the tax imposed by section 2001." ... "(d) Limitation based on amount of tax. The
> amount of the credit allowed by subsection (a) shall not exceed the amount of the tax imposed by section
> 2001." (26 U.S.C. 2010(a), (d))

**What goes into the estate, and what comes off it.**
- Charitable bequests come off: "the value of the taxable estate shall be determined by deducting from
  the value of the gross estate the amount of all bequests, legacies, devises, or transfers— (1) to or for
  the use of the United States, any State ... (2) to or for the use of any corporation organized and
  operated exclusively for religious, charitable, scientific, literary, or educational purposes ..."
  (26 U.S.C. 2055(a), https://uscode.house.gov/us/usc/119-136/t26/s2055/).
- Debts and costs come off: funeral expenses, administration expenses, claims against the estate and
  unpaid mortgages (26 U.S.C. 2053(a)). The key reads the page's "estate" as the net amount after these.
- Life insurance on the person's own life is in the estate when it is paid to the estate, or when the
  person owned the policy: "(1) Receivable by the executor. To the extent of the amount receivable by the
  executor as insurance under policies on the life of the decedent. (2) Receivable by other beneficiaries.
  To the extent of the amount receivable by all other beneficiaries as insurance under policies on the
  life of the decedent with respect to which the decedent possessed at his death any of the incidents of
  ownership ..." (26 U.S.C. 2042). A policy given away within 3 years of death is pulled back in by
  2035(a). Gift tax paid on gifts made within 3 years of death is also added to the gross estate:
  "increased by the amount of any tax paid under chapter 12 by the decedent or his estate on any gift made
  by the decedent or his spouse during the 3-year period ending on the date of the decedent's death"
  (2035(b)). The page models neither 3-year rule.

**Gift tax paid on earlier gifts (not modelled by the page).** Section 2001(b)(2) subtracts the gift tax
that would have been payable on lifetime gifts, figured at today's rates (2001(g)(1)). When lifetime
taxable gifts never went above the exemption, no gift tax was payable, so the page's formula is exactly
the law. When they did, the page's figure is too high by that gift tax (section 10.4).
`single_estate_tax(..., gift_tax_payable=...)` gives the law.

**Who must file an estate tax return** (needed for portability, section 4): "In all cases where the gross
estate at the death of a citizen or resident exceeds the basic exclusion amount in effect under section
2010(c) for the calendar year which includes the date of death, the executor shall make a return", with
that amount "reduced (but not below zero) by ... the amount of the adjusted taxable gifts" (26 U.S.C.
6018(a)(1), (3)). The Instructions for Form 706 (Rev. July 2026) say the same for 2026: "Whose gross
estate, plus adjusted taxable gifts and specific exemption, is more than $15,000,000". The return is due
"within 9 months after the date of the decedent's death" (6075(a)).

## 4. A married couple

### 4.1 The first death: the marital deduction

**Rule.** Everything left to a surviving spouse who is a U.S. citizen comes off the taxable estate, so
the first death owes nothing.

> "For purposes of the tax imposed by section 2001, the value of the taxable estate shall, except as
> limited by subsection (b), be determined by deducting from the value of the gross estate an amount equal
> to the value of any interest in property which passes or has passed from the decedent to his surviving
> spouse, but only to the extent that such interest is included in determining the value of the gross
> estate." (26 U.S.C. 2056(a), https://uscode.house.gov/us/usc/119-136/t26/s2056/)

Two limits that the page assumes away: (b) "life estate or other terminable interest" (an interest that
ends, for example at remarriage, does not qualify unless it fits an exception such as a QTIP trust), and
(d)(1) "if the surviving spouse of the decedent is not a citizen of the United States— (A) no deduction
shall be allowed under subsection (a)", except for property in a "qualified domestic trust" ((d)(2)).

### 4.2 The unused exemption that can pass to the survivor (DSUE, "portability")

> "(4) Deceased spousal unused exclusion amount. For purposes of this subsection, with respect to a
> surviving spouse of a deceased spouse dying after December 31, 2010, the term 'deceased spousal unused
> exclusion amount' means the lesser of— (A) the basic exclusion amount, or (B) the excess of— (i) the
> applicable exclusion amount of the last such deceased spouse of such surviving spouse, over (ii) the
> amount with respect to which the tentative tax is determined under section 2001(b)(1) on the estate of
> such deceased spouse." (26 U.S.C. 2010(c)(4))

> "(c) Computation of the DSUE amount—(1) General rule. ... the DSUE amount of a decedent with a surviving
> spouse is the lesser of the following amounts— (i) The basic exclusion amount in effect in the year of
> the death of the decedent; or (ii) The excess of— (A) The decedent's applicable exclusion amount; over
> (B) The sum of the amount of the taxable estate and the amount of the adjusted taxable gifts of the
> decedent, which together is the amount on which the tentative tax on the decedent's estate is determined
> under section 2001(b)(1). (2) Special rule to consider gift taxes paid by decedent. Solely for purposes
> of computing the decedent's DSUE amount, the amount of the adjusted taxable gifts of the decedent
> referred to in paragraph (c)(1)(ii)(B) of this section is reduced by the amount, if any, on which gift
> taxes were paid for the calendar year of the gift(s)." (26 CFR 20.2010-2(c)(1)-(2),
> https://www.ecfr.gov/current/title-26/section-20.2010-2)

In plain words: the unused part is the first spouse's exemption minus what that spouse used (the taxable
estate plus lifetime taxable gifts), but never more than one basic exclusion amount. With the page's
facts (everything to the spouse, so a taxable estate of 0, and no earlier marriage), this is **DSUE =
exemption - that person's lifetime taxable gifts**, never below 0. That is the page's formula.

The statute says "applicable exclusion amount" of the deceased spouse, not "basic". The 2012 law (Pub. L.
112-240, signed Jan. 2, 2013) made that change: "Pub. L. 112-240 substituted 'applicable exclusion amount'
for 'basic exclusion amount'" (amendment notes of 2010). The two differ only if the first spouse had a
DSUE from an earlier marriage. The page does not model that.

`check_tables()` replays the regulation's own examples: Example 1, "$3,430,000 (the lesser of the
$5,430,000 basic exclusion amount in 2015, or the excess of H's $5,430,000 applicable exclusion amount
over the sum of the $1,000,000 taxable estate and the $1,000,000 amount of adjusted taxable gifts)";
Example 2 (gifts of $2,000,000 with gift tax paid on $1,000,000, again $3,430,000); Example 3 ($3,930,000,
redetermined to $2,130,000).

### 4.3 Portability needs an election on a timely estate tax return

> "(A) Election required. A deceased spousal unused exclusion amount may not be taken into account by a
> surviving spouse under paragraph (2) unless the executor of the estate of the deceased spouse files an
> estate tax return on which such amount is computed and makes an election on such return that such
> amount may be so taken into account. Such election, once made, shall be irrevocable. No election may be
> made under this subparagraph if such return is filed after the time prescribed by law (including
> extensions) for filing such return." (26 U.S.C. 2010(c)(5)(A))

> "the executor of the decedent's estate must elect portability of the DSUE amount on a timely filed Form
> 706 ... the due date of an estate tax return required to elect portability is nine months after the
> decedent's date of death or the last day of the period covered by an extension" (26 CFR 20.2010-2(a),
> (a)(1)). "Upon the timely filing of a complete and properly prepared estate tax return, an executor ...
> will have elected portability ... unless the executor chooses not to elect portability" ((a)(2)).

Relief for late filers, from the Instructions for Form 706 (Rev. July 2026): "Executors who did not have a
filing requirement under section 6018(a) but failed to timely file Form 706 to make the portability
election may be eligible for an extension under Rev. Proc. 2022-32 ... Executors filing to elect
portability may now file Form 706 on or before the fifth anniversary of the decedent's death."

### 4.4 Only the last deceased spouse counts

> "The term last deceased spouse means the most recently deceased individual who, at that individual's
> death after December 31, 2010, was married to the surviving spouse." (26 CFR 20.2010-1(e)(5))
> "If the last deceased spouse of such surviving spouse had no DSUE amount, or if the executor of such a
> decedent's estate did not make a portability election, the surviving spouse's estate has no DSUE amount
> ... even if the surviving spouse previously had a DSUE amount available from another decedent"
> (26 CFR 20.2010-3(a)(2), https://www.ecfr.gov/current/title-26/section-20.2010-3)

So a survivor who remarries and outlives the new spouse loses the first spouse's DSUE, except for any
part already used on gifts (20.2010-3(b)). The page assumes no remarriage.

### 4.5 The second death, and the page's "conservative" rule

**Law, for a known order of death.** Say A dies first and B survives. The survivor's estate is the whole
estate. The amount taxed is the whole estate (less charitable bequests) plus **the survivor's own**
lifetime taxable gifts (2001(b)(1)(B): gifts "made by the decedent"). The exclusion is the survivor's
basic exclusion amount plus A's DSUE with portability, or the basic exclusion amount alone without it.

    A first:  tax = max(0, TT(estate + gifts_B) - TT(E + (E - gifts_A)))      with portability
    B first:  tax = max(0, TT(estate + gifts_A) - TT(E + (E - gifts_B)))

**The page's rule.** The page does not know who dies first. It takes the *smaller* DSUE (the one of the
person with the larger gifts) and adds back the *larger* of the two lifetime gift totals:

    page:     tax = max(0, TT(estate + max(gifts)) - TT(E + min(DSUE)))       (or TT(E) without portability)

Above $1,000,000 everything is in the 40% row, so with portability both real orders give the same
figure, **40% x (estate + gifts_A + gifts_B - 2E)**. The page gives **40% x (estate + 2 x max(gifts) -
2E)**. That is never lower, and it is too high by **40% x |gifts_A - gifts_B|** whenever both figures
are above zero.
Without portability, the page's figure equals the worse of the two orders. The key computes all three
(`couple_estate_tax(method='page' | 'A_first' | 'B_first')`) and checks that the page's figure is never
below either order (section 9.2).

## 5. Gifts: what counts, the yearly allowance, the lifetime exemption

### 5.1 Per giver, per recipient, per calendar year

The allowance applies to "gifts ... made to any person by the donor during the calendar year" (2503(b)(1)):
one allowance per giver and per recipient. Spouses each have their own. Only "present interests" qualify
(an outright gift, or a 529 contribution, which "shall be treated as a completed gift to such beneficiary
which is not a future interest in property", 26 U.S.C. 529(c)(2)(A)(i)). A gift into a trust that the
recipient cannot use now gets no allowance, and a return is needed even if it is small (Instructions for
Form 709 (2025): "Certain gifts, called future interests, are not subject to the $19,000 annual exclusion
and you must file Form 709 even if the gift was under $19,000"). The page treats every entered gift as a
present interest.

    counted(giver, year, recipient) = all gifts that year (plus any 529 fifths landing that year, section 7)
    over = max(0, counted - annual exclusion of that year)
    lifetime exemption used (per giver) = sum of over;   left = max(0, exemption - used)

### 5.2 What is not entered (it does not count)

- **Tuition or medical bills paid directly**: "Any qualified transfer shall not be treated as a transfer
  of property by gift for purposes of this chapter. ... the term 'qualified transfer' means any amount
  paid on behalf of an individual— (A) as tuition to an educational organization described in section
  170(b)(1)(A)(ii) for the education or training of such individual, or (B) to any person who provides
  medical care (as defined in section 213(d)) with respect to such individual as payment for such medical
  care." (26 U.S.C. 2503(e)). The regulation narrows it: "The unlimited exclusion is permitted for tuition
  expenses ... paid directly to the qualifying educational organization ... No unlimited exclusion is
  permitted for amounts paid for books, supplies, dormitory fees, board, or other similar expenses", and it
  "includes amounts paid for medical insurance on behalf of any individual" (26 CFR 25.2503-6(b)(2)-(3)).
  A 529 contribution is *not* a qualified transfer: it "shall not be treated as a qualified transfer
  under section 2503(e)" (529(c)(2)(A)(ii)).
- **Gifts to a spouse**: "Where a donor transfers during the calendar year by gift an interest in
  property to a donee who at the time of the gift is the donor's spouse, there shall be allowed as a
  deduction in computing taxable gifts for the calendar year an amount with respect to such interest equal
  to its value." (26 U.S.C. 2523(a)). For a spouse who is not a citizen, 2523(i) limits this (section 2.3).
- **Gifts to charity** are deducted too (2522(a)). The page has no charity gift entry.

### 5.3 The lifetime exemption and, beyond it, gift tax

The gift tax uses the same rate table on the running total of taxable gifts, less a credit equal to the
tentative tax on the exemption:

> "The tax imposed by section 2501 for each calendar year shall be an amount equal to the excess of— (1) a
> tentative tax, computed under section 2001(c), on the aggregate sum of the taxable gifts for such
> calendar year and for each of the preceding calendar periods, over (2) a tentative tax, computed under
> such section, on the aggregate sum of the taxable gifts for each of the preceding calendar periods."
> (26 U.S.C. 2502(a))

> "there shall be allowed as a credit against the tax imposed by section 2501 for each calendar year an
> amount equal to— (1) the applicable credit amount in effect under section 2010(c) which would apply if
> the donor died as of the end of the calendar year, reduced by (2) the sum of the amounts allowable as a
> credit to the individual under this section for all preceding calendar periods." (26 U.S.C. 2505(a))

So the page's "left = exemption - used" is right while used stays at or under the exemption, and no gift
tax is due. Once used goes above it, nothing is left: each year's credit is the applicable credit amount
"reduced by" the credits allowed for earlier periods (2505(a)(2)) and is never more than that year's tax
(2505(c)), so a used-up credit is 0, not negative. Gift tax is then due at 40% on the excess.
`gift_tax_by_year()` gives that figure. It is not on the page (section 10.9).

## 6. Gift splitting between spouses (26 U.S.C. 2513)

### 6.1 What the consent covers: every gift either spouse made to others that year

> "(1) In general. A gift made by one spouse to any person other than his spouse shall, for the purposes
> of this chapter, be considered as made one-half by him and one-half by his spouse, but only if at the
> time of the gift each spouse is a citizen or resident of the United States. ... an individual shall be
> considered as the spouse of another individual only if he is married to such individual at the time of
> the gift and does not remarry during the remainder of the calendar year. (2) Consent of both spouses.
> Paragraph (1) shall apply only if both spouses have signified (under the regulations provided for in
> subsection (b)) their consent to the application of paragraph (1) **in the case of all such gifts made
> during the calendar year by either while married to the other.**" (26 U.S.C. 2513(a), emphasis added,
> https://uscode.house.gov/us/usc/119-136/t26/s2513/)

> "(b) The provisions of this section will apply to gifts made during a particular 'calendar period' ...
> only if both spouses signify their consent to treat all gifts made to third parties during that
> calendar period by both spouses while married to each other as having been made one-half by each
> spouse. ... (5) ... The consent may not be applied only to a portion of the property interest
> constituting such gifts. ... If the consent is effectively signified on either the husband's return or
> the wife's return, all gifts made by the spouses to third parties (except as described in subparagraphs
> (1) through (4) of this paragraph), during the calendar period will be treated as having been made
> one-half by each spouse." (26 CFR 25.2513-1(b), (b)(5), https://www.ecfr.gov/current/title-26/section-25.2513-1)

> "The consent is effective for the entire calendar year; therefore, all gifts made by either you or your
> spouse to third parties during the calendar year (while you were married) must be split." ...
> "Generally, if you elect to split your gifts, you must split all gifts made by you and your spouse to
> third-party donees. The only exception is if you gave your spouse a general power of appointment over a
> gift you made." (Instructions for Form 709 (2025), Part III and Schedule A column (h),
> https://www.irs.gov/pub/irs-pdf/i709.pdf)

**Answer to the question the page raises: yes.** The consent is all-or-nothing for the calendar year. It
covers every gift to third parties made by either spouse that year, not only the gift marked "split". The
page splits only the marked gift, so it differs from the law whenever the same couple made other gifts to
others that year (section 9.5 and 10.1). The key's `gift_ledger(mode='law')` splits every gift of such a
year. `mode='page'` follows the page.

Conditions: both spouses citizens or residents, married at the time of the gift, and no remarriage later
that year (2513(a)(1)). The consent is given on a gift tax return, and "may not be signified after the
15th day of April following the close of such year, unless before such 15th day no return has been filed
for such year by either spouse" (2513(b)(2)(A)). Once given, "the liability with respect to the entire
tax imposed by this chapter of each spouse for such year shall be joint and several" (2513(d)).

### 6.2 Who files when spouses split

The consent is signified on a return (26 CFR 25.2513-2(a)), and the instructions say "You must file a
gift tax return to split gifts with your spouse (regardless of their amount)". Which spouse files:

> "If both spouses are (without regard to the provisions of section 2513) required under the provisions
> of § 25.6019-1 to file returns, returns must be filed by both spouses. If only one of the consenting
> spouses is (without regard to the provisions of section 2513) required under § 25.6019-1 to file a
> return, a return must be filed by that spouse. In the latter case if, after giving effect to the
> provisions of section 2513, the other spouse is considered to have made a gift not excluded from the
> total amount of such other spouse's gifts for the taxable year by reason of section 2503 (b) or (e) ...,
> a return must also be filed by such other spouse." (26 CFR 25.6019-2,
> https://www.ecfr.gov/current/title-26/section-25.6019-2)

The Instructions for Form 709 (2025) put it as a general rule with two exceptions. "In general, if you and
your spouse elect gift splitting, then both spouses must file their own individual gift tax return." The
donor spouse files alone if "Exception 1 ... Only one spouse made any gifts, The total value of these gifts
to each third-party donee does not exceed $38,000, and All of the gifts were of present interests", or
"Exception 2 ... Only one spouse (the donor spouse) made gifts of more than $19,000 but not more than
$38,000 to any third-party donee, The only gifts made by the other spouse (the consenting spouse) were
gifts of not more than $19,000 to third-party donees other than those to whom the donor spouse made gifts,
and All of the gifts by both spouses were of present interests."

The two sources agree in the usual cases, and `check_tables()` replays both. They part in one corner: the
consenting spouse made a small gift to *the same* recipient, and after splitting stays within the
allowance. The regulation then needs only the donor's return, while Exception 2 (different recipients
only) would send both. **The key follows the regulation**, which is the law, and records the
instructions' stricter wording here.

## 7. 529 college savings: the five-year election (26 U.S.C. 529(c)(2)(B))

> "(B) Treatment of excess contributions. If the aggregate amount of contributions described in
> subparagraph (A) during the calendar year by a donor exceeds the limitation for such year under section
> 2503(b), such aggregate amount shall, at the election of the donor, be taken into account for purposes
> of such section ratably over the 5-year period beginning with such calendar year." (26 U.S.C.
> 529(c)(2)(B), https://uscode.house.gov/us/usc/119-136/t26/s529/)

The statute has no cap. The cap at five times the allowance comes from the proposed regulation of 1998,
which was never made final, and from the IRS's 2008 advance notice and its current instructions:

> "(i) Under section 529(c)(2)(B) a donor may elect to take certain contributions to a QSTP into account
> ratably over a five year period in determining the amount of gifts made during the calendar year. The
> provision is applicable only with respect to contributions not in excess of five times the section
> 2503(b) exclusion amount available in the calendar year of the contribution. Any excess may not be taken
> into account ratably and is treated as a taxable gift in the calendar year of the contribution. (ii) The
> election under section 529(c)(2)(B) may be made by a donor and his or her spouse with respect to a gift
> considered to be made one-half by each spouse under section 2513. (iii) The election is made on Form
> 709, Federal Gift Tax Return, for the calendar year in which the contribution is made. (iv) If in any
> year after the first year of the five year period described in section 529(c)(2)(B), the amount
> excludible under section 2503(b) is increased as provided in section 2503(b)(2), the donor may make an
> additional contribution in any one or more of the four remaining years up to the difference between the
> exclusion amount as increased and the original exclusion amount ..." (proposed 26 CFR 1.529-5(b)(2),
> 63 FR 45019 at 45031, Aug. 24, 1998, https://www.govinfo.gov/content/pkg/FR-1998-08-24/pdf/98-22465.pdf)

Its example: "In Year 1, when the annual exclusion under section 2503(b) is $10,000, P makes a
contribution of $60,000 ... P is treated as making an excludible gift of $10,000 in each of Years 1
through 5 and a taxable gift of $10,000 in Year 1. In Year 3, when the annual exclusion is increased to
$12,000, P makes an additional contribution ... of $8,000. P is treated as making an excludible gift of
$2,000 under section 2503(b); the remaining $6,000 is a taxable gift in Year 3."

The 2008 advance notice (REG-127127-05, 73 FR 3441 at 3445, Jan. 18, 2008,
https://www.govinfo.gov/content/pkg/FR-2008-01-18/pdf/E8-859.pdf) repeats it as "Rule 2. The election
applies to contributions ... that exceed the gift tax exclusion amount for that year but are not in
excess of five times the exclusion amount for the year. Any excess may not be taken into account ratably
and is treated as a taxable gift in the calendar year of the contribution." Its Example B: "$65,000 ...
only with respect to that portion of the contributions that is not in excess of $60,000 (5 × $12,000).
The $5,000 excess will be treated as a taxable gift by the contributor in 2007."

The Instructions for Form 709 (2025), Schedule A, Line B:

> "If in 2025, you contributed more than $19,000 to a qualified tuition plan (QTP) on behalf of any one
> person, you may elect to treat up to $95,000 of the contribution for that person as if you had made it
> ratably over a 5-year period. ... You must report all of your 2025 QTP contributions for any single
> person that exceed $95,000 (in addition to any other gifts you made to that person). For each of the 5
> years, you report one-fifth (20%) of the amount for which you made the election ... However, if in any of
> the last 4 years of the election, you did not make any other gifts that would require you to file a Form
> 709, you do not need to file Form 709 to report that year's portion of the election amount." ... "If you
> are electing gift splitting, apply the gift-splitting rules before applying the QTP rules. Each spouse
> would then decide individually whether to make this QTP election."

Its example (Pat): $100,000 in 2025, $95,000 elected, so 2025 shows "$5,000 (the amount of the
contribution that exceeded $95,000) + $19,000 (the 1/5 portion from the election) = $24,000". In 2026
Pat reports a $20,000 cash gift to Alex and the $19,000 fifth for Max. For 2027-2029, "Pat is not required
to file Form 709 in any of those years".

**The rule the key applies**, per giver (after splitting) and per recipient. Let C be that year's 529
contributions in total, and X that year's allowance.
- The election is possible only if C > X (the statute's "exceeds"). Then elected = min(C, 5X), and
  excess = C - elected.
- elected / 5 is counted in each of the five years starting with this one. The excess is counted in this
  year. Both are added to any other gifts to the same recipient in the same year.
- In years 2-5 the fifth is compared with *that* year's allowance, so a higher later allowance leaves
  room for more (proposed 1.529-5(b)(2)(iv)).
- If the giver dies during the five years, "the gross estate of the donor shall include the portion of
  such contributions properly allocable to periods after the date of death of the donor" (529(c)(4)(C)).
  The page does not model this.

## 8. The gift tax return (Form 709): who must file and when

> "Any individual who in any calendar year makes any transfer by gift other than— (1) a transfer which
> under subsection (b) or (e) of section 2503 is not to be included in the total amount of gifts for such
> year, (2) a transfer of an interest with respect to which a deduction is allowed under section 2523, or
> (3) a transfer with respect to which a deduction is allowed under section 2522 but only if— (A)(i) such
> transfer is of the donor's entire interest in the property transferred, ... shall make a return for such
> year with respect to the gift tax imposed by subtitle B." (26 U.S.C. 6019,
> https://uscode.house.gov/us/usc/119-136/t26/s6019/)

"The return is required even though, because of the deduction authorized by section 2522 (charitable
deduction) or the unified credit under section 2505, no tax may be payable on the transfer." (26 CFR
25.6019-1(f)). In plain words, a return is due for a year when any gift to someone other than a spouse
went over the allowance, even though no tax is owed because the lifetime exemption covers it.

> "Who does not need to file. If you meet all of the following requirements, you are not required to file
> Form 709. • You made no gifts during the year to your spouse. • You did not give more than $19,000 to any
> one donee. • All the gifts you made were of present interests." (Instructions for Form 709 (2025))

(The statute and 26 CFR 25.6019-1(a) need no return for a gift to a spouse that is fully deductible under
2523, other than a QTIP election. The instructions' first point is broader. The page does not enter gifts
to a spouse.)

**When.** "Returns made under section 6019 (relating to gift taxes) shall be filed on or before the 15th
day of April following the close of the calendar year." An extension for the income tax return extends
the gift tax return too. In the year of the giver's death, the return is due no later than the estate tax
return (26 U.S.C. 6075(b)(1)-(3); 26 CFR 25.6075-1).

**The page's rule** (a return in a year with anything over, a split gift, or a 529 election starting)
matches the law at the household level:
- over > 0 means a gift above the allowance (6019(1));
- a split needs a return to signify consent (6.2);
- the 529 election "is made on Form 709 ... for the calendar year in which the contribution is made"
  (proposed 1.529-5(b)(2)(iii); I709 Line B);
- years 2-5 of an election need no return unless something else requires one (I709 Line B).
The key also says *which* spouse files (`gift_ledger(...)['filers']`, section 6.2). The page does not.

## 9. Worked examples (invented households)

All figures below are checked by `_check_examples()` in `rules.py`.

### 9.1 One person, estate over the exemption, with gifts and a charity bequest

Morgan, single, dies in 2026. The estate after debts and costs is **$18,000,000**. The will leaves
**$1,000,000** to a charity. Over a lifetime Morgan made **$2,500,000** of taxable gifts (the amounts over
the yearly allowances), and never paid gift tax.

| Step | Amount |
|---|---|
| Taxable estate = 18,000,000 - 1,000,000 | $17,000,000 |
| Plus lifetime taxable gifts | $19,500,000 |
| Tentative tax = 345,800 + 40% x (19,500,000 - 1,000,000) | $7,745,800 |
| Credit = tentative tax on the 2026 exemption $15,000,000 = 345,800 + 40% x 14,000,000 | $5,945,800 |
| **Estate tax** | **$1,800,000** (= 40% x 4,500,000) |

The same facts with a death in 2025 (exemption $13,990,000) give $2,204,000, and in 2024 ($13,610,000)
$2,356,000. With an estate of $12,000,000 and $3,000,000 of gifts, the total is exactly $15,000,000 and
the tax is $0. Smaller estates give $0, never a negative number.

*Gift tax paid (the law, not on the page).* Suppose instead Morgan gave away $16,000,000 in 2026, paid gift
tax of 40% x $1,000,000 = $400,000, and left a $5,000,000 estate. The page computes 40% x (21,000,000 -
15,000,000) = **$2,400,000**. The law subtracts the gift tax payable (2001(b)(2)): $8,345,800 - $400,000 -
$5,945,800 = **$2,000,000**. (If the gifts were within 3 years of death, 2035(b) would add the $400,000 to
the gross estate: +$160,000.)

### 9.2 A couple, with and without portability

Jordan (A) and Casey (B) are married U.S. citizens with a combined estate of **$40,000,000** and no
charity bequest. Lifetime taxable gifts: Jordan **$3,000,000**, Casey **$1,000,000**. Exemption (2026):
E = $15,000,000.

- First death: everything goes to the survivor, so the taxable estate is $0 and the tax is **$0**.
- DSUE if Jordan dies first: 15,000,000 - 3,000,000 = **$12,000,000**. If Casey dies first:
  15,000,000 - 1,000,000 = **$14,000,000**.

| Second death | Amount taxed | Exclusion | Tax |
|---|---|---|---|
| **Page, portability** (smaller DSUE, larger gifts) | 40,000,000 + 3,000,000 = 43,000,000 | 15,000,000 + 12,000,000 = 27,000,000 | **$6,400,000** |
| Law, Jordan first (Casey survives, Casey's gifts) | 41,000,000 | 15,000,000 + 12,000,000 = 27,000,000 | $5,600,000 |
| Law, Casey first (Jordan survives, Jordan's gifts) | 43,000,000 | 15,000,000 + 14,000,000 = 29,000,000 | $5,600,000 |
| **Page, no portability** | 43,000,000 | 15,000,000 | **$11,200,000** |
| Law, Jordan first, no portability | 41,000,000 | 15,000,000 | $10,400,000 |
| Law, Casey first, no portability | 43,000,000 | 15,000,000 | $11,200,000 |

Check of the page line: TT(43,000,000) = $17,145,800 and TT(27,000,000) = $10,745,800, which differ by
$6,400,000. The page is $800,000 above both real orders, which is 40% x (3,000,000 - 1,000,000), as in
4.5. Electing portability saves $4,800,000 on the page's figures. With no gifts and a $28,000,000 estate,
portability brings the tax from $5,200,000 to $0.

### 9.3 A split gift

In 2026 Jordan gives a daughter **$38,000** from Jordan's own account, and the couple elect to split it.

- Split: $19,000 from each spouse. Each equals the 2026 allowance, so nothing is over and no exemption is
  used.
- A Form 709 is needed for 2026 (the split is made on a return). Under the law only Jordan files: Jordan
  alone would have had to file ($38,000 > $19,000), while Casey's half is fully within the allowance
  (25.6019-2; I709 Exception 1).
- Without the split, Jordan would be $19,000 over: exemption used $19,000, left $14,981,000.
- A $40,000 gift "from both": $20,000 each, so each spouse is $1,000 over, and both file.

### 9.4 A 529 front-load over the five-year cap

In 2026 Casey puts **$120,000** into a 529 plan for a grandson and makes the five-year election. In 2027
Casey also gives the grandson **$5,000** cash. Allowance: $19,000 in 2026, carried forward to $19,000 for
2027-2030 (not published yet).

| | 2026 | 2027 | 2028 | 2029 | 2030 |
|---|---|---|---|---|---|
| Cap 5 x 19,000 = 95,000 elected, so 1/5 = | 19,000 | 19,000 | 19,000 | 19,000 | 19,000 |
| Excess 120,000 - 95,000, first year | 25,000 | | | | |
| Other gifts | | 5,000 | | | |
| Counted | 44,000 | 24,000 | 19,000 | 19,000 | 19,000 |
| **Over** | **25,000** | **5,000** | 0 | 0 | 0 |
| Form 709 | yes (over, and the election) | yes (over) | no | no | no |

Exemption used: $30,000, left $14,970,000.

If the same $120,000 is given "from both" spouses: $60,000 each. That is above $19,000, so each may elect,
and $12,000 a year each stays within the allowance. Nothing is over. A return is needed for 2026 (split,
and two elections), and both spouses file.

### 9.5 One gift marked split while the same couple made other gifts

In 2026: Jordan gives a son **$38,000** and marks it split. Jordan also gives a nephew **$50,000**, and
Casey gives a friend **$25,000**. Neither of those two is marked split.

| Recipient | Page (only the marked gift is split) | Law (the consent covers every gift of 2026) |
|---|---|---|
| Son | Jordan 19,000, Casey 19,000; over 0 | the same |
| Nephew | Jordan 50,000; **over 31,000** | Jordan 25,000, Casey 25,000; **over 6,000 each** |
| Friend | Casey 25,000; **over 6,000** | Jordan 12,500, Casey 12,500; over 0 |
| Exemption used | Jordan 31,000, Casey 6,000 (total 37,000) | Jordan 6,000, Casey 6,000 (total 12,000) |
| Exemption left | Jordan 14,969,000, Casey 14,994,000 | 14,994,000 each |

Under the law both spouses file for 2026 (each would have had to file alone: Jordan for the son and the
nephew, Casey for the friend). The page overstates the exemption used by $25,000 in total, and puts it on
the wrong spouse. Because the yearly allowance is applied per person, splitting everything can only lower
the total over or leave it the same. It can still move some of it onto the other spouse, as here, where
Casey's share of the nephew's gift costs Casey $6,000.

## 10. Where the page's model and the law differ (to record, not to "fix" in the key)

1. **Gift splitting is all-or-nothing per year** (6.1). The page splits only the marked gift. The law
   splits every gift either spouse made to others that year (2513(a)(2); 25.2513-1(b)(5); I709). Section
   9.5 shows the effect.
2. **The couple's "conservative" figure** (4.5) is above the law for either order of death by 40% x the
   difference of the two lifetime gift totals, with portability, whenever tax is due. Without portability
   it equals the worse order. The page also uses one year's exemption for both deaths. The law uses the
   exemption of each death's own year, and the DSUE is capped at the basic exclusion amount of the first
   death's year (20.2010-2(c)(1)(i)).
3. **2027 and later.** The page carries the newest figure forward. The law indexes both the exemption
   (2010(c)(3)(B), base year 2025, nearest $10,000) and the yearly allowance (2503(b)(2), base 1997, down
   to $1,000). The IRS had not published the 2027 figures by 2026-10-31.
4. **Gift tax already paid** is not subtracted by the page (2001(b)(2)). For someone whose gifts went over
   the exemption, the page's estate tax is too high by the gift tax payable, less 40% of any gift tax that
   2035(b) adds back for gifts within 3 years of death (9.1).
5. **529 election below the allowance.** The statute allows the election only when the year's
   contributions for that recipient are above the allowance ("exceeds"). If the page spreads a smaller
   contribution, it differs. The key's law track does not spread it, and its page track does (and then
   calls for a return).
6. **Which spouse files** a Form 709 in a split year (6.2) is not on the page. The page's household-level
   "a return is needed" agrees with the law.
7. **"The first death owes nothing"** holds only when everything passes to a U.S.-citizen spouse
   outright, or in a form that qualifies (2056(b), (d)). Bequests to others at the first death would use
   exemption and lower the DSUE. Portability also needs a timely Form 706 (2010(c)(5)(A)), with late
   relief up to the fifth anniversary under Rev. Proc. 2022-32 for estates not otherwise required to file.
8. **Only present-interest gifts** get the allowance. A gift in trust without a present right gets none,
   and needs a return (2503(b)(1); I709).
9. **Gifts above the exemption.** Left is 0 once used passes the exemption (the page floors it there too; its
   README's formula omits the floor). The law then charges gift tax at 40% on the excess, that year (2502,
   2505), which the page does not show. `gift_tax_by_year()` gives it.
10. **Remarriage.** DSUE comes only from the last deceased spouse (20.2010-3(a)). The page assumes the
    survivor does not remarry and outlive a new spouse.
11. **A "from both" gift of jointly owned or community property** is half each by ownership, without
    any election (I709: "If a gift is of community property, it is considered made one-half by each
    spouse"). The page and the key treat "from both" as a split gift, so it also triggers the year-wide
    consent on the key's law track (convention 11.6).
12. **Outside the page:** state estate and inheritance taxes, the generation-skipping transfer tax, the
    regulation's "anti-clawback" rule for an exemption that falls after gifts were made (20.2010-1(c)),
    the 529 inclusion at death within five years (529(c)(4)(C)), and the Trump-account transfer tax safe
    harbor (Rev. Proc. 2026-25).

## 11. Conventions the key adopts where no source decides

1. **Exact arithmetic.** Money is an exact `Fraction`. The tentative tax and the 529 fifths are not
   rounded (no rounding rule was found for them; a fifth of $50,001 is $10,000.20). Display rounds to the
   cent, half up.
2. **Ties in "nearest multiple of $10,000"** (2010(c)(3)(B)) go up. The statute has no rule for an exact
   $5,000.
3. **"Estate"** is the page's figure: the gross estate after debts and costs (2053), including life
   insurance the person owns on his or her own life (2042).
4. **Couple model:** both spouses are U.S. citizens, married to each other only, with no earlier DSUE.
   Everything goes to the survivor at the first death, so the first death's taxable estate is $0. The
   exemption is the same for both deaths (today's dollars). Charitable bequests come off at the second
   death. Portability, when chosen, is elected on time.
5. **Law track of gift splitting:** any gift marked split, or given "from both", in a calendar year
   counts as the couple's consent for that year. Every gift either spouse made to others that year is
   then halved.
6. **"From both"** gifts are halved and treated as split gifts (the page's reading), not as joint
   property (10.11).
7. **529 fifths** stay with the giver(s) of the contribution year. A consent in a later year does not
   re-split them (no source decides; proposed 1.529-5(b)(2)(ii) ties the split to the contribution).
8. **Who files when nobody would otherwise have to** but a gift is marked split: the giver(s) of the
   marked gifts file, because consent can only be signified on a return (25.2513-2(a); I709).
9. **The regulation over the instructions** in the one corner where 25.6019-2 and the Form 709
   instructions part (6.2).
10. **Every entered gift is a present interest.** No generation-skipping transfers.
11. **After 2026** the 2026 figures are used and marked unpublished (`basic_exclusion()` and
    `annual_exclusion()` return `published=False`).

## 12. What could not be verified

- **The 2027 figures** (basic exclusion amount, annual exclusion): not published by the IRS by 2026-10-31
  (2.2). Not invented; carried forward and flagged.
- **The price-index values** needed to rebuild any indexed figure from the statute: the BLS API refused
  ("daily threshold ... has been reached"), and download.bls.gov answered HTTP 403. So the 2024-2026
  exemption and allowance are taken from the revenue procedures, checked against the IRS's own tables and
  for the statute's rounding, but not recomputed.
- **The five-times cap** rests on a proposed regulation (1998) that was never made final, the 2008
  advance notice, and the Form 709 instructions. All three agree, but none is a final regulation. The
  statute itself sets no cap.
- **Rounding** of the tentative tax and of 529 fifths: no source found (convention 11.1).
- **"Nearest $10,000" ties**: no source (convention 11.2).
- The 2026 and 2027 Form 709 instructions are not out. The key uses the 2025 instructions, whose rules
  (not their dollar figures) are assumed unchanged. The instructions for Form 706 used are Rev. July 2026.

## 13. Sources (all read 2026-10-31)

| Tag | Source | Address | sha256 of the copy read |
|---|---|---|---|
| USC2001 | 26 U.S.C. 2001, OLRC, current through Pub. L. 119-136 (Oct 22, 2026) | https://uscode.house.gov/us/usc/119-136/t26/s2001/ | e2374b82...c1a589f685 |
| USC2010 | 26 U.S.C. 2010, same edition | https://uscode.house.gov/us/usc/119-136/t26/s2010/ | e78ecd59...180b94b5ec |
| USC2055 | 26 U.S.C. 2055, same edition | https://uscode.house.gov/us/usc/119-136/t26/s2055/ | 610e5323...3b1c21c3d4 |
| USC2056 | 26 U.S.C. 2056, same edition | https://uscode.house.gov/us/usc/119-136/t26/s2056/ | b2b0271d...33540c9014 |
| USC2042 | 26 U.S.C. 2042, same edition | https://uscode.house.gov/us/usc/119-136/t26/s2042/ | 792458ad...53b6a8803a |
| USC2035 | 26 U.S.C. 2035, same edition | https://uscode.house.gov/us/usc/119-136/t26/s2035/ | 96f7f720...c27a6bd4c3 |
| USC2053 | 26 U.S.C. 2053, same edition | https://uscode.house.gov/us/usc/119-136/t26/s2053/ | 39829912...3aa18dc8eb |
| USC2502 | 26 U.S.C. 2502, same edition | https://uscode.house.gov/us/usc/119-136/t26/s2502/ | 8c79a35b...ec3f0e98a8 |
| USC2503 | 26 U.S.C. 2503, same edition | https://uscode.house.gov/us/usc/119-136/t26/s2503/ | 8ed278a2...47bb78f2a0 |
| USC2505 | 26 U.S.C. 2505, same edition | https://uscode.house.gov/us/usc/119-136/t26/s2505/ | 755f50f0...0ab0d8e823 |
| USC2513 | 26 U.S.C. 2513, same edition | https://uscode.house.gov/us/usc/119-136/t26/s2513/ | 1b277ab1...5eabd3fed6 |
| USC2522 | 26 U.S.C. 2522, same edition | https://uscode.house.gov/us/usc/119-136/t26/s2522/ | 9a26b287...c56f44346b |
| USC2523 | 26 U.S.C. 2523, same edition | https://uscode.house.gov/us/usc/119-136/t26/s2523/ | 06a45756...563d4d8a71 |
| USC529 | 26 U.S.C. 529, same edition | https://uscode.house.gov/us/usc/119-136/t26/s529/ | 3b8244e8...7656bb9c1e |
| USC6018 | 26 U.S.C. 6018, same edition | https://uscode.house.gov/us/usc/119-136/t26/s6018/ | 8d14f3e1...b039464829 |
| USC6019 | 26 U.S.C. 6019, same edition | https://uscode.house.gov/us/usc/119-136/t26/s6019/ | 078429fd...057b13be0a |
| USC6075 | 26 U.S.C. 6075, same edition | https://uscode.house.gov/us/usc/119-136/t26/s6075/ | 007952bc...122c160520 |
| USC1 | 26 U.S.C. 1(f), same edition | https://uscode.house.gov/us/usc/119-136/t26/s1/ | acce504c...3ce7938060 |
| PL11921 | Pub. L. 119-21, s.70106 | https://www.govinfo.gov/content/pkg/PLAW-119publ21/html/PLAW-119publ21.htm | 84000b07...c584e9004d |
| CGLAWS | congress.gov API, laws of the 119th Congress (highest Pub. L. 119-136) | https://api.congress.gov/v3/law/119 | 1a841288...d1661a36be |
| ECFR | eCFR title 26 currency ("up to date as of 2026-10-29") | https://www.ecfr.gov/api/versioner/v1/titles.json | b649b378...71de4d4618 |
| CFR20101 | 26 CFR 20.2010-1 | https://www.ecfr.gov/current/title-26/section-20.2010-1 | 4d7ee6a1...9330e075b0 |
| CFR20102 | 26 CFR 20.2010-2 | https://www.ecfr.gov/current/title-26/section-20.2010-2 | bbc18435...16087e8557 |
| CFR20103 | 26 CFR 20.2010-3 | https://www.ecfr.gov/current/title-26/section-20.2010-3 | f47f79d6...1a072cd024 |
| CFR25032 | 26 CFR 25.2503-2 | https://www.ecfr.gov/current/title-26/section-25.2503-2 | e8889f4b...edf97a9bd9 |
| CFR25036 | 26 CFR 25.2503-6 | https://www.ecfr.gov/current/title-26/section-25.2503-6 | afac0dd5...0a4acf6f08 |
| CFR25052 | 26 CFR 25.2505-2 | https://www.ecfr.gov/current/title-26/section-25.2505-2 | d20d68a0...6a5a0ac736 |
| CFR25131 | 26 CFR 25.2513-1 | https://www.ecfr.gov/current/title-26/section-25.2513-1 | 2cfab4b1...fc4a902e28 |
| CFR25132 | 26 CFR 25.2513-2 | https://www.ecfr.gov/current/title-26/section-25.2513-2 | 1eef2767...80ba4eb65d |
| CFR60191 | 26 CFR 25.6019-1 | https://www.ecfr.gov/current/title-26/section-25.6019-1 | 90abc4da...1008355a68 |
| CFR60192 | 26 CFR 25.6019-2 | https://www.ecfr.gov/current/title-26/section-25.6019-2 | 2db1c278...5617aa66eb |
| CFR60751 | 26 CFR 25.6075-1 | https://www.ecfr.gov/current/title-26/section-25.6075-1 | 238ef640...6bbbb31184 |
| FR98 | Proposed rule REG-106177-97, 63 FR 45019 (Aug 24, 1998), prop. 1.529-5 | https://www.govinfo.gov/content/pkg/FR-1998-08-24/pdf/98-22465.pdf | 9e28a4d5...e33bb20a93 |
| FR08 | Advance notice REG-127127-05, 73 FR 3441 (Jan 18, 2008) | https://www.govinfo.gov/content/pkg/FR-2008-01-18/pdf/E8-859.pdf | 064f764d...cf803142c9 |
| RP2334 | Rev. Proc. 2023-34 (2024 figures) | https://www.irs.gov/pub/irs-drop/rp-23-34.pdf | 544ba41c...52d5aaae57 |
| RP2440 | Rev. Proc. 2024-40 (2025 figures) | https://www.irs.gov/pub/irs-drop/rp-24-40.pdf | 4de9db6b...d4c302af1f |
| RP2532 | Rev. Proc. 2025-32 (2026 figures) | https://www.irs.gov/pub/irs-drop/rp-25-32.pdf | e9ada115...a96214635b |
| IR25103 | IRS news release IR-2025-103 (Oct 9, 2025) | https://www.irs.gov/newsroom/irs-releases-tax-inflation-adjustments-for-tax-year-2026-including-amendments-from-the-one-big-beautiful-bill | c96c12ca...80d0deeda5 |
| IRSWN | IRS "What's new — Estate and gift tax" (last reviewed 23-Jul-2026) | https://www.irs.gov/businesses/small-businesses-self-employed/whats-new-estate-and-gift-tax | 0c16c80d...786afc7777 |
| I709 | Instructions for Form 709 (2025) | https://www.irs.gov/pub/irs-pdf/i709.pdf | 7de1ce38...8a47b75bcf |
| I706 | Instructions for Form 706 (Rev. July 2026) | https://www.irs.gov/pub/irs-pdf/i706.pdf | 8121d049...84e03d1c92 |
| RP2625 | Rev. Proc. 2026-25 (Trump accounts, out of scope) | https://www.irs.gov/pub/irs-drop/rp-26-25.pdf | ccc5c989...1d42d22884 |
| IRSNR10 | IRS news releases, October 2026 (last reviewed 29-Oct-2026) | https://www.irs.gov/newsroom/news-releases-for-current-month | df1ffd31...d013176a19 |
| IRSNR09 | IRS news releases, September 2026 | https://www.irs.gov/newsroom/news-releases-for-september-2026 | 443ad8a9...ebc101c13e |
| IRB | Internal Revenue Bulletin index (newest 2026-45, Nov 2, 2026) | https://www.irs.gov/irb | e4c21969...d9a23c60eb |
| IRB2645 | Internal Revenue Bulletin 2026-45 | https://www.irs.gov/irb/2026-45_IRB | 1c15b7c4...a87655769c |
