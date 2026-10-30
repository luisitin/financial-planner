# Employer stock  (`investments/employer-stock`)

**Status:** usable, phase 7
**Purpose:** How much of your wealth rides on the company you work for, when its grants vest and the tax they bring, and how to bring the stake down.

## Inputs
- `equity = { symbol, price, priceAsOf, personId, grants: [{ id, kind: "rsu"|"option", name, granted, vestStart, shares, strike, vestMonths, cliffMonths, every }] }` (written here; `career/equity` is to reuse it).
- `holdings[]` with that symbol, in any account (through `investments/holdings`).
- Net worth's investable total (`balance/net-worth`), the pay of the person who works there (`cashflow/income`),
  the federal estimate's rates (`taxes/federal` `taxInputs`) and the state's share (`taxes/state`).

## Outputs
`{ ready, symbol, price, priceAsOf, held, heldValue, grants: [{ ..., vested, unvested, vestedValue, unvestedValue, next, expires, schedule }], owned, unvested, exposure, invested, share, level, person, pay, stress, vests, vestGap, diversify, rates, expiringSoon }`.

## Formulas
- Vesting (`vestSchedule`): the cliff's share at `cliffMonths` (default 12), then every `every` months (default 3) to
  `vestMonths` (default 48); cumulative whole shares = floor(grant × months / vestMonths), each vest the difference.
- Price: the typed price when it is at least as new as the holdings' newest, else the holdings' price.
- Owned = held shares × price + vested options × max(0, price − strike). Still to vest = unvested units × price +
  unvested options × the same spread. Vested units are assumed listed on Holdings (or sold), so they are not counted twice.
- Share = (owned + still to vest) ÷ (net worth's investable money + vested options' spread + still to vest). Up to 10%
  is the usual single-stock ceiling; above 25% a large bet.
- A halving: (held + unvested units) × 50% + the fall in every option's spread from price to half the price.
- Vests in the next 12 months: each is wages at its value (IRS Publication 525); employers withhold 22% federal on
  supplemental wages (37% above $1 million; IRS Publication 15). Gap = value × (top rate − 22%); the state's share
  is shown apart.
- Getting under 10%: sell = min(held value, exposure − 10% × invested), from retirement plans first (no tax), then the
  brokerage at its average gain × the long-term gains rate. Options expire 10 years after grant (the usual term);
  flagged within a year.

## Edge cases
- Only a symbol, no shares: the page shows the empty stake. A grant without a start date or shares is skipped.
- Options under water count at 0. A stake still over 10% after selling every share held says why.

## Tests
`module.test.mjs`: the vesting schedule (cliff, monthly, an end date off the step, empty), not ready, the stake by hand,
a halving, the next year's vests and the withholding gap, getting under 10%, a small stake.

## Ideas / not yet
- ESPP: the discount, the offering and purchase dates, qualifying sales (two years from the offering, one from the purchase).
- Incentive options and the alternative minimum tax on exercise.
