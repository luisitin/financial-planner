# Federal estimate  (`taxes/federal`)

**Status:** usable (phase 6)
**Purpose:** This year's federal income tax from what the plan knows and what you type: the bill or refund, your effective and marginal rates.

## Inputs
`household` (filing status, people's birth dates for the age allowance and dependents), `income` (pay, bonuses, pensions, Social Security, self-employment, rent, "other"; items marked not taxable are skipped), `retirement.contributions` (pre-tax 401(k) money comes off wages up to the limit; IRA and HSA contributions are adjustments up to theirs), `taxes.thisYear` (figures the plan cannot see: a wages override, IRA and 401(k) withdrawals this year (`iraWithdrawals`, round 8: blank = the plan's required withdrawal), other ordinary income, qualified dividends, tax-exempt interest, a Social Security override, other adjustments, withheld, other payments), `taxes.itemized`, `taxes.gains` (from the Capital gains page), `taxes.estimated.paid`, `taxes.year` (null = this year), `taxes.dependentsUnder17` / `otherDependents` / `blind` (null = counted from People), `taxes.hsa` (`contribution`, `employer`, `coverage`, `coveredId`, `fsa`: the HSA and FSA page), `expenses` (care for a child, for the child and dependent care credit), `whatIfs.benefits[adultId].dcfsaElect` / `planYear` (the child care account chosen on Benefits elections). The page's figures (`known.js`, round 8) also read `property` (rentals), `equity` (stock units), `debts` (student loans), the Self-employment page's expenses and the Required withdrawals page.

## Outputs
`taxInputs()` (shared by every tax page): `year`, `params` (the year's table, indexed past the last one), `filingStatus`, `inputs` for `federalTax`, `sources[]` (each figure and where it came from), `itemized` (total after caps, lines), `people` (ages65plus, dependents), `gains` (netted), `pretax401k` (the 401(k) money taken off wages), `k401` (`people[]`: id, name, age, pay, compensation, pretax, roth, limit, catchUp, excluded, inIncome; `excluded`, `inIncome`, `year`), `ira` (`people[]`: traditional, limit, deductible; `deductible`, `over`), `fsa` (election, limit, excluded, over, `offWages`: what came off wages, 0 when wages are typed), `hsa` (`picture`: `hsaPicture` of `retirement/contributions`; `payroll`, `employer`, `excess`, `deducted`: the adjustment, `employerTaxed`: employer money over the limit added to wages), `payTotal`, `wagesTyped`, `wagesPlan` (the wages the Income page implies, the account's money off by the one rule even when box 1 is typed: Budget's yearTaxes), `care` (last; `expenses`, `persons`, `benefits`, `earnedLow` as passed to the engine in `inputs.care` when there is care and a child to count, plus `lines` (the care counted), `expensesAll` / `linesAll` (all the care paid in the year), `kids`, `turning13` ([{ id, name, until }]), `undated`, `elected`, `later` (accounts chosen for another plan year), `benefitLimit`, `offWages` (the account money taken off wages: excluded + forfeited), `forfeited`, `taxedAsPay`, `account` (`careAccountRule`), `earnedPeople` ([{ id, name, pay, wages, business, earned, typed, elected, excluded, forfeited, taxedAsPay }]), `joint`, `spouseUnknown`, `filerId`, `wagesTyped`; null for a year without the figures). `careAccountRule`, `careAccount(plan, { year, today })` and `careInputsWith(ti, changes, elections)`: the child care account's one rule and its what-ifs (see the care section). `ratePct(x)`: a rate as the page shows it. `compute()` adds `result` (`federalTax`: income, taxable Social Security, AGI, deduction used, taxable income, ordinary and gains tax, credits, NIIT, additional Medicare, total, effective rate, bracket, room, balance), `marginal` (the true cost of the next 1,000), `nextDollar` (what the page shows: over whole steps of the child care credit when it counts, else `marginal`), `careFalls`, `careSets` ("covers" | "falls" | null) and `nextDollarNoCare`, `steps[]` (the walk from income to tax), `years`, `isIndexed`.

## Formulas
`core/math/tax.js`, parameter-driven from `data/federal.js` (2024 and 2025 extracted from the vendored UsTaxes project, which is AGPL-3.0, by `tools/extract-tax.mjs`: only the figures, which are the IRS's (Rev. Proc. 2023-34 for 2024; Rev. Proc. 2024-40 for 2025, with Pub. L. 119-21's standard deduction and $2,200 child credit, Rev. Proc. 2025-32 sec. 3.01); 2026 typed from Rev. Proc. 2025-32 sec. 4, the SSA's wage base and the statute: SALT IRC 164(b)(7), senior deduction 151(f), charity 170(b)(1)(I) and 170(p), the 37% limit 68; the full list is at the top of the tool, read 2026-10-31). The tool applies two rules of law the vendored worksheet figures leave out, and on 2026-10-31 they were applied to `data/federal.js` by hand in the same change because `vendor/` is not in every clone: the child credit phase-out is 400,000 only on a joint return and 200,000 for a qualifying surviving spouse (IRC 24(b)(2)); a separate return has no Social Security base amount, so up to 85% of benefits is taxed from the first dollar (IRC 86(c)(1)(C)(ii), (c)(2)(C)), unless the spouses lived apart all year (`taxes.livedApart`, ticked under Year and people), which takes the single figures. The wage base of a year SSA has published but the tables do not have yet (2027: 192,300) comes from `retirement/social-security/data/ssa.js`. Ordinary brackets; standard deduction plus the age/blindness allowance, or itemized when larger (state and local taxes capped, 2025-2029 OBBB cap with the phase-out over 500,000, 30 cents a dollar; on a separate return the cap, its floor and the start are halved, the rate is not; medical over 7.5% of AGI; from 2026 gifts to charity count only above 0.5% of AGI, and itemized deductions lose 2/37 of the smaller of themselves and the income over the 37% bracket's start, IRC §68); from 2026 people who take the standard deduction also deduct up to 1,000 (2,000 joint) of cash gifts (IRC §170(p)); the 2025-2028 senior deduction (6,000 a person 65+, each person's 6,000 cut by 6% of AGI over 75,000/150,000; none on a separate return, FS-2025-03); qualified dividends and long-term gains stacked on top at 0/15/20%; the Social Security benefits worksheet (provisional income = other income + tax-exempt interest + half the benefits; up to 50% taxable between the base and the second threshold, up to 85% above; thresholds not indexed); the child tax credit (2,000 in 2024, 2,200 from 2025; 500 for other dependents; phased out 50 per 1,000 over 200,000/400,000; refundable up to 1,700 a child at 15% of earned income over 2,500); NIIT 3.8% on investment income over 200,000/250,000/125,000; additional Medicare 0.9% on Medicare wages over the same thresholds (`medicareWages`: pay and bonuses before pre-tax 401(k) saving, W-2 box 5, IRC 3121(v)(1)(A), less the health FSA and the HSA payroll money within the limit, 3121(a)(5)(G); typed wages are taken as they are; the engine falls back to wages when none are given). The gains worksheet's last line: the tax is never more than the regular tax on all of taxable income. Gains netting as Schedule D: short and long offset each other, a net loss takes up to 3,000 (1,500 separately) off any income, wages included (`capitalLoss`, IRC §1211(b)), the rest carries forward. The amount carried (`carryoverWorksheet`, `lossCarryover`, shown in the steps and on the Capital gains page) follows the Capital Loss Carryover Worksheet (Pub. 550 Worksheet 4-1; IRC 1212(b)(2)): line 3 = taxable income (negative when it would be) + the allowed loss, at least 0; line 4 = the smaller of that and the allowed loss; the short-term loss less (line 4 + the long-term gain) carries as short-term, the long-term loss less (the short-term gain + what line 4 leaves after the short-term loss) as long-term. With taxable income below zero more than the loss over 3,000 carries (a single filer in 2026 with 5,000 of interest and a 10,000 long-term loss carries all 10,000). Filing separately, each return is worked on its own and the two are added. Checked against the tax-lots answer key's carryover on 2,000 households (`tests/golden-tax-lots.test.mjs`). The 3.8% tax counts dividends and interest from the Income page, the typed qualified dividends and the year's net gain or allowed loss (Form 8960 lines 1, 2, 5a); rent is left out because only its gross is known. Years past the last table: brackets, deductions, gains thresholds and the wage base inflated with the plan's inflation and rounded; Social Security thresholds, NIIT/Medicare thresholds and credit phase-outs stay fixed, as in the law.

### Pay and contributions against the year's limits
The limits come from `retirement/contributions` (`limitsFor(year)`: each kind from the newest year published, so a 2027 return has 2027's HSA figures and 2026's others; `catchUpFor`; `hsaPicture`). Each rule was checked against the answer key `tests/golden/limits/` (RULES.md sections 2.2, 3, 4.5, 5, 7, 12): on its 2,900 households of 2025 and 2026 the AGI, the Medicare wages, each person's 401(k) catch-up and excess and each IRA deduction agree.
- **Wages** (when not typed) = pay and bonuses - each person's pre-tax 401(k) money up to that person's limit plus catch-up - the health FSA up to its limit + employer HSA money over the HSA limit.
- **401(k)**: deferrals over the 402(g) limit are pay this year, "to the extent the amount of such deferrals ... exceeds the applicable dollar amount. The preceding sentence shall not apply to the portion of such excess as does not exceed the designated Roth contributions" (IRC 402(g)(1)(A)): Roth 401(k) money counts as the excess first, so pre-tax money comes off wages up to limit + catch-up whatever the Roth money is. The catch-up is the dollar amount for the age reached (`catchUpFor`) but at most "the excess (if any) of (I) the participant's compensation ... over (II) any other elective deferrals" (414(v)(2)(A)(ii)): compensation less min(pre-tax + Roth, the limit). Compensation (`k401.people[].compensation`) is 415(c)(3)'s: the person's pay and bonuses, plus for someone self-employed their earned income (415(c)(3)(B), 401(c)(2)), taken as the Income page's business figure, so a solo 401(k) keeps its catch-up. A row, pay or business income that names no adult is the adult marked "Me"'s.
- **Health FSA** (`taxes.hsa.fsa` for the adult marked "Me", `taxes.hsa.fsaPartner` for the other adult; each employee has their own limit, Notice 2012-40: "each spouse may elect to make salary reduction contributions of up to $2,500 (as indexed for inflation) to his or her health FSA", https://www.irs.gov/pub/irs-drop/n-12-40.pdf, read 2026-10-31): a cafeteria-plan salary reduction is not income (IRC 125; Pub. 969: "You don't pay federal income tax or employment taxes on the salary you contribute ... to the FSA") nor Medicare wages (3121(a)(5)(G)); excluded up to the year's limit (125(i): 3,300 in 2025, Rev. Proc. 2024-40 s.2.16; 3,400 in 2026, Rev. Proc. 2025-32 s.4.15), the part over stays in pay (RULES.md convention 8), with a note.
- **HSA** (payroll money = the HSA rows' amounts, or the HSA page's contribution when larger; `hsaPicture`): excluded only "to the extent such amounts do not exceed the limitation under section 223(b)" (106(d)(1)); with no high-deductible plan all of it is pay (223(c)(1)); "Excess contributions made by your employer are included in your gross income" (Pub. 969). Adjustment = payroll money - the household's excess (at least 0); employer money over the limit beyond that is added to wages. All HSA money is taken to go in through pay, as the HSA page assumes.
- **Medicare wages** (the 0.9% tax) = pay before pre-tax 401(k) saving (3121(v)(1)(A)) - the FSA excluded - the HSA payroll money + the HSA excess: cafeteria-plan payments are not wages (3121(a)(5)(G); Pub. 15-B: HSA money is free of Medicare tax "Up to specified dollar limits").
- **Traditional IRA**: deducted (still assumed deductible) up to each person's IRA limit plus catch-up, "shall not exceed the lesser of (A) the deductible amount, or (B) ... compensation" (219(b)(1); limit and catch-up 219(b)(5)); the part over is not deducted, with a note.
- **Typed wages** are the household's W-2 box 1 and are used as they are: nothing is taken off or added, and Medicare wages are the typed figure. Box 1 already leaves out the HSA money from pay within the limit (it shows in box 12, code W), so that money is not deducted again as an adjustment (until 2026-10-31 it was, taking it off twice).

### Married filing separately: two returns
Since 2026-10-31 a separate filing with two adults is two returns, one per spouse ("If you file a separate return, you generally report only your own income, credits, and deductions", Publication 501 (2025), Married Filing Separately, read 2026-10-31). `taxInputs` builds `separate`, one set of inputs per spouse; `core/math/tax.js` (`separateTax`) works each return on its own and adds them up, each return's tax to the cent.
- **Each spouse's own:** their pay and bonuses less their own pre-tax 401(k) money (limits per person, as above), their IRA deduction, their HSA money, and every Income row in their name (business, rental, pension, investment, Social Security). Their own age (65+ allowance) and blindness (a count of 2 puts one on each return).
- **In neither name:** an Income row without an adult is split in half, except pay, which is the adult marked "Me"'s (as above). The figures typed on this page (other income, qualified dividends, adjustments, Social Security, tax-exempt interest, withholding, payments) and the itemized amounts are halved, since the plan does not record whose they are. A sale with a `personId` (Crypto and Tax lots set it from the account's owner) is all on that spouse's return, as their own income; a sale in neither name is halved, so each return nets its half and has its own 1,500 loss limit (IRC 1211(b)). A row (a sale or an Income row) naming someone on neither return, such as a third adult, is treated as in neither name, as a joint return would count it (until a review on 2026-10-31 it fell off both returns while the sources still listed it). Each return's carryover is worked from its own sales (`gainTotals`). The household's `gains` figures (net short and long gain, net loss, allowed loss; the sources, the steps, the carryover, Capital gains, Tax lots and Crypto read them) are the two returns' own added up, with `gains.byReturn` holding each, so a gain on one return and a loss on the other do not cancel; the carryover is worked whenever a return has a net loss (until 2026-10-31 only when the household's net was a loss). `addIncome(inputs, personId, add)` puts an amount on one spouse's return (both the total and their part), for pages that add a vest, a home sale or take a gain off. Typed wages are shared in proportion to each spouse's pay (half each with no pay on file). Each spouse's own health FSA comes off their own pay.
- **Children** go on the return of the spouse with the larger pay (the Which way to file page's convention); only one return can claim a child.
- **Itemizing:** if one return itemizes, both must (IRC 63(c)(6)(A)): the other return is worked again with its own itemized amount, however small.
- **The next dollar and the bracket** shown on the page are those of the return of the adult marked "Me" (`inputs.separateTo`): an amount another page adds to the household's figures (a raise, a gift, a sale) lands on that return, and an amount it takes off comes off that return. A page that changes one spouse's own pay or saving re-runs `taxInputs` on a changed plan instead (the HSA page does).
- The hero and the stats show the two returns added; the "Two returns" card shows each one. The Social Security rule for a separate return (above) applies to each return.

## Child and dependent care credit (2026-11-02)
Until 2026-11-02 the engine had no child and dependent care credit, so a single parent on 62,000 paying 10,800 a year of
daycare was shown only the child tax credit: 1,988 of tax for 2026 instead of 938. The credit now comes off the tax in
`core/math/tax.js` (`careCredit`, `careCreditRate`), its yearly figures in `data/federal.js` (`careCredit`, typed in
`tools/extract-tax.mjs` for every year).

Sources, all read 2026-11-02 (the 2026 IRS forms are drafts so far; every 2026 figure rests on the enacted statute, and the drafts agree):
- P.L. 119-21 sec. 70405 (rewrites IRC 21(a)(2)) and sec. 70404 (IRC 129(a)(2)(A): $5,000 to $7,500, $2,500 to $3,750 separately), both for tax years after December 31, 2025: https://www.govinfo.gov/content/pkg/PLAW-119publ21/html/PLAW-119publ21.htm
- 26 U.S.C. 21, with the text of (a)(2) before 2026 in its Amendments note: https://uscode.house.gov/us/usc/t26/s21/ ; 26 U.S.C. 129: https://uscode.house.gov/us/usc/t26/s129/
- 2026 Instructions for Form 2441, draft of Aug 21 2026 ("2026 Phaseout Schedule", Credit Limit Worksheet, Part III): https://www.irs.gov/pub/irs-dft/i2441--dft.pdf ; 2026 Form 2441 draft: https://www.irs.gov/pub/irs-dft/f2441--dft.pdf ; 2026 Pub. 503 draft: https://www.irs.gov/pub/irs-dft/p503--dft.pdf
- 2025 Form 2441 (line 8 table) and instructions: https://www.irs.gov/pub/irs-pdf/f2441.pdf , https://www.irs.gov/pub/irs-pdf/i2441.pdf ; 2025 Pub. 503: https://www.irs.gov/pub/irs-pdf/p503.pdf
- 2026 Pub. 15-B (the $7,500 dependent care limit): https://www.irs.gov/pub/irs-pdf/p15b.pdf ; IRS "Working Families Tax Cuts": https://www.irs.gov/newsroom/working-families-tax-cuts ; Rev. Proc. 2025-32 (no entry: neither section is indexed): https://www.irs.gov/pub/irs-drop/rp-25-32.pdf ; 2025 Schedule 8812 instructions (Credit Limit Worksheet A): https://www.irs.gov/pub/irs-pdf/i1040s8.pdf

The engine (`inputs.care = { expenses, persons, benefits, earnedLow }`; absent, no care or no qualifying person: no credit and every other figure as before):
- Limit = 3,000 for one qualifying person, 6,000 for two or more (21(c); per return, not per child, not prorated), less the dependent care benefits excluded (21(c), last sentence; Form 2441 line 29).
- Care counted = min(expenses - benefits, limit) (line 31: what the benefits paid cannot count again), then at most `earnedLow` (line 6; 21(d)(1)).
- Rate (21(a)(2), on Form 1040 line 11 AGI; `steps(x, s)` = x > 0 ? ceil(x / s) : 0, "or fraction thereof"): to 2025 (2024 too: the same text since P.L. 107-16, 2021 aside), max(20, 35 - steps(AGI - 15,000, 2,000)); from 2026, p1 = max(35, 50 - steps(AGI - 15,000, 2,000)), then max(20, p1 - steps(AGI - 75,000, 2,000)), on a joint return max(20, p1 - steps(AGI - 150,000, 4,000)). A qualifying surviving spouse uses the other column. Checked against every row of both 2026 columns and the 2025 table (`tests/tax.test.mjs`).
- Credit = care counted x rate, at most the income tax (Form 2441 line 11 and its Credit Limit Worksheet: Form 1040 line 18, the tax before the 3.8% and 0.9% taxes), never refunded (only 2021's was) and never carried forward.
- Order: the care credit is taken first and the child tax credit's limit counts it (Schedule 8812 Credit Limit Worksheet A subtracts Schedule 3 line 2), so on a small tax some of the child credit moves to its refundable part. On the walk the row comes after the child tax credit, as on the 1040 (line 19, then line 20 through Schedule 3).
- None on a separate return (21(e)(2)): the safe rule. A married person filing separately who kept the child's home, paid over half its cost and lived apart from their spouse for the last six months is treated as unmarried (21(e)(4)) and could claim it; the plan does not record the home and its cost (`taxes.livedApart` is the Social Security test, apart all year), and such a parent can usually file as head of household instead (the same household test, IRC 7703(b)), which the app works with the credit. A note says so and points to Which way to file. The engine caps the excluded account money at the year's limit (`benefitLimit`), so an election passed in before the limit takes only the limit off.
- Worked examples (the research spec's, in `tests/tax.test.mjs`): head of household, 62,000, one child, 10,800 of daycare: 2026 3,000 x .35 = 1,050 (2025: x .20 = 600); the same with a 5,000 FSA: none (3,000 - 5,000 < 0); joint, 160,000, two children, 14,000 of care, lower earner 50,000: 2026 6,000 x .32 = 1,920 (2025: 1,200).

From the plan (`taxInputs`):
- **Care** (`isCare`): an Expenses line whose name names care outright, in any category: day care, child care, a child minder, a nanny, a babysitter, an au pair, preschool, pre-K or nursery school, before- or after-school care in any spelling ("after school", "afterschool", "after-school"), a day camp. In "Childcare and school" also a line whose name only says care, a sitter, a nursery or a camp, unless it says schooling (tuition, school, kindergarten, college). Never: the Pets category or a pet's name ("Doggy daycare"), an adult ("Adult day care for Mom", "Elder care": 21(b)(1)(B) and (C) cover a dependent or spouse who cannot care for themselves, which People does not record), child support, tutoring, lessons, summer school, an overnight or sleep-away camp. A name that only names a kind of spending ("Diapers and formula", "Soccer and activities") is not care. Sources: 2026 Pub. 503 draft, read 2026-11-02 ("nursery school, preschool, or similar programs for children below the level of kindergarten are expenses for care"; "before- or after-school care of a child in kindergarten or a higher grade may be expenses for care"; "Expenses to attend kindergarten or a higher grade aren't expenses for care"; "Summer school and tutoring programs aren't for care"; "Child support payments aren't for care"; a day camp "even if the camp specializes in a particular activity, such as computers or soccer"; "The cost of sending your child to an overnight camp isn't considered a work-related expense"; 21(b)(2)(A)). Set up my plan's "Childcare and school" row counts. Each line's part paid in the tax year (`paidInYear`): its yearly amount for each month of the year it runs (a month counts if the line runs on any day of it); a one-time line when its start date is in the year. The family fixture: Daycare to August 31 (8 x 1,150) and after-school care from September 1 (4 x 450), 11,000. Until 2026-11-02 (review) any "Childcare and school" line counted unless it said "school", so "Child support" counted and "After school care" did not.
- **Qualifying persons**: dependents on People under 13 on December 31 of the tax year (21(b)(1)(A)), and a child who turns 13 during the year for the part of the year before the birthday (Form 2441 instructions: "the child is a qualifying person for the part of the year they were under age 13"). The 3,000 / 6,000 limit is not prorated (Pub. 503: "Use the $3,000 limit if you had one qualifying person at any time during the year"). With no child under 13 all year, only the care paid before the last 13th birthday counts: the months before its month, and that month's days before the birthday (born 2013-05-10: January to April and 9/31 of May); a note says so. With a child under 13 all year, all the care counts (the plan cannot tell whose care a line is). A dependent without a birth date is not counted; with care on Expenses a note asks for the date. Care on Expenses with no child on People, or none under 13, has its own note. A disabled spouse or dependent over 12 (21(b)(1)(B), (C)) is not modelled: People has no such flag.
- **Earned income** per adult (`care.earnedPeople`), as the return has it: pay less the pre-tax 401(k) money, the health FSA, the HSA money from pay within the limit and the child care account's excluded money (typed wages, W-2 box 1, shared by pay: the account is already out of them), plus their business income on the Income page less half its self-employment tax (15.3% of 92.35%, the Social Security part only up to the wage base left after pay; none under 400 of earnings; a loss lowers it). `earnedLow` = the smaller of the two adults' on a joint return, else the adult marked "Me"'s. Filing jointly with only one adult on People the spouse's earned income is not known (21(d)(1)(B)): `earnedLow` = 0, no credit, and a note asks to add the spouse. A spouse who is a full-time student or cannot care for themselves (deemed 250 / 500 a month, 21(d)(2)) is not modelled: with no pay the credit is 0.
- **The child care account** (dependent care FSA, IRC 129): each adult's `whatIfs.benefits[adultId].dcfsaElect` from Benefits elections, counted when its plan year is the tax year. The plan year is the one that page uses: `planYear` when typed, else next year from October (`ENROLL_FROM_MONTH` = 10, career/benefits `DEFAULTS.enrollFromMonth`, a test keeps them equal), so an account chosen in November for next year does not take this year's credit; the Paycheck page counts it the same way. A note says when the account is for another year.
- **One rule for the account** (`careAccountRule`, 2026-11-02 review; Form 2441 Part III, draft 2026 instructions read 2026-11-02), used by this page through `taxInputs` (`care.account`), by `careAccount(plan, { year, today })` and by `careInputsWith`, so every page that reads the account (Budget, Next best action, Paycheck, Offer compare, Business, Benefits, the limits page) gets the same figures:
  - `elected` = the amount chosen, at most a plan's limit (7,500 from 2026, 5,000 before: what leaves the pay, box 10 / line 12; a note when more is typed).
  - The care for a qualifying person in the year (line 16; none without a child under 13) is shared out between the adults' accounts in proportion to their elections, so two accounts never pay the same care twice (the reviewer's case #76).
  - `forfeited` = what is elected beyond that care (line 14: "Any amount you forfeited. You forfeited an amount if you didn't receive it because you didn't incur the expense"): lost. It is never paid, so it is not wages and not taxed; `received` = elected - forfeited (line 15).
  - `excluded` (line 25) = received, at most the limit (line 21: 7,500 for the household from 2026, 5,000 before; 3,750 / 2,500 on each separate return, 129(a)(2)(A); never a household total against one return's limit) and the earned income (lines 18 to 20, without the account's money: the lower earner's on a joint or separate return, 129(b)(1)(B); the filer's otherwise). A joint (or single) return caps the household's total and shares it by what each received; a separate return caps its own.
  - `taxedAsPay` = received - excluded (line 26, Form 1040 line 1e).
  - **Wages come down by excluded + forfeited** (`off`): the forfeited money is never paid, the taxed part stays pay. Typed wages (box 1) already leave the account out, so only `taxedAsPay` is added to them. **Medicare wages come down by the whole election** (`elected`, up to a plan's own limit; fourth pass below).
  - Worked by hand in `module.test.mjs`: the single parent with 5,000 and 10,800 of care (example B): AGI 57,000, tax 3,588 - 2,200 = 1,388. With 1,800 of care: 1,800 excluded, 3,200 lost, wages 57,000, no credit (the account pays all the care), 1,388 (the app said 1,772). Case #1 (2025, head of household, 120,000, a 3,000 account, 300 of care): lines 12 / 14 / 15 / 25 = 3,000 / 2,700 / 300 / 300, wages 117,000, tax 13,717.50 - 2,200 = 11,517.50. Case #76 (separate returns, 2,000 and 5,000 accounts, 1,200 of care): 342.86 and 857.14 excluded, 1,200 in all. The family filing separately with 3,750 each: 3,750 out on each return with 11,000 of care (no "over the limit" note), 900 each and 2,850 each lost with 1,800.
  - The excluded money comes off the credit's limit in the engine (21(c), last sentence; line 28); the care it pays cannot count again (line 30). Notes: money that would be lost (no care, no child under 13, too little care), money taxed as pay (over the household's limit, over a separate return's 3,750, over the lower earner's earned income), more than a plan takes.
- **What-ifs** (`careInputsWith(ti, { [adultId]: { pay, business } }, elections)`): `inputs.care` with some adults' earnings changed (`pay` as the return has it before the account, after pre-tax 401(k), health FSA and HSA money; business less half its self-employment tax) and, optionally, other elections; the account's rule and the lower earner worked again. It adds `wagesChange` (what the household's wages move by from the account alone: a job for a spouse with no pay lets the other's account stay out of income) and `account`. Offer compare (`taxYear`'s `careAt`) and Business (`soleTax` / `scorpTax`'s `careAt`, and the household without the business) add `wagesChange` to the wages they work, so a job or a business for a spouse with no other earnings counts the credit and the exclusion it unlocks. Benefits elections works its other choices from no account (`careInputsWith(ti, {}, {})`) and the account itself with and without the election (career/benefits README).
- **The walk** says why there is no credit when one could be expected: the account uses up the 3,000 / 6,000, the account pays all the care, or there is no income tax for it to come off. The last line is below zero when refundable credits are more than the tax ("the credits are more than the tax: 1,700 comes back as a refund"), and the page's headline says the same (`No federal tax for 2026: about $1,700 of credits come back`); Withholding check's refund counts it.
- **The next dollar's reason** (`careSets`): the next dollar's cost is worked again without the credit (`nextDollarNoCare`); when the two differ the credit sets it: `covers` when the credit is bigger than the tax and grows with it (Jo at 30,000: 0 cents, "the child care credit is more than the tax, so it covers the tax on more pay too"), `falls` when it shrinks; else the bracket is the reason.
- **Rates on the page** go through `ratePct` (half up on the decimal value), the one rounding for the hero, the stat and the walk: 4,268 of 88,000 is 4.85%, "4.9%" everywhere.
- The walk's row says the rate, the care it was worked on and what held it there (the limit for one child or more, the account, the pay, the tax). With a child under 13 and no care on Expenses, the walk card ends with "Paying for child care so you can work? Add it on Expenses and the child care credit comes off your tax."
- **The next dollar** (`nextDollar`, what the page shows): with care counted, the next 1,000's cost without the credit plus the credit's own effect over the next 4,000 (joint, from 2026) or 2,000 of income, per dollar (`careStep` in core/math/tax.js; `nextDollarOf`): a whole number of the credit's steps, so it does not jump with them (head of household with daycare between 86,500 and 89,500 of pay read 15, 12, 15, 12 cents over 1,000; now 13.5 each time). The words then say "and the child care credit getting smaller". `marginal` stays the next 1,000's cost: other pages read it and their own tests pin it (balance/statement's family 22%).

Knock-on: every page that works the tax on more or less income sees the credit's steps. On the family fixture (joint AGI 158,780, in the 2026 phase-down) each 4,000 of income, or part of it, costs 30 of credit, so several pages' hand-worked test figures moved. Health plans (`insurance/health`) works its rate over the HSA limit instead of over 1,000, so a 1,000 probe cannot land on a step. Self-employment (`taxes/self-employment`, the other builder's lane, not changed here) takes the 20% deduction off AGI (it adds it to `adjustments`); the 1040 takes it after AGI (line 13), so its AGI is 1,338 lower and the family's credit there one point higher (30): the year's total that Withholding check, Estimated payments and this page's headline use is 14,692.61, 30 lower than the law gives (14,722.60, which Budget and Next best action show), and the walk's "Tax saved by business deductions" row carries those 30. The fix is in that lane: pass the deduction as `qbiDeduction` instead of in `adjustments`.

## Child care account, fourth pass (2026-11-02)
- **Social Security and Medicare wages** leave out the whole election up to a plan's own limit (`elected`): IRC 3121(a)(18)
  excludes a payment "if at the time of such payment it is reasonable to believe that the employee will be able to exclude
  such payment from income under section ... 129"; the W-2 instructions for box 10 put only "any amount in excess of $5,000"
  (the plan's limit, 7,500 from 2026) in boxes 1, 3 and 5, "regardless of any employee forfeitures". The part over the
  household's limit is added back for income tax only (Form 2441 line 26, Form 1040 line 1e). So `medicareWages` = pay -
  health FSA - HSA payroll money within the limit - `elected` (each separate return its own election); Form 8959 line 1 takes
  box 5. Oracle case #243 (2026 joint, 260,000 with 9,000 typed (7,500 counted) and 80,000 with 7,500, 20,400 of care):
  Medicare wages 325,000, Additional Medicare 0.009 x 75,000 = 675.00 (was 742.50 on 332,500); income-tax wages 332,500.
- **The excess is split once**, by the elections (`careAccountRule` shares the household's exclusion by what each received,
  so the part taxed as pay is in proportion too); the note says the split ("500 of it is taxed as pay (Ana 313, Bo 188, by
  what each put in)"), as Benefits and the Paycheck page do.
- **The walk names two accounts**: "none: Ana's and Bo's child care accounts pay 8,000 of the care (7,500 of it free of tax),
  more than the 3,000 limit for one child" (it said "the 7,500 your child care account pays").
- **Separate returns**: no "for the child care credit" on the care source or the people line (21(e)(2): a separate return gets
  none); the care source says "a separate return gets no child care credit for it" (or that it is for the child care account).
- **An account with no care on Expenses**: the walk card's hint says the account pays the care back and that without care "the
  5,000 in the account would be lost", and adds that care the account does not pay can still count for the credit only when the
  account leaves room under the 3,000 / 6,000 (a 5,000 account and one child: the credit stays 0).
- **Two returns that add up**: the "Two returns" card shows each return's whole tax from Withholding check's `fullSteps`
  `returns` (`separateBusiness`): a business on its owner's return with half its self-employment tax off that return's income
  (IRC 164(f)), its 20% deduction after that return's AGI (IRC 199A; `qbiDeduction`, 199A(i)'s 400 floor), its
  self-employment tax, and the 0.9% on that return's own Medicare wages and earnings against 125,000 (Form 8959). The family
  filing separately with 3,750 each: Ana 7,764.60, Bo 5,500.37 + 1,017.33 = 6,517.70, 14,282.30 in all, the hero's figure
  (it showed 8,590 + 6,482 under 15,742). Helpers: `withReturns(inputs, parts)` (the totals set to the parts' sums),
  `businessOn(inputs, owners)` (a business at its profit on its owner's return), and each separate part's `fromIncome` (the
  Income page's own money on that return, for Budget and Next best action).
- **One next-dollar figure**: `nextDollarOf(inputs, params)` is what `nextDollar` is; Brackets and the Tax report use it
  (the Tax report said 12% for Jo at 88,000 where the walk said 14 cents).
- **The money lost, in plain words**: "You would lose 4,000 of the 15,000 in the child care accounts" (it read "of the 15,000
  child care accounts", as if there were 15,000 accounts).

## Refund or owe (2026-11-02)
The hero and the first figure say the April bill or refund from `taxAnswer` (taxes/withholding): the year's tax against
what the paychecks take out by December (typed, else estimated from pay) and the estimated payments, the answer
Withholding check, Estimated payments and Quick answers give, with a button to Withholding check. Before, only the "withheld
so far" box counted, so the page said "owe about $7,072" while Withholding check said $5,835.
That answer counts self-employment tax on business income (`yearTax`: the Self-employment page's figure), which this page's
own total and walk still leave out (their note says so); the hero then adds "That counts $611 of self-employment tax on
business income, which the total below leaves out." Folding it into the walk itself is left for later: it moves every page
that reads this total (take-home, Forecast), which needs its own check against the answer keys.

## One total, self-employment tax included (2026-11-02, round 4; the walk's rows changed in round 8, below)
The page's headline, its "Federal tax" tile and the effective rate use the whole year's federal tax (withholding
`fullSteps` → `yearTax`): the same figure as Withholding check, Quick answers and Needs attention. The walk gains the
business rows before its "Federal tax" line ("Tax saved by business deductions": the business taxed on its profit, half
the self-employment tax and the 20% deduction off income; then "Self-employment tax"), so it ends at that total and
"total − taken out = still to pay" adds up on screen. The engine's note "the 15.3% self-employment tax is not included
yet" and "business deduction" in the disclaimer no longer show when the business rows do. With no pay at all (a
freelancer) nothing is withheld, so what is still to pay is said from the estimates paid, the button goes to Estimated
payments, and "the next dollar" is the business's (bracket and self-employment tax, less its deductions: 100 −
`keepPer100` from taxes/self-employment). `compute().result` and `steps` are unchanged (the answer keys check them).

## What the plan already knows (round 8)
`compute()` keeps `result`, `steps` and `sources` as they were (the answer keys in `tests/golden/taxes` check them).
`known.js` (pure) is the estimate the page and every tax page show: `known(plan, params, fed?)` starts from `fed.inputs`
and runs seven steps in order (the six below, then `qbiStep`, under "Round 8 review fixes"), each `({ plan, fed, inputs, params, out }) -> { inputs, line, note, <its figures> }` and each with
its own test in `module.test.mjs` on the invented households of `qa/fixtures/round8-households.mjs`. The order is the
law's: the rentals' allowance is worked on modified AGI before the IRA and student loan deductions (IRC 469(i)(3)(E)), the
IRA's after the rentals and before the student loan interest (219(g)(3)(A)), the student loan interest's after both
(221(b)(2)(C)). Without any of them `known().result` is `fed.result` itself and `total` is `fed.result.totalTax`.
`walk(r, b, nextDollar)` (exported from `compute.js`) builds the walk from any result, so `steps` and the page's walk are
the same code.

1. **Withdrawals from pre-tax retirement accounts** (`withdrawalStep`; ranked item 6). This year's required withdrawal of
   each owner (retirement/rmd `thisYear`: last December 31's balance over the Uniform Lifetime factor for the age reached,
   IRS Pub. 590-B Appendix B Table III; 25.5 at 74) is ordinary income whether or not it is marked taken (IRC 72, 402(a),
   408(d)(1); Form 1040 lines 4b and 5b); someone still working leaves out the 401(k)s (401(a)(9)(C)). With no pay or
   business on the Income page, the retirement projection's first year, when it is this tax year and a retired one, adds
   what it takes from pre-tax money for spending beyond that (the projection's first year is kept for the last eight plans
   by their content and the day, `firstProjectionYear`: a retiree's pages work the year's tax several times a render, and
   the projection is the slowest piece; a plan changed in place is worked again). Only for today's tax year. A figure typed as "IRA and 401(k)
   withdrawals this year" (`taxes.thisYear.iraWithdrawals`, Form 1099-R box 2a) replaces it (half on each separate
   return); "Other ordinary income" typed as well gets a note that it may count twice.
   Hand-worked, Ruth (`widowPlan`, single, 74, 2026): 410,000 / 25.5 = 16,078.43, rounded 16,078. Pension 22,800 +
   withdrawal 16,078 = 38,878 of other income; provisional income 38,878 + 27,600 / 2 = 52,678; taxable Social Security
   = min(85% x 27,600 = 23,460, 85% x (52,678 - 34,000) + min(4,500, 50% x 27,600)) = min(23,460, 15,876.30 + 4,500) =
   20,376.30; AGI 59,254.30; standard deduction 16,100 + 2,050 (65 or older) + the senior deduction 6,000 (AGI under
   75,000) = 24,150; taxable 35,104.30; tax 10% x 12,400 + 12% x 22,704.30 = 1,240 + 2,724.52 = **3,964.52** (it was 536:
   taxable 5,360). The next dollar: 12% x 1.85 = 22 cents (each dollar pulls 85 cents of benefits in).
2. **Stock pay** (`stockStep`; item 12). Restricted stock units are wages at their value when they vest (IRC 83(a); Pub.
   525): the Equity compensation units vesting in the tax year at the price on file (the Employer stock page's schedule),
   in the employee's wages and Medicare wages. The employer holds back 22% (37% on the year's part past $1 million; Pub.
   15 section 7, supplemental wages) and the 0.9% Medicare tax on the employee's wages past $200,000 (IRC 3102(f)):
   `withheld`, which Withholding check adds to what the paychecks take out (`withheldAfter`: only the vests still to come,
   when the year so far is typed from pay stubs). Skipped with a note when Wages this year is typed (W-2 box 1 has them) or
   an Income pay line's name reads like stock pay (`STOCK_PAY_NAME`). Option exercises and ESPP sales are not on file.
   Hand-worked, Mo and Lin (`equityPlan`, joint, 2026): 1,200 units from March 1, 2025, a 12-month cliff then every 3
   months over 48: 300 on March 1, 2026, then 75 on June 1, September 1 and December 1 = 525 units x 200 = 105,000.
   Wages 210,000 + 30,000 - 24,000 - 3,000 (pre-tax 401(k)) + 105,000 = 318,000 = AGI; taxable 318,000 - 32,200 = 285,800;
   tax on the 2026 joint brackets (Rev. Proc. 2025-32 sec. 4.01) 10% x 24,800 = 2,480, 12% x 76,000 = 9,120, 22% x 110,600
   = 24,332, 24% x 74,400 = 17,856: 53,788 (the 24% bracket; it read 180,800 taxable in the 22%); less the 1,000 credit for
   the two dependents over 17 (500 each), plus 0.9% x (210,000 + 30,000 + 105,000 - 250,000) = 855 of Additional Medicare
   tax = **53,643**. Held back from
   the stock: 22% x 105,000 = 23,100 + 0.9% x (315,000 - 200,000 - (210,000 - 200,000)) = 945 -> 24,045.
3. **A business at its profit** (`businessStep`; item 20). The Income page's business at its profit after the
   Self-employment page's costs, on its owner's return (`businessOn`), half its self-employment tax off income (IRC
   164(f)), the 20% deduction after AGI (IRC 199A; Form 1040 line 13, at most 20% of taxable income before it, with
   199A(i)'s minimum), the self-employment tax itself (IRC 1401: 15.3% of 92.35% of the profit, the 12.4% only up to the
   wage base left after pay) and its 0.9% Additional Medicare tax (Form 8959 Part II) added after the income tax. The walk
   names half the self-employment tax under Adjustments, has a "Business deduction (20%)" line before Taxable income and
   a "Self-employment tax" line before Federal tax; the old "Tax saved by business deductions" line is gone.
   Hand-worked, Jo (`freelancerPlan`, single, 2026): profit 78,000; self-employment tax 15.3% x 92.35% x 78,000 =
   11,021.05, half 5,510.52; IRA 3,000; AGI 78,000 - 5,510.52 - 3,000 = **69,489.48**; before the 20% deduction 69,489.48 -
   16,100 = 53,389.48; 20% of (78,000 - 5,510.52) = 14,497.90, held to 20% of 53,389.48 = 10,677.90; taxable **42,711.58**
   (the 12% bracket; it read 58,900 and "the 22% bracket"); income tax 1,240 + 12% x 30,311.58 = **4,877.39**; with the
   self-employment tax **15,898.44**. Estimated payments: 90% = 14,308.60 in four parts of 3,577.15, three past with 4,000
   paid: 6,731.45 behind, 3,577.15 by January 15, 2027; the hero and the tile now say that (the tile said "about $11,898
   still to pay in April").
4. **Rentals after costs** (`rentalStep`; item 5). With a rental on Rental analysis, the Income page's rent (before any
   cost) comes out (`withoutIncomeRent`) and the rentals' allowed result goes in (property/rental `rentalsFor`, netted by
   `passiveLosses`): rent less empty months, the running costs, the year's loan interest and depreciation (IRC 167, 168:
   27.5 years, mid-month; Pub. 527), a loss used against other income up to the 25,000 allowance less half of modified AGI
   over 100,000 (IRC 469(i); none filing separately while living together), the rest carried. Modified AGI: this return's
   AGI without the rent, the taxable Social Security and the IRA deduction (469(i)(3)(E)). A profit is ordinary income and
   investment income for the 3.8% tax (IRC 1411(c)(1)(A)(i)). Without a rental there, the rent stays at its gross and its
   line says "before any cost: add the property on Rental analysis".
   Hand-worked, Sam and Lee (`landlordPlan`, joint, 2026): pay 167,000 less 12,600 of pre-tax 401(k) = 154,400 = AGI
   without the rent (it was 179,600 with 25,200 of rent); allowance 25,000 - 50% x (154,400 - 100,000) = 0 (gone at
   150,000); the condo: 2,100 x 12 x 95% = 23,940 of rent less 4,700 + 1,200 + 4,200 (HOA) + 2,600 (1% of 260,000) =
   12,700 of costs, 6,678 of interest (the mortgage's next 12 payments) and 210,000 x 80% / 27.5 = 6,109 of depreciation =
   a 1,547 loss, all carried; taxable 154,400 - 32,200 = 122,200; tax 2,480 + 9,120 + 22% x 21,400 = 16,308 less the
   2,200 child credit = **14,108** (it was 19,652). Estimated payments: 4,300 at filing, 2,889.20 to pay in during the year
   (90% = 12,697.20 less 9,808 withheld from pay); Rental analysis works its own MAGI the same way (154,400).
5. **The traditional IRA deduction** (`iraStep`; item 9). taxInputs deducts each adult's traditional IRA money up to the
   IRA limit; here only what IRC 219(g) allows comes off (`investments/limits` `iraDeduction`): someone covered by a plan at
   work (`coveredAtWork`: any 401(k)-kind money of theirs or their employer's this year; a pension at work is not on file),
   or married to someone who is (219(g)(7)), deducts the limit less a share of it as modified AGI goes through the range
   (2026: covered single 81,000 to 91,000, joint 129,000 to 149,000; spouse 242,000 to 252,000; separate 0 to 10,000;
   Notice 2025-67 / IR-2025-111, read 2026-11-06; 2025: Notice 2024-80), the limit left rounded up to $10, at least $200
   until the range's end (219(g)(2)(B), (C); Pub. 590-A Worksheet 1-2). MAGI: AGI with the rentals in and without the IRA
   and student loan deductions (219(g)(3)(A)). The rest is after-tax money in the IRA (its basis, Form 8606), and the
   line says so. Checked against `trad_ira_deductible` of the limits answer key on its 2,900 rows of 2025 and 2026 (part
   "deduct" of `tests/golden-limits.test.mjs`): all agree. Worked: joint, both covered, MAGI 213,000 with 7,500 in: 0 comes
   off; MAGI 140,000: 7,500 x (149,000 - 140,000) / 20,000 = 3,375, rounded up to 3,380; MAGI 120,000: all 7,500.
6. **Student loan interest** (`loanStep`; item 23). Up to 2,500 of this year's interest comes off income (IRC 221(b)(1)),
   less as modified AGI goes through the year's range (`data/adjustments.js`: 2026 single 85,000 to 100,000, joint 175,000
   to 205,000, Rev. Proc. 2025-32 sec. 4.29, read 2026-11-06 at irs.gov/pub/irs-drop/rp-25-32.pdf; 2025 and 2024 from Rev.
   Procs. 2024-40 and 2023-34), as the Pub. 970 worksheet works it (the deduction times (MAGI - start) / (end - start) comes
   off). This year's interest: each "Student loan" debt with a rate and a payment, twelve payments from today's balance
   (`yearOfPayments`, core/math/finance.js). None on a separate return (221(e)(2)); a typed "Other adjustments" replaces
   it (with a note). Hand-worked, Ana and Bo (`studentLoanPlan`, joint, 2026): 64,000 at 6.5% with 730 a month: 4,020.45 of
   interest in twelve payments, 2,500 counts; MAGI 122,000 is below 175,000, so all 2,500 comes off: AGI 119,500, taxable
   87,300, tax 2,480 + 12% x 62,500 = **9,980** (it was 10,280; separately it stays 10,280, so filing jointly saves 300).

The year's tax every tax page uses (Withholding check `yearTax`, Estimated payments, Quick answers, Needs attention,
Tax report through `fullSteps`) is `known().total`; `yearTax.se` (the business's whole effect) is `total - totalAtGross`
(the same steps with the business at its gross and no self-employment tax). Filing separately, `returns` gives each
return's own income tax, self-employment tax and taxable income. The page's hero, tiles, walk, sources ("What the plan
already knows": each step's line in place of the one it replaces) and next dollar read `known()`; its notes are shown.

### Round 8 review fixes (2026-11-06)
The review of the first build (`r8/b1/review-money.md`, `review-ux.md`) found nine money defects; each has its own test in
`module.test.mjs` ("round 8 review N") on a household in `qa/fixtures/round8-households.mjs`. Sources read 2026-11-06.
- **Seven steps now.** `qbiStep` runs last. Each step sees the figures the ones before it left (`ctx.out`).
- **Rental MAGI leaves out half the self-employment tax.** Form 8582 instructions (2025), line 6, list "the deduction
  allowed for the deductible part of self-employment taxes" among what modified AGI is figured without
  (irs.gov/instructions/i8582). So `rentalStep` adds back the half that `businessStep` took off that return. Rental
  analysis now reads the allowance, the MAGI and the netting from `known().rental`. What the rentals add is `known().total`
  less `knownWithout(plan, params, fed, "rental")`: the same steps with the rentals' result left out and their rent still
  taken out. Hand-worked, `landlordBusinessPlan` (single, 2026):
  - profit 170,000 - 30,000 = 140,000; half the self-employment tax 0.5 x 15.3% x 92.35% x 140,000 = 9,890.68;
  - MAGI 140,000, so the allowance is 25,000 - (140,000 - 100,000) / 2 = **5,000**;
  - AGI 140,000 - 9,890.68 - 5,000 = 125,109.32; standard deduction 16,100; 20% deduction held to 20% x 109,009.32 =
    21,801.86; taxable 87,207.45; income tax 13,897.64 + self-employment tax 19,781.37 = **33,679.01**. It read 32,808.63,
    with MAGI 130,109 and an allowance of 9,945; Rental analysis read MAGI 170,000 and 0.
  - What the rentals add: 5,000 off income at 22%, less the 1,000 it takes off the 20% deduction (held to 20% of taxable
    income): 4,000 x 22% = 880 less tax.
- **Only the rentals' own rent comes out of Income.** `withoutIncomeRent` takes out at most the rent the rentals on Rental
  analysis collect (each `rent`, a year before empty months). An Income row is matched to a rental by name, then by amount
  within 2%; what is left comes off the other rows in proportion. The rest of the Income page's rent stays at its gross,
  with its own "Rent ... before any cost" source line (`left`). Hand-worked, the landlord with a duplex's 18,000 only on
  Income: AGI 154,400 + 18,000 = 172,400; taxable 140,200; 2,480 + 9,120 + 22% x 39,400 = 20,268 less the 2,200 credit =
  **18,068** (it read 14,108, the duplex gone).
- **Other ordinary income typed replaces the plan's withdrawal.** The figures form said to type IRA withdrawals there before
  this batch. So a typed figure is taken to include them, and a note says to type them in their own box if it does not. A
  typed Other adjustments replaces the student loan interest the same way. The source line says "taken to include this
  year's IRA and 401(k) withdrawals"; otherwise it says what the box is for now: "interest, non-qualified dividends, Roth
  conversions". The widow with her 16,078 typed there: **3,964.52** (it read 6,695.61).
- **The extra 10% on early withdrawals.** IRC 72(t)(1) (IRS Topic 558: "a 10% additional tax on certain early
  distributions"; Form 5329 Part I) applies to the projection's draw for spending.
  - Each adult takes a share of the draw by their pre-tax balances, for the part of the year before their half-birthday
    (`shareBefore59Half`; 72(t)(2)(A)(i)).
  - It is added after the income tax as its own walk row, "Extra 10% on early withdrawals". The required withdrawal never
    owes it.
  - A note names the exceptions the plan cannot see. The age-55 one is for a 401(k) left at that job, not an IRA ("The
    exceptions below apply to distributions from a qualified plan other than an IRA", Topic 558). Equal yearly payments
    are another.
  - The age-55 rule the plan can see (round 8 verify, 2026-11-06): a 401(k) of someone whose retirement age on People is 55
    or more, reached by this year, owes none of it (`leftWorkAt55`; IRC 72(t)(2)(A)(v); IRS "Retirement topics: exceptions
    to tax on early distributions", read 2026-11-06: separation from service "during or after the year the employee reaches
    age 55", qualified plans yes, IRAs no). Its share of the draw (by balance, as above) is left out of the 10% and a note
    says why and that moving it into an IRA first would lose it. Ty, 57, retired at 56 with 800,000 in a 401(k): 0 (it was
    5,170.54); the same money in an IRA, or a 401(k) left at 52: 10% of the draw; half in each: 5% of the draw.
  - A typed withdrawal gets a note when every adult is under 59½.
  - `known().hasIncome` counts these withdrawals, so Estimated payments, Withholding check and this page no longer say "No
    income on file" beside the tax.
  - Hand-worked, `earlyRetireePlan` (50): the projection draws 71,739.13; 10% = 7,173.91; income tax 6,952.61; **14,126.52**.
- **Stock pay uses up the wage base.** The stock pay `stockStep` added is Social Security wages too (IRC 83(a), 3121(a);
  W-2 box 3). So `businessStep` passes it with the owner's pay into `seTax`: the 12.4% stops at the contribution and benefit
  base less wages (IRC 1402(b)(1); 2026: 184,500, SSA, read 2026-11-06). The 0.9% line is reduced by the Medicare wages
  (W-2 box 5; IRC 1401(b)(2)(B); Form 8959 line 10), not box 1. Hand-worked, `stockAndBusinessPlan`:
  - 150,000 + 100,000 = 250,000 of Social Security wages, past 184,500;
  - self-employment tax 2.9% x 92.35% x 40,000 = **1,071.26** (it read 5,349.26);
  - 0.9% x 36,940 = 332.46 of Additional Medicare tax.
- **The 20% business deduction over its income line** (`qbiStep`, `qbiPhase`; IRC 199A(b)(3), (e)(2)).
  - Lines and widths: Rev. Proc. 2025-32 sec. 4.26 for 2026: 201,750 (403,500 joint, 201,775 separate), with the phase-in
    ending at 276,750 (553,500; 276,775). The widths, 75,000 and 150,000, are 199A(b)(3)(B) as P.L. 119-21 sec. 70105
    amended it (Cornell LII, read 2026-11-06).
  - The plan knows of no W-2 wages paid and no business property, so the 199A(b)(2)(B) limit is 0. Over the line the
    deduction is cut by the share of the range passed (the "reduction amount" of (b)(3)(B)(ii)); past the range it is 0.
  - The engine then holds it to 20% of taxable income and lifts it to 199A(i)'s 400 minimum (Rev. Proc. 2025-32 sec. 3.12:
    at least 1,000 of active business income). It is worked last, on the taxable income every other step leaves.
  - A note says a business with wages or equipment can get more, and a service business (199A(d)(3)) can get less.
  - Hand-worked, `highFreelancerPlan` (400,000 single): AGI 383,204.70; taxable income before it 367,104.70, past 276,750;
    the minimum 400; taxable 366,704.70; income tax 97,115.90 + self-employment tax 35,115.20 = **132,231.10** (it read
    106,674 with 73,421 taken off).
  - `stockAndBusinessPlan`: before it 273,364, 95.5% of the way through, so 7,893 x 4.5% = 356 would count; the 400
    minimum is taken.
- **Student loan interest is off AGI but not off provisional income.** The engine's new optional input
  `studentLoanInterest` comes off AGI and is in the result's `adjustments`. It is not taken off the income Social Security
  is tested on: Pub. 915 (2025) Worksheet 1 line 7 adds "Schedule 1 (Form 1040), lines 11 through 20, and 23 and 25", and
  line 21 is the student loan interest deduction (2025 Schedule 1); "don't reduce your other income by ... interest on
  education loans". `loanStep` uses it. Absent, nothing moves, so no answer key changes. Hand-worked, `parentLoanPlan`:
  - provisional income 30,000 + 12,000 = 42,000; 4,500 + 85% x 8,000 = **11,300** taxed (it read 9,175);
  - AGI 38,800; taxable 14,650; tax **1,510** (it read 1,255).
- **The first required withdrawal may wait** until April 1 of next year (IRC 401(a)(9)(C); IRS RMD FAQ: "you can delay
  taking the first RMD until April 1 of the following year"). Then it is next year's income. A note says so and how to
  leave it out (type 0 under IRA and 401(k) withdrawals). The figure itself stays.
- **Wording.**
  - The walk's Income line names pensions, and "rentals 0 after costs (25,200 of rent; see below)".
  - A rental loss the allowance cannot use is said as what it means: "at your income a rental loss cannot lower this year's
    tax; the 1,547 waits for a year with rental profit, or the sale".
  - The IRA line: the income is "your joint income" on a joint return. "The 7,500 put in after tax comes out tax-free later;
    what it earns is taxed" (Pub. 590-B; only the basis is tax-free, unlike a Roth). Its amount is 0, never -0.
  - Stock pay is said in "shares".

## Edge cases
Not modelled: AMT, the earned income and education credits, state tax, the FICA wage base on the additional Medicare tax, stock option exercises and ESPP sales (not on file), a pension at work as "covered" for the IRA deduction, withdrawals before the required age other than the projection's draw (type them). `compute().result` alone (the answer keys') still taxes a business at its gross and leaves out its self-employment tax and 20% deduction (with a note); the page and every tax page use `known()`, which counts them. The child and dependent care credit leaves out a disabled spouse or dependent, a student or disabled spouse's deemed income, the separate filer who lived apart (treated as unmarried, 21(e)(4)), care paid this year for last year (line 9b), a child care account typed on the Paycheck page only, and a self-employed person's dependent care deduction (line 24); a raise on Salary keeps the plan's lower earner (only matters when that earner makes under 6,000). See its section. Ages use the age reached in the tax year. Dependents without a birth date count as under 17.

## Tests
`tests/tax.test.mjs` (the engine on hand-worked 2025 cases; the care credit's three worked examples for 2025 and 2026, both 2026 rate columns and the 2025 table row by row, the limit after benefits, the earned-income cap, the tax limit and the order before the child credit, a separate return), `tests/tax-pages.test.mjs` (this page on `qa/fixtures/tax-plan.mjs`), `module.test.mjs` (also the care credit from the plan: the single parent's walk, the family's care in the year and the lower earner, which lines are care and which are not, who counts and the 13th birthday, a joint return with one adult, a separate return, the child care account off wages and the credit (example B) and its plan year, the account's one rule by hand (money lost beyond the care: Jo with 1,800 of care; the reviewer's case #1 and case #76; the family filing separately with 3,750 each; two accounts on a joint return; a spouse with no pay), `careAccount`, each spouse's account on a separate return, the next dollar over whole steps and its reason, the 14-year-old's care line, one rounding for the rate, `careInputsWith` and its `wagesChange`). `tests/golden-federal.test.mjs`: 12,000 invented returns for 2024 to 2026 (`tests/golden/taxes/federal-<year>.csv`), worked independently from the IRS figures in `tests/golden/taxes/RULES.md` (Rev. Procs. 2023-34, 2024-40, 2025-32; Pub. L. 119-21), each within $1. All 12,000 agree since 2026-10-30 (F-029 fixed the seven causes the key found; RULES.md section 11 keeps a worked example of each). A future disagreement goes into `tests/golden/taxes/federal-todo.json` by cause and runs as a `todo` test.

## Ideas / not yet
- State tax (PolicyEngine as a local service), AMT for stock-option years, a "compare with last year's return" line-by-line check.

## Review 2026-11-06
- **Two returns card: the business owner's own return.** A return with a business shows its own income, taxable income,
  deductions (the 20% business deduction named) and bracket with the business at its profit and its deductions
  (withholding `separateBusiness` returns now carry `gross`, `taxableIncome`, `bracketRate`, `deduction`), not the engine's
  with the business counted in full: Bo with Ana 5,000 + Bo 3,000 read "$50,500 taxed ... the 22% bracket"; his return taxes
  48,653 in the 12% bracket (47,903 with 3,750 each).
- **Refund or bill, filing separately.** The hero says each return's own (withholding `byReturn` through `taxAnswer`
  `returns`): "Filing separately, each return settles on its own: Ana would get about $2,200 back, and Bo would owe about
  $1,660", where it said "you would get about $540 back"; the main button follows the return that owes.
- Tests: "the Two returns card says the business owner's own taxable income and bracket", "filing separately, the Federal
  estimate says each return's own refund or bill".
- **Verifier: a return with no paycheck figure.** With no pay at all a return's verdict is "unknown", but nothing is
  withheld, so its balance is known: the hero reads it (two self-employed spouses filing separately, Gus 90,000 and Hal
  30,000 of profit, 3,000 paid: "Gus would owe about $14,813, and Hal would owe about $4,484", where it said "Gus's is about
  right, and Hal's is about right").
- **Verifier: why the next dollar costs 0.** "The child care credit is more than the tax" only when the credit is held to
  the tax (Jo at 30,000: 585 of credit on 585 of tax). Lee (head of household, 45,000, two children, 10,800 of care) has
  2,100 of care credit on 2,148 of tax; more pay costs 0 because the child tax credit takes the rest and its refundable part
  stays at its most: "with the child care credit, your credits are more than the tax, so they cover the tax on more pay too"
  (the stat: "the credits cover it").
- Tests: "Review 2026-11-06 (verifier): the 0-cent next dollar ...", "... filing separately with no paychecks ...".
- **No child care credit for want of earned income says why (follow-up to the verifier).** Care counts only up to the
  earned income, the lower of the two on a joint return (IRC 21(d)(1)). Kim & Lou (joint, Kim 70,000, Lou no pay, 10,800 of
  daycare) had a $0 credit and no word why; a note now says "Lou has no pay or business income on the Income page, so there
  is no child care credit", with the 21(d)(2) rule the plan does not track (a spouse who is a full-time student for five
  months, or cannot look after themselves, counts as earning $250 a month for one child, $500 for two or more). A single
  parent with only a pension gets "only up to your earned income ... none is on the Income page". With a child care account
  and none of it out of income, its note says "None of the 5,000 child care account stays out of income: no more than the
  lower earner's earned income (Lou has none). All 5,000 is taxed as pay." (it read "Only 0 of the 5,000 ..."). Test: "no
  child care credit because a spouse (or the filer) has no earned income says why".
- **A bracket's edge inside the care credit's step (verifier, E).** The next dollar was the tax on the whole next 4,000
  (joint) or 2,000 with care counted, so within that much of a bracket's edge it averaged the two brackets in. Pat 91,000 +
  Sam 40,000, joint, 1,400 a month of daycare: 98,800 taxable, 2,000 of room in the 12% bracket, a care credit of 35% x
  3,000 = 1,050 that stays there to 150,000 of AGI. The page said "the next dollar you earn costs 17 cents (the 12% bracket,
  $2,000 of room left in it)" and "more than the 12% bracket: benefits or gains get pulled along"; Brackets said "the child
  care credit gets smaller", the Tax report "pays 17%". Each of the next 2,000 costs 12 cents. `nextDollarOf` is now the
  1,000 probe without the credit plus the credit's own effect over its whole steps,
  `marginalRate(noCare) + marginalRate(inputs, step) - marginalRate(noCare, step)` (0 at the least), to the billionth so a
  half cent rounds the same way each time; `nextDollarNoCare` is the 1,000 probe without the credit. Where the credit moves
  it the figure is the same as before (Jo at 88,000: 13.5 cents; Jo at 30,000: 0; the family: 22.75). Over 1,407 plans only
  H-0319 and H-0321 move (9 cents back to the 6 they read before the credit, the credit being 0). Test: "a bracket's edge
  inside the care credit's step is not averaged into the next dollar".
- **Pay that ended, has not started or is one-time (fix round 6, verifier follow-up).** The engine counts a year of what
  is coming in today (cashflow/income `active`; a one-time amount is none a year), so pay that ended this year is not in
  the estimate; the notes said "none is on the Income page" (H-0221: Dana's pay ended August 15; H-0228: all income ended
  January 31; H-0319: Carlos's 119,600 is "once"). `uncountedEarned(inc, people, year)` lists the earned lines (pay, bonus,
  business, taxed) on the Income page that are not counted (ended, starts later, one-time; `inYear` when it could have
  paid in the tax year) and `uncountedWords` says them. The 21(d) note now reads "... and none is counted for 2026, so this
  estimate has no child care credit. Dana's pay ended on August 15, 2026; this estimate counts only pay coming in today.
  To count what was paid this year, type it as Wages this year below." (the hint on a return with one adult only: typed
  wages on a joint return are shared by pay); jointly "Carlos has no pay or business income counted for 2026, so this
  estimate has no child care credit. Carlos's 119,600 of pay is one-time; this estimate counts no one-time pay."; the
  account note "(Carlos has none counted for 2026)"; and "Nothing on the Income page yet" becomes "Nothing on the Income
  page is counted for 2026. Dana's pay ended on August 15, 2026; ..." (also when the only lines are one-time, H-0019).
  Pay that ended before the tax year (H-0368: 2020) gives "counted for 2026" with no reason named. With nothing on the
  Income page the old words stay. The engine's figures do not change. Across the qa households 26 Federal estimate pages
  change, all in these notes. Test: "pay that ended this year or is one-time is 'not counted for 2026'".
- **One threshold for "the child care credit moves the next dollar" (fix round 6).** `careMovesNextDollar(nextDollar,
  noCare)`: |nextDollar - noCare| >= 0.005 (`CARE_MOVES_BY`, half a cent), worked to the billionth. `careSets` and
  Brackets' `careMoves` both use it; Brackets used > 0.0005 on the raw difference and this page > 0.005, and on 1,500
  random households with child care they disagreed on 12 (22.25 cents against 22 without the credit: Brackets said the
  credit moves it, this page said not). Half a cent counts: 12.5 cents shows as 13 against the 12% bracket, so the
  bracket alone is not the reason; before, 0.125 against 0.12 fell either side of > 0.005 by floating-point noise. On the
  1,500 random households one Federal answer changes (10.5 against 10 cents: "the 10% bracket, and the child care credit
  getting smaller"), 11 Brackets answers change, and the two pages now agree on all; no qa household's page text changes.
  Test: brackets "one threshold".

Review 2026-11-06 (round 7): the notes ("Filing separately is two returns: yours and your spouse's ... on your return", "Your health FSA election ... comes off your pay", "you have no pay or business income", "(you have none)", "Your child care account pays ... on your return", "Your pay ended on ...", "your and your spouse's child care accounts pay") and the page ("the next dollar you earn", "you would get about ... back, and your spouse would owe ...", "Your spouse's return") say you/your for the unnamed first adult ("Me") and "your spouse" for the unnamed partner; typed names read as before (core/words.js, imported as `W` beside this file's own `nameOf`). Test: "Review 2026-11-06 (round 7): the notes and the page say you/your ...".

## Decisions taken without the owner (round 8 batch 1, 2026-11-06; the owner asked not to stop for questions)
- A service business (doctor, lawyer, consultant: 199A(d)(3)) above the 199A line gets the general rule for now, and the
  page's note says it can get less. A "service business" choice on the Business page is on the backlog.
- The retirement projection taxes the spending draw (with the 10% before 59 1/2) only in a year with no pay, bonus or
  business income listed. Kept: someone who stops work mid-year with pay still listed has the draw left out of that year.
- "Has a plan at work" for the IRA deduction (219(g)) is read from 401(k)-type contributions (an amount or a match). A
  pension-only plan at work is not seen yet; a checkbox is on the backlog.

## One return for every page that says "your tax" (round 8, batch 1 follow-up)

`taxView(plan, params, { without })` in `known.js` is `taxInputs()` on the Federal estimate's own return: `inputs`, `result`, `nextDollar` and `total` are `known()`'s, and everything else `taxInputs()` gives (year, filing status, gains, HSA, care) is carried along, so a page changes one line. HSA and FSA, Health (HSA saving), Tax-lot harvesting, Crypto, Asset location, Benefits, Salary, Offer compare, Education (American Opportunity credit), Home (sale tax), Renovation and Equity compensation read it; Paycheck does not (it is the employer's withholding table, not the return). `without: "stock"` leaves this year's vesting units out of the wages for Equity compensation, which adds them itself. Without `params.today` it is `taxInputs()` as before.

## The rent match is shared (round 8 batch 6, 2026-11-06)
`withoutIncomeRent` now reads property/rental `running.js` `matchRent` (the same rule, moved: by name, then by amount within
2%, then the rest in proportion), so Income ("$937 a month after Condo's running costs") and Will the money last? match the
same Income lines to the same rentals. No figure moves: every module's compute gives the same result on all qa plans
(invariance in the batch 6 report).

## Wording follow-up (2026-11-07, claude-b lane B)
- Money in the walk and the sources always has its dollar sign (`fmtInt` in `compute.js` and `known.js` writes `$48,000`, `-$3`): "wages $48,000", "less $12,220 of pre-tax 401(k) contributions", "$6,000 a person 65 or over", "$4,000 estimated payments", "Daycare $9,200". Counts that are not money (shares vesting) stay plain numbers. Same rule in `taxes/hsa-fsa/compute.js`. Tests: `module.test.mjs` ("wording: the walk and the sources ...").
- Review round 2: the next-dollar lines say "the 24% rate, $187,617 of room left before it goes up" (not "bracket"); the walk's income line says "your income after the adjustments above" and the tax line "at the tax rates". Verify (2026-11-07): the Additional Medicare tax and net investment income tax lines give their line in dollars, read from the same parameters the engine used (`b.params`, which the walk already receives): "0.9% on wages over $250,000", "3.8% on investment income once income passes $250,000" (married filing jointly; "on each return" when filing separately). No figure changes.

Final check (2026-11-07, l007): "It counts the child tax credit and the child care credit. It leaves out the alternative minimum tax, ..." is two sentences (it was one, joined by a semicolon). Test in `tests/wording-verify.test.mjs`.

## Stress test 2026-11-11 (touch and input)

- With nothing earned on file, the page opens on one box ("Your pay this year, before tax", written to `taxes.thisYear.wages` like "Wages this year") and a filled "Show my tax", with "Add income on the Income page" beside it; no $0 tiles, walk or sources (A8, T3).
- A save on this page says the new tax in its green line ("Figures saved. Federal tax for 2026 is now about $9,870."), and "Figures the plan cannot see" stays open after its own save (A1).
- Pay typed on this page (the quick box or "Wages this year") is used instead of the Income page's; once the Income page has pay too, a line says so with "Use the Income page's pay" (clears the typed figure). A save's green line is drawn at the foot of the page (the shell repeats it at the bottom of the screen) so nothing above the button moves.
