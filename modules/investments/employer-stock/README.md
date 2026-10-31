# Employer stock  (`investments/employer-stock`)

**Status:** usable, phase 7
**Purpose:** How much of your wealth rides on the company you work for, when its grants vest and the tax they bring, and how to bring the stake down.

## Inputs
- `equity = { symbol, price, priceAsOf, personId, grants: [{ id, kind: "rsu"|"option", name, granted, vestStart, shares, strike, vestMonths, cliffMonths, every }] }` (written here; `career/equity` is to reuse it).
- `holdings[]` with that symbol, in any account (through `investments/holdings`).
- Net worth's investable total (`balance/net-worth`), the pay of the person who works there (`cashflow/income`),
  the federal estimate's inputs (`taxes/federal` `taxInputs`, `todaysReturn`; `federalTax`) and the state's share (`taxes/state`).

## Outputs
`{ ready, symbol, price, priceAsOf, held, heldValue, grants: [{ ..., vested, unvested, vestedValue, unvestedValue, next, expires, schedule }], owned, unvested, exposure, invested, share, level, person, pay, stress, vests: [{ date, grant, shares, value, withheld, owed, gap, stateOwed }], vestYears: [{ year, value, owed, withheld, over1m, medicare }], vestGap, diversify: { sell, fromPlans, fromTaxable, gain, tax, after, stillOver }, rates, year, otherYear, expiringSoon }`.

## Formulas
- Vesting (`vestSchedule`): the cliff's share at `cliffMonths` (default 12), then every `every` months (default 3) to
  `vestMonths` (default 48); cumulative whole shares = floor(grant × months / vestMonths), each vest the difference.
- Price: the typed price when it is at least as new as the holdings' newest, else the holdings' price.
- Owned = held shares × price + vested options × max(0, price − strike). Still to vest = unvested units × price +
  unvested options × the same spread. Vested units are assumed listed on Holdings (or sold), so they are not counted twice.
- Share = (owned + still to vest) ÷ (net worth's investable money + vested options' spread + still to vest). Up to 10%
  is the usual single-stock ceiling; above 25% a large bet.
- A halving: (held + unvested units) × 50% + the fall in every option's spread from price to half the price.
- **Vests in the next 12 months**: each is wages at its value that day (IRC 83(a); IRS Publication 525, Restricted
  Property). The tax they add is worked a calendar year at a time: the federal estimate for that year (`taxInputs`;
  today's year through `todaysReturn`, a later year with `taxes.year` set to it and no typed sales) with the year's vests
  added to the person's wages and Medicare wages, less the total without. So it crosses brackets, the standard deduction
  and phase-outs, and includes the 0.9% Additional Medicare Tax. Each vest takes its share by value (`owed`). Filing
  separately, the change goes on the employee's return (`separateTo`).
- **Withheld** (`supplementalWithholding`): 22% federal income tax on supplemental wages, and 37% on the part of the
  year's supplemental wages past $1 million (IRS Publication 15, Supplemental wages; 26 CFR 31.3402(g)-1), counting the vests
  in view in date order (other bonuses in the year are not known, so they are not counted toward the $1 million); plus the
  employer's 0.9% Additional Medicare Tax withholding on the person's wages from it past $200,000 in the year, whatever the
  filing status (IRC 3102(f)): 0.9% × (pay + the year's vests − 200,000, at least 0) − 0.9% × (pay − 200,000, at least 0),
  shared by value. Gap = owed − withheld (below 0 the withholding is more than the tax added). The state's share is
  shown apart (value × the state's effective rate). Social Security and the 1.45% Medicare tax are withheld as owed, so
  they make no gap.
- Until 2026-10-31 the gap was value × (the marginal rate, at least 10%) − 22%: one rate whatever the size of the vest,
  no 37% past $1 million and no 0.9%, and next year's vests at this year's rate.
- **Getting under 10%**: sell = min(held value, exposure − 10% × invested), from retirement plans first (no tax), then the
  brokerage. Its gain is the brokerage shares' average gain × the amount sold, taken as a gain on shares owned over a year
  (the lots are not known); the tax is the federal estimate with that gain added to the year's long-term gains and
  investment income, less without, in today's tax year, so it is stacked through the 0/15/20% bands and the 3.8% (IRC
  1(h), 1411). Until 2026-10-31 it was the gain × the rate on $1,000 more. Options expire 10 years after grant (the
  usual term); flagged within a year.

## Edge cases
- Only a symbol, no shares: the page shows the empty stake. A grant without a start date or shares is skipped.
- Options under water count at 0. A stake still over 10% after selling every share held says why.

## Tests
`module.test.mjs`: the vesting schedule (cliff, monthly, an end date off the step, empty), not ready, the stake by hand,
a halving, the next year's vests and the withholding gap, getting under 10%, a small stake, the supplemental withholding
(22%, 37% past $1 million), a $100,000 vest crossing from 22% to 24% (23,364 owed, 22,000 withheld), the 0.9% Medicare tax
owed and withheld, $1.2 million of vests, vests in two calendar years, a sale stacked across the 0% and 15% bands, all
hand-worked from the 2026 brackets (Rev. Proc. 2025-32).

## Ideas / not yet
- ESPP: the discount, the offering and purchase dates, qualifying sales (two years from the offering, one from the purchase).
- Incentive options and the alternative minimum tax on exercise.
