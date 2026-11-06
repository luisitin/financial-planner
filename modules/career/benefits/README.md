# Benefits elections  (`career/benefits`)

**Status:** usable, phase 10
**Purpose:** Helps you choose at open enrollment: your 401k percentage, health savings account, employer stock plan and insurance picks.

## Inputs
- Whose benefits (`whatIfs.benefits.personId` when that adult has pay, else the "self" adult with a salary, else the
  first with one); their active salaries and bonuses (`income[]`; pay = salary + bonus unless typed), the paycheck
  count from the first salary's period (weekly 52, every two weeks 26, twice a month 24, monthly 12; a yearly or
  quarterly figure assumes 26 and says so) unless typed.
- **The plan year**: the year the choices are for, next year from October (open enrollment), else this year, or as
  chosen. Its limits are used, or the latest year in the tables with a note; ages are the ones reached in it.
- Their 401(k) contributions (`retirement.contributions[]` into accounts of type `401k`) and employer match.
- `taxes.hsa` (coverage, contribution, employer money, health FSA) as the starting HSA and FSA figures.
- The household's federal tax (`taxes/federal` `taxInputs`), the state's rate (`taxes/state`), the wage base.
- `whatIfs.benefits[personId] = { matchTiers: [{ rate, upTo }], paychecks, planYear, pay?, hsaEligible, hsaCoverage, hsaEmployer,
  hsaElect, fsaElect, dcfsaElect, transitMonthly, parkingMonthly, esppOffered, esppPct, esppDiscount, esppLookback,
  lifeCover, lifePaid }`.
- Writes `whatIfs.benefits`; "Use X%" sets the person's 401(k) contributions (each keeps its share of the total, in
  its own period) and, once the employer's match is typed here, their employer match (an assumed match never
  overwrites the Contributions page's); "Use these on the HSA page" sets `taxes.hsa` coverage, contribution,
  employer and FSA.

## Outputs
`compute(plan, { today })` -> `{ ready, year, person, pay, paychecks, settings, notes, k401, hsa, fsa, dependentCare, commuter, espp, life, total }`
(shapes in the `compute` comment).

## Formulas
- **The match** (`matchAt`): tiers `[{ rate, upTo }]`, each `upTo` the top of its band as a share of pay; match share
  = Σ rate × (min(put in, upTo) − the band's start). In dollars (`matchDollars`) it is figured on pay counted only up
  to the compensation limit ($360,000 in 2026, IRC 401(a)(17), Notice 2025-67) and on what you put in up to the
  deferral limit. The whole match is at the highest `upTo` with a rate (`fullMatchAt`; none when every tier is 0).
  Left behind = match at the whole match − match now. Until the employer's own match is typed, the page assumes 50
  cents a dollar on the first 6% of pay, the most common formula in Vanguard's *How America Saves 2026* (2025 plan
  data; average promised match 4.7% of pay), and says it is an assumption. When Retirement saving's match question
  was answered "No match" (`retirement.workPlans[id].match === false`) and no tiers are typed here, there is no
  match and nothing is assumed.
- **The 401(k) limit** (`limit401k`) for the age reached this year: $24,500 in 2026; + $8,000 catch-up from 50; or
  $11,250 instead from 60 to 63 (IRS Notice 2025-67; `retirement/contributions/data/limits.js`). Choices shown: now,
  the whole match, the limit (as a share of pay, capped at 100%).
- **What a choice costs**: put in = min(limit, share × pay); the tax it saves (`taxSaved`, `fica` false) = the
  household's federal tax at wages before any 401(k) saving, less at wages lowered by the amount, + the state's rate
  × the amount; pre-tax 401(k) money still pays Social Security and Medicare (IRC 3121(v)(1)(A)). Cost = put in −
  saved; a paycheck = ÷ paychecks. The federal part leaves out the 0.9% extra Medicare tax (a 401(k) does not lower
  Medicare wages). Pennsylvania taxes 401(k) deferrals (`K401_TAXED_STATES`; PA Department of Revenue, Personal
  Income Tax Guide, Compensation): no state saving there.
- **Roth catch-up**: from 2026, someone 50 or older paid over $150,000 by the employer the year before (2026 line,
  Notice 2025-67; IRC 414(v)(7), SECURE 2.0 §603) makes catch-ups as Roth; the final regulations apply from 2027 and
  plans follow the law in good faith in 2026 (IRS IR-2025-91). Not before 2026: Notice 2023-62 gave plans an
  administrative transition through 2025 (`ROTH_CATCHUP_FROM`), so a 2025 plan year puts all of it in pre-tax. The page
  uses this year's pay as the guide, and the catch-up part of a choice saves no tax now.
- **Health savings account** (shown when the plan qualifies): limit = $4,400 self-only / $8,750 family in 2026 (Rev.
  Proc. 2025-19), $4,500 / $9,000 in 2027 (Rev. Proc. 2026-24 §3.01(1), posted 2026-05-29, read 2026-10-31), + $1,000
  from 55, which is in the law and not indexed (IRC 223(b)(3)); room = limit − employer money; the election is capped
  at the room. The IRS puts out the HSA limits in the spring and the others in October and November, so in open
  enrollment the next year's HSA limit can be known before the 401(k)'s: `retirement/contributions/data/limits.js`
  (not this page's file) holds such a year in part (2027: the HSA only), the page reads it through `limitsFor(planYear)`
  (each kind from the newest year that has it), and the page's note says which limits are the next year's. "Use these on the HSA page" saves next year's choice on a page that shows this year, so
  the page says that page checks it against this year's limits until January. From 2026 bronze and
  catastrophic marketplace plans qualify (P.L. 119-21; IRS Notice 2026-5). Tax saved through payroll = federal (the
  household's tax with the HSA page's figure taken back out, then the election off wages) + 7.65% payroll tax (6.2% only
  under the wage base) + the state's rate, except California and New Jersey, which tax HSA money (`HSA_TAXED_STATES`).
- **The child care account's real worth** (`dcWorth`, review of 2026-11-02): the plan's own federal tax for the plan year
  (`taxInputs` + `federalTax`, the Federal estimate's one rule for the account, `careAccountRule` in `taxes/federal`) with this
  election and with none, everything else as the plan has it, so the other adult's account is counted once, a separate
  return keeps its own 3,750, and care too small for the account shows the money lost. Federal = the tax without - the tax
  with (the 0.9% extra Medicare tax left out), the credit the account costs counted in it (`creditLost` = the credit
  without - with); payroll = Social Security (to the wage base) and Medicare on the whole election, up to a plan's own limit
  (fourth pass below); state = the state's rate on the change in AGI; `saved` = federal + payroll + state - the money the
  account would lose (forfeited: elected beyond the care, Form 2441 line 14). Worked by hand in `module.test.mjs`: Jo
  (head of household in Ohio, 62,000, 10,800 of daycare) with 5,000: -450 + 382.50 + 137.50 = 70; with 2,000: -460 + 153
  + 55 = -252 ("costs 252 more", never a negative "Tax saved"); with no care: all 5,000 lost, 1,120 - 5,000 = -3,880; with
  1,800 of care: 3,200 lost, the credit 630 lost, -30 + 382.50 + 137.50 - 3,200 = -2,710. The family: Ana's 5,000 alone
  1,100 - 960 + 382.50 = 522.50; Bo's 2,500 with Ana's 5,000 costs no credit: 550 + 191.25 = 741.25 (the two pages' credit
  lost add up to the plan's, 165); with Bo earning nothing none of Ana's account stays out of income: it saves nothing.
  Before an amount is chosen the page says the account and the credit pay for the same care.
- **What leaves each paycheck** (`paycheckChange`): the Paycheck page's own take-home (cashflow/paycheck compute) with
  the choices typed in as a paycheck's amounts against the same paycheck with none of them and no 401(k) (and against all
  of them but the child care account, for its own line). The withholding is the IRS table's on the W-4 (the household's
  filing status unless one is typed there), so it moves with the choices. Jo's 5,000: 2,003.09 - 1,853.86 = 149.23 a
  paycheck (the page used to say 190: 5,000 less the year's saving over 26). The credit the account costs is not in it:
  it shows as a smaller refund when you file, and the page says so. The Paycheck page calls this page with
  `{ paycheck: false }`, which leaves these runs out.
- **Health FSA**: up to $3,400 in 2026, $680 may carry over (Rev. Proc. 2025-32). **Child care FSA**: each employee's
  plan takes up to $7,500 from 2026 (was $5,000); the household keeps up to $7,500 out of income ($3,750 on each separate
  return), IRC 129 as amended by P.L. 119-21 §70404; shown with children under 13 (IRC 21(b)(1)(A)); the other adults'
  elections are counted in the household by the Federal estimate's rule (over the limit is taxed as pay, and the page
  says so), not taken off this person's. The account
  also pays care for a spouse or another dependent who cannot care for themselves (IRC 21(b)(1)(B) and (C)); the page
  does not know who that is, so it is shown with a child under 13 or once an amount is typed. **Commuting**: transit
  and work parking, each up to $340 a month in 2026 (Rev. Proc. 2025-32 §4) and $325 in 2025 (Rev. Proc. 2024-40
  §2.17). Each saves federal + payroll + state tax
  (`taxSaved`). A typed amount over its limit is capped, and the page says so.
- **Stock purchase plan** (IRC 423): put in = min(share × pay, $25,000 × (1 − discount)), the most that buys $25,000
  of stock a year at the offering price with prices flat (the limit is on the stock's value at the offering's start);
  discount at most 15%. Gain if sold at once = put in × (1 ÷ (1 − discount) − 1) (15% off = 17.6% on the money; more
  with a look-back when the price rose). Sold at once (a disqualifying sale) the discount is pay: income tax (the
  household's federal tax with the gain added) + the state's rate; no Social Security or Medicare (IRC 3121(a)(22);
  IRS Publication 525).
- **Life cover through work** (IRC 79): the cost of cover above $50,000 is taxable pay: (cover − 50,000) ÷ 1,000 ×
  Table I's monthly rate for the age at the year's end (40 when unknown, said on the page) × 12 − what the employee pays (Treas. Reg. 1.79-3(d)(2), IRS
  Publication 15-B: under 25 $0.05, 25-29 $0.06, 30-34 $0.08, 35-39 $0.09, 40-44 $0.10, 45-49 $0.15, 50-54 $0.23,
  55-59 $0.43, 60-64 $0.66, 65-69 $1.27, 70+ $2.06). Tax = federal income tax on it + Social Security on the part
  under the wage base + 1.45% Medicare + the state's rate.
- **Each paycheck**: pre-tax total = the 401(k) now + HSA + FSAs + commuting a year; saved = the 401(k)'s, then the HSA,
  health FSA and commuting worked together on the wages the 401(k) leaves (near the wage base or a bracket edge they save
  more together than one by one), plus the child care account's own worth (`dcWorth`); taken from each paycheck = the
  Paycheck page's own change (`paycheckChange`), or (pre-tax total − saved + the stock plan's money) ÷ paychecks when
  that page does not see the pay.

## Edge cases
- No pay (or pay of 0): an empty state; pay linked to nobody: a pointer to People and Income. No 401(k) account for the
  person: the choices are shown with a link to Contributions instead of the "Use" buttons; nothing going in now: no
  "now" choice. No HSA on file and not ticked: the HSA card is left out. Nothing chosen: a sentence, not $0 tiles.
- An HSA with a health FSA: the FSA has to be limited-purpose (a note).
- State tax unknown: not counted in the savings (a note).

## Tests
`module.test.mjs`: match tiers (capped pay, no match), the 401(k) limit by age, Table I (unknown age), the tax a
deduction saves (wage base, state, no payroll, no 0.9%), the plan year in October and spring, Ana's 401(k) choices by
hand, match left behind with two tiers, no match, pay over $360,000, the Roth catch-up's after-tax part,
Pennsylvania, the HSA (room, cap, saving, catch-up from 55, a state that taxes it, none), FSAs and commuting capped,
child care shared in the household, a separate return, the stock plan (gain, tax, the 15% cap, the $25,000 cap, the
state), life cover (above the wage base), the paycheck worked together, paychecks by period, whose benefits (a
fallback), not ready (no pay, pay linked to nobody, pay of 0).

## Ideas / not yet
- Roth or pre-tax 401(k) by this year's rate against the expected rate in retirement.
- The health plan choice itself lives on Health plan compare; disability and accident cover on their own pages.
- A self-employed person's dependent care deduction (Form 2441 line 24) and the credit for care paid this year for last year.

## Child care account, fourth pass (2026-11-02)
- **Payroll saving on the whole election** (`dcWorth`): IRC 3121(a)(18) keeps the election out of Social Security and
  Medicare wages when it is reasonable to believe it can be excluded, and the W-2 box 10 instructions put only an amount
  over the plan's own limit in boxes 3 and 5; the part over the household's limit is taxed as pay for income tax only (Form
  2441 line 26). The Paycheck page already takes all of it out. The family, Ana 7,500 + Bo 7,500 (11,000 of care): Ana's
  payroll saving 7.65% x 7,500 = 573.75 (was 306), her account -2,546.25 a year (was -2,814). Ana 5,000 + Bo 3,000: Ana
  saves 1,372.50 (was 1,334), Bo 779.50 (was 741). Bo with no pay: Ana's 5,000 saves 382.50 of payroll tax, none of income
  tax.
- **This adult's own share** (`own`: elected, forfeited, excluded, taxedAsPay; `split`, `householdTaxed`): the household's
  excess is split by the elections (the one rule), and the page says this adult's part with the other's ("313 of the child
  care account is taxed as pay: with the 3,000 chosen by others, the household's accounts are 500 over its limit of 7,500,
  shared by what each puts in (Bo 188)"); it said 500 on both adults' pages.
- **Its own paragraph**: the child care sentences are a paragraph of their own, each naming "the child care account" (they
  were added to the health FSA's, so "it" read as the health FSA). On a separate return no credit sentence (21(e)(2): none),
  "On a separate return there is no child care credit, so the child care account is the one way to pay for care before tax";
  the row reads "up to 3,750" (each return's limit); another adult's account never uses up this adult's 3,750 (no "already
  chosen by others" on a separate return).
- **Costs, the right way round**: "Costs a year 2,710: the 3,200 the child care account would lose, less the 490 of tax the
  choices save" (it read "more than the tax the choices save, less the 3,200 ... would lose"); the row "costs 252 a year
  more than it saves".
- **"Think about skipping the account" only when true** (`best`): when the amount chosen costs more than it saves for the
  credit it costs, the account is worked again at the most it can usefully be (the room under the limit, at most the care no
  other account pays). The worth is straight-line in the amount on each side of the credit's limit, so that end and none
  decide it. Jo with 2,000: 7,500 would save 630, so the page says "at 2,000 the credit alone is worth more, but 7,500 in the
  account would save 630 a year". Jo with two children: 2,000 costs 252 and even 7,500 costs 420 (-6,000 x 12.6% + 1,500 x
  22.4%), so it says to think about skipping the account.
- **One take-home figure for a 401(k) choice** (`paycheckChange` `k401`): each 401(k) row's "takes X from take-home pay" is the
  Paycheck page's own change (the 401(k) alone against none, its withholding table), the same figure as "Taken from each
  paycheck" when nothing else is chosen (the family's 12.1%: 413.60 on both; it said 363 and 414). The yearly cost after the
  tax it saves at filing (`cost`) is unchanged.

## Review 2026-11-06
- **The business owner's account on a separate return.** `dcWorth` works the federal tax with and without the election on
  the Federal estimate's inputs with the Income page's business at its profit on its owner's return, half its
  self-employment tax and its 20% deduction off (withholding `withBusiness`: federal `businessOn` with `businessOwners`), as
  the Federal estimate's year tax and Budget do. It counted the business in full as ordinary income, so Bo's return sat
  across the 12%/22% line. The family filing separately, Bo's page: 3,750 each: saves $862.19 (federal 575.31 + Social
  Security and Medicare 286.88), was $1,047; Ana 5,000 + Bo 3,000: Bo's 3,000 saves $714.81 (485.31 + 229.50), was $890.
  Ana's figures and every joint figure do not move. Test: "on a separate return the business owner's account saves what his
  own return says".

Review 2026-11-06 (round 7): the lede ("Your workplace benefits for 2027", "Your spouse's ...") says you/your for the unnamed first adult ("Me") and "your spouse" for the unnamed partner; typed names read as before (core/words.js; view only).
