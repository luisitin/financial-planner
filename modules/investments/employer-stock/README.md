# Employer stock  (`investments/employer-stock`)

**Status:** usable, phase 7
**Purpose:** How much of your wealth rides on the company you work for, when its grants vest and the tax they bring, and how to bring the stake down.

## Inputs
- `equity = { symbol, price, priceAsOf, personId, grants: [{ id, kind: "rsu"|"option", name, granted, vestStart, shares, strike, vestMonths, cliffMonths, every }] }` (written here; `career/equity` is to reuse it).
- `holdings[]` with that symbol, in any account (through `investments/holdings`).
- Net worth's investable total (`balance/net-worth`), the pay of the person who works there (`cashflow/income`),
  the federal estimate's inputs (`taxes/federal` `taxInputs`, `todaysReturn`; `federalTax`) and the state's share (`taxes/state`).

## Outputs
`{ ready, symbol, price, priceAsOf, held, heldValue, grants: [{ ..., vested, unvested, vestedValue, unvestedValue, next, expires, schedule }], owned, unvested, exposure, invested, share, level (null with no share and no stake), person, pay, payOnFile, stress, vests: [{ date, grant, shares, value, withheld, owed, gap, stateOwed }], vestYears: [{ year, value, earlier, owed, withheld, gap, state, over1m, medicare, estimated }], vestGap, diversify: { sell, fromPlans, fromTaxable, gain (negative for a loss), tax (negative when the sale lowers it), carry, after, stillOver }, rates, year, otherYear, expiringSoon }`.

## Formulas
- Vesting (`vestSchedule`): the cliff's share at `cliffMonths` (default 12), then every `every` months (default 3) to
  `vestMonths` (default 48); cumulative whole shares = floor(grant × months / vestMonths), each vest the difference.
- Price: the typed price when it is at least as new as the holdings' newest, else the holdings' price.
- Owned = held shares × price + vested options × max(0, price − strike). Still to vest = unvested units × price +
  unvested options × the same spread. Vested units are assumed listed on Holdings (or sold), so they are not counted twice.
- Share = (owned + still to vest) ÷ (net worth's investable money + vested options' spread + still to vest). Up to 10%
  is the usual single-stock ceiling; above 25% a large bet. With nothing invested and no stake (exposure 0: a symbol only,
  options under water, grants fully vested) there is no share and no level, and the page says how to start instead of calling
  it a bet (until 2026-10-31 it said "a large bet").
- A halving: (held + unvested units) × 50% + the fall in every option's spread from price to half the price.
- **Who works there**: an adult, never a child: the person named, else the first adult with a salary on Income, else the adult
  marked Me. Pay is their salary and bonus rows; a row that names no adult counts as Me's, as on the federal estimate
  (`taxInputs`).
- **Vests in the next 12 months**: RSU shares are wages at their fair market value when they are delivered, normally the vest
  date (IRC 83(a); IRS Pub. 525 (2025), Restricted Property: "When the property becomes substantially vested, you must include
  its FMV, minus any amount you paid for it, in your income for that year"; the Pub. has no RSU-specific sentence, its RSU
  mentions are under Qualified Equity Grants, read 2026-10-31). The tax they add is worked a calendar year at a time: the
  federal estimate for that year (`taxInputs`: today's year through `todaysReturn`; the year set on the Federal estimate with
  its typed sales; another year with that year's tables and no typed sales). The year's **earlier vests** (dated up to today,
  valued at today's price, as `career/equity` does: the price on each vest day is not stored) go into the employee's wages and
  Medicare wages first, then the vests in view are added, less the total without them. So it crosses brackets, the standard
  deduction and phase-outs, and includes the 0.9% Additional Medicare Tax. Each vest takes its share by value (`owed`). Filing
  separately, the wages go on the employee's own return (`addIncome`, in taxes/federal), or on the return the estimate puts added income on
  when that person has none. Vests more than 12 months out are not counted, in any year. A year whose tables the IRS has not
  published yet (2027 on 2026-10-31: Rev. Proc. 2025-32 covers 2026, and no 2027 release had appeared) uses the latest table
  raised for inflation (`paramsFor`), and the page says that year's figures are an estimate (`vestYears[].estimated`).
- **Withheld** (`supplementalWithholding`): IRS Pub. 15 (2026), section 7: "Withhold a flat 22% (no other percentage
  allowed)" on supplemental wages identified separately, and "If a supplemental wage payment, together with other
  supplemental wage payments made to the employee during the calendar year, exceeds $1 million, the excess is subject to
  withholding at 37%" (What's New: the rate "remains 22% (37% if supplemental wages paid to an employee during the calendar
  year exceed $1 million)"; 26 CFR 31.3402(g)-1; read 2026-10-31). The year's earlier vests count toward the $1 million; other
  bonuses are not known, so they do not. The 37% is on the excess only, which the rule requires; an employer may withhold 37%
  on the whole payment that crosses $1 million (26 CFR 31.3402(g)-1(a)(4)(iv): "only on the portion of the payment that is in
  excess of $1,000,000 ... However, an employer may subject the entire amount"). The flat 22% is optional for an employer only
  when it withheld income tax from the employee's regular wages this year or last (31.3402(g)-1(a)(7)(i)(C)); otherwise it
  adds the vest to regular pay and uses the tables (Pub. 15, section 7). The page cannot see that, so with no pay from the
  employer on Income it says to check (`payOnFile`). Plus the employer's 0.9% Additional Medicare Tax: Pub. 15 (2026), section 9: "you must
  withhold a 0.9% Additional Medicare Tax from wages you pay to an employee in excess of $200,000 in a calendar year"; it looks
  only at the wages that employer pays, not the filing status (IRC 3102(f)(1)). The employer's wages = the person's pay on
  Income, or with no pay there the wages typed on the Federal estimate (their own return's when filing separately, half for
  a joint return of two adults); then 0.9% × (wages + earlier vests + the year's vests in view − 200,000, at least 0) − 0.9% ×
  (wages + earlier vests − 200,000, at least 0), shared by value. Gap = owed − withheld, **a year at a time** (`vestYears[].gap`):
  tax withheld in one calendar year is credited only on that year's return (IRC 31(a)(1)), so the page says what to set aside,
  or what comes back, for each year apart. `vestGap` is still the sum, for other pages.
- **The whole tax year** (`wholeYear`, round 8, equity-2; only when today's tax year has vests): every vest dated in today's
  tax year, the ones already paid out too, against the federal return without any of them: owed = tax with them - tax
  without; withheld = 22% supplemental (37% past $1 million) + the 0.9% Medicare on the employee's wages past $200,000
  (IRC 3102(f)); gap = owed - withheld. The page's "For 2026: set aside" line uses it, so it covers the year's return as
  Equity compensation does (Mo: 525 units x 200 = 105,000 vesting in 2026, 1,398 to set aside, the same as Equity's;
  `vestYears` holds only the vests still to come, the December 1 vest's 300, and stays as the answer key checks it). The
  Federal estimate counts the same vests in wages (taxes/federal `known.js` `stockStep`), and Withholding check adds their
  withholding to what the paychecks take out.
- **State** (`stateExtra`): the state estimate's rate on the vests above today's income (and this year's earlier vests): its
  rate above its allowance for a flat or typed rate, last year's share of income for "prior", nothing in a state without an
  income tax or one the estimate cannot work out. Shown on its own line whatever the federal gap. Filing separately it starts
  from the employee's own return's income (the federal estimate's part for that person), with one person's allowance: a
  state that follows the federal status has each spouse file with their own income and exemption (Illinois: 35 ILCS
  5/502(c)(1)(C), "if the federal income tax liability of either spouse is determined on a separate federal income tax
  return, they shall file separate returns under this Act"; IL-1040 instructions, Line 10a, "Single filing status includes
  ... Married filing separately"). Until 2026-10-31 it took both returns' income added up, so a spouse's pay used up the
  employee's allowance. The allowance and rate are the state estimate's (`taxes/state`, claude-a's lane): its Illinois
  exemption is $2,850 a person, which is 2025's figure (Illinois Department of Revenue, "What is the Illinois personal
  exemption allowance?": "For tax year beginning January 1, 2026, it is $2,925 per exemption", and none above federal AGI of
  $250,000, $500,000 joint; read 2026-10-31), asked of claude-a on the WORKBOARD; this page follows whatever that page holds.
  Social Security and the 1.45% Medicare tax are withheld as owed, so they make no gap.
- Until 2026-10-31 the gap was value × (the marginal rate, at least 10%) − 22%: one rate whatever the size of the vest,
  no 37% past $1 million and no 0.9%, and next year's vests at this year's rate. Later that day, before a review: the year's
  earlier vests were left out (a December vest taxed as the year's first), the two years' gaps were added into one sentence,
  the state's share used the effective rate on income without the vests ($0 with no other income) and showed only with a
  federal shortfall, a child could be taken as the employee, and pay with no one named was left out of the 0.9%.
- **Getting under 10%**: sell = min(held value, exposure − 10% × invested), from retirement plans first (no tax), then the
  brokerage. Its result is the brokerage shares' average gain or loss (gains and losses together) × the amount sold, taken as
  shares owned over a year (the lots are not known). It is added as long-term sales to today's tax year on the Federal
  estimate (`taxInputs` with the year's typed sales), with this year's vests (earlier and in view) in the employee's wages;
  the tax is that less the same without the sale. A gain is stacked through the 0/15/20% bands and the 3.8% (IRC 1(h),
  1411). A loss first cancels the year's other gains, then comes off other income up to $3,000 ($1,500 filing separately),
  and the rest carries over (IRC 1211(b): losses are allowed "to the extent of the gains from such sales or exchanges, plus
  (if such losses exceed such gains) the lower of (1) $3,000 ($1,500 in the case of a married individual filing a separate
  return), or (2) the excess of such losses over such gains"; IRC 1212(b); `carry` by `lossCarryover`, the IRS worksheet).
  Then `tax` is negative: the tax the sale saves this year. Filing separately, each brokerage account's part goes on its
  owner's return (Pub. 501: each spouse reports their own income; `investments/tax-lots` does the same), half on each when
  the account names neither. The sale's tax is federal only, and the page says "federal tax"; a state's tax on the gain is
  not added. Until 2026-10-31 it was the gain × the rate on $1,000 more; then, briefly, on the employee's return and without
  this year's vests; until later that day a loss was taken as a $0 gain. Options expire 10 years after grant (the usual
  term); flagged within a year.

## Answer key
`tools/golden_employer_stock` works 1,500 vesting schedules and 2,500 households (single, joint, separate; Illinois and no
state tax; RSUs and options; brokerage and 401(k) shares) from IRC 83, 1(h), 1211, 1222, 1411, 3101(b)(2) and 3102(f), 26 CFR
31.3402(g)-1, Rev. Proc. 2025-32, Pubs. 15 and 525, Form 8959 and the Illinois Department of Revenue, never from this code,
by two derivations that agree on every row; `tests/golden-employer-stock.test.mjs` compares (rules: `tests/golden/employer-
stock/RULES.md`). The first run (2026-10-31) agreed on every schedule, vest, withholding, year and sale but two causes, both
fixed the same day: the level "large" with no stake (13 rows), and filing separately the state's share on both returns'
income (1 row). Its review found two more page errors: a sale at a loss taken as $0 (243 sales; fixed, now compared against
the law's columns) and Illinois' 2026 exemption (62 Illinois years, by $3.71 a person; taxes/state, asked of claude-a). Reported,
not failed: 2027 against the 2026 tables held flat (2027 is an estimate either way), the whole crossing vest at 37% (148
years: an employer may), Illinois' income limit (78 years), the state's tax on the sale, and 165 rows with no pay on file
for the 22%.

## Edge cases
- Only a symbol, no shares: the page shows the empty stake. A grant without a start date or shares is skipped.
- Options under water count at 0. A stake still over 10% after selling every share held says why.

## Tests
`module.test.mjs`: the vesting schedule (cliff, monthly, an end date off the step, empty), not ready, the stake by hand,
a halving, the next year's vests (each its share of its year), getting under 10%, a small stake, the supplemental withholding
(22%, 37% past $1 million), a $100,000 vest crossing from 22% to 24% (23,364 owed, 22,000 withheld), the 0.9% Medicare tax
owed and withheld, $1.2 million of vests, a sale stacked across the 0% and 15% bands, a December vest after $300,000 of
earlier ones (35,900 owed, 22,900 withheld) and after $900,000 (200,000 of it at 37%: a 15,000 gap), two years' gaps apart
(2026: 78,384.25 owed, 67,170 withheld; 2027 from the indexed 2027 tables), filing separately (the sale on the account
owner's return: 2,917.50; half each for an account in neither name), a child never the employee, the 0.9% from typed
wages and from pay with no one named, the state's share in Illinois (with and without other income; filing separately on
the employee's own return: 4.95% × (50,000 − one exemption)), no level without a stake, a sale at a loss (45,000: 360
saved, 42,000 carried; with a 10,000 typed gain 32,000 carried; filing separately 180 saved, 43,500 carried), the estimate
flag on 2027 and the no-pay flag, a sale stacked on this year's vest (all at 15%), the set year's typed sales, `addIncome`;
hand-worked from the 2026 brackets (Rev. Proc. 2025-32). The answer key above runs 14,008 more.

## Ideas / not yet
- ESPP: the discount, the offering and purchase dates, qualifying sales (two years from the offering, one from the purchase).
- Incentive options and the alternative minimum tax on exercise.

Review 2026-11-06 (round 7): "at the same time as your 98,000 a year of pay depends on the same company" says your for the unnamed first adult ("Me") and "your spouse's" for the unnamed partner; typed names read as before (core/words.js; view only).

## Each year's set-aside covers that whole year (round 8 review, 2026-11-06)
- **`wholeYears`:** one row per year in `vestYears`. Each works the tax on every vest dated in that year, not only those
  in the next 12 months: the Federal estimate for that year with and without them, and what is held back (22%, plus 0.9%
  Medicare past 200,000).
- **Why.** "For 2027: set aside about $52" counted March to September 2027; Equity compensation counts all four 2027
  vests. `wholeYear` is today's year's row.
- **The whole return:** under the set-aside, the page now says what the whole return comes to with the paychecks counted
  too (`taxAnswer`, the Federal estimate's answer). The stock's own gap is not the April bill: the equity couple's stock
  adds 1,398, and the return owes 6,338.
