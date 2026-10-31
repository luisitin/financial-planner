# Employer stock  (`investments/employer-stock`)

**Status:** usable, phase 7
**Purpose:** How much of your wealth rides on the company you work for, when its grants vest and the tax they bring, and how to bring the stake down.

## Inputs
- `equity = { symbol, price, priceAsOf, personId, grants: [{ id, kind: "rsu"|"option", name, granted, vestStart, shares, strike, vestMonths, cliffMonths, every }] }` (written here; `career/equity` is to reuse it).
- `holdings[]` with that symbol, in any account (through `investments/holdings`).
- Net worth's investable total (`balance/net-worth`), the pay of the person who works there (`cashflow/income`),
  the federal estimate's inputs (`taxes/federal` `taxInputs`, `todaysReturn`; `federalTax`) and the state's share (`taxes/state`).

## Outputs
`{ ready, symbol, price, priceAsOf, held, heldValue, grants: [{ ..., vested, unvested, vestedValue, unvestedValue, next, expires, schedule }], owned, unvested, exposure, invested, share, level, person, pay, stress, vests: [{ date, grant, shares, value, withheld, owed, gap, stateOwed }], vestYears: [{ year, value, earlier, owed, withheld, gap, state, over1m, medicare }], vestGap, diversify: { sell, fromPlans, fromTaxable, gain, tax, after, stillOver }, rates, year, otherYear, expiringSoon }`.

## Formulas
- Vesting (`vestSchedule`): the cliff's share at `cliffMonths` (default 12), then every `every` months (default 3) to
  `vestMonths` (default 48); cumulative whole shares = floor(grant × months / vestMonths), each vest the difference.
- Price: the typed price when it is at least as new as the holdings' newest, else the holdings' price.
- Owned = held shares × price + vested options × max(0, price − strike). Still to vest = unvested units × price +
  unvested options × the same spread. Vested units are assumed listed on Holdings (or sold), so they are not counted twice.
- Share = (owned + still to vest) ÷ (net worth's investable money + vested options' spread + still to vest). Up to 10%
  is the usual single-stock ceiling; above 25% a large bet.
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
  when that person has none. Vests more than 12 months out are not counted, in any year.
- **Withheld** (`supplementalWithholding`): IRS Pub. 15 (2026), section 7: "Withhold a flat 22% (no other percentage
  allowed)" on supplemental wages identified separately, and "If a supplemental wage payment, together with other
  supplemental wage payments made to the employee during the calendar year, exceeds $1 million, the excess is subject to
  withholding at 37%" (What's New: the rate "remains 22% (37% if supplemental wages paid to an employee during the calendar
  year exceed $1 million)"; 26 CFR 31.3402(g)-1; read 2026-10-31). The year's earlier vests count toward the $1 million; other
  bonuses are not known, so they do not. Plus the employer's 0.9% Additional Medicare Tax: Pub. 15 (2026), section 9: "you must
  withhold a 0.9% Additional Medicare Tax from wages you pay to an employee in excess of $200,000 in a calendar year"; it looks
  only at the wages that employer pays, not the filing status (IRC 3102(f)(1)). The employer's wages = the person's pay on
  Income, or with no pay there the wages typed on the Federal estimate (their own return's when filing separately, half for
  a joint return of two adults); then 0.9% × (wages + earlier vests + the year's vests in view − 200,000, at least 0) − 0.9% ×
  (wages + earlier vests − 200,000, at least 0), shared by value. Gap = owed − withheld, **a year at a time** (`vestYears[].gap`):
  tax withheld in one calendar year is credited only on that year's return (IRC 31(a)(1)), so the page says what to set aside,
  or what comes back, for each year apart. `vestGap` is still the sum, for other pages.
- **State** (`stateExtra`): the state estimate's rate on the vests above today's income (and this year's earlier vests): its
  rate above its allowance for a flat or typed rate, last year's share of income for "prior", nothing in a state without an
  income tax or one the estimate cannot work out. Shown on its own line whatever the federal gap. Social Security and the
  1.45% Medicare tax are withheld as owed, so they make no gap.
- Until 2026-10-31 the gap was value × (the marginal rate, at least 10%) − 22%: one rate whatever the size of the vest,
  no 37% past $1 million and no 0.9%, and next year's vests at this year's rate. Later that day, before a review: the year's
  earlier vests were left out (a December vest taxed as the year's first), the two years' gaps were added into one sentence,
  the state's share used the effective rate on income without the vests ($0 with no other income) and showed only with a
  federal shortfall, a child could be taken as the employee, and pay with no one named was left out of the 0.9%.
- **Getting under 10%**: sell = min(held value, exposure − 10% × invested), from retirement plans first (no tax), then the
  brokerage. Its gain is the brokerage shares' average gain × the amount sold, taken as a gain on shares owned over a year
  (the lots are not known); the tax is today's tax year with this year's vests (earlier and in view) in the employee's wages,
  then that gain added to long-term gains and investment income, less without, so it is stacked through the 0/15/20% bands
  and the 3.8% (IRC 1(h), 1411). Filing separately, each brokerage account's part of the gain goes on its owner's return
  (Pub. 501: each spouse reports their own income; `investments/tax-lots` does the same), half on each when the account names
  neither. Until 2026-10-31 it was the gain × the rate on $1,000 more; then, briefly, on the employee's return and without
  this year's vests. Options expire 10 years after grant (the
  usual term); flagged within a year.

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
wages and from pay with no one named, the state's share in Illinois (with and without other income), a sale stacked on
this year's vest (all at 15%), the set year's typed sales, `addIncome`; hand-worked from the 2026 brackets (Rev. Proc.
2025-32).

## Ideas / not yet
- ESPP: the discount, the offering and purchase dates, qualifying sales (two years from the offering, one from the purchase).
- Incentive options and the alternative minimum tax on exercise.
