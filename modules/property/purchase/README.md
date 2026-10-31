# Big purchase planner  (`property/purchase`)

**Status:** usable, phase 7
**Purpose:** Any big purchase: save up by the date you want it, finance it now or pay cash, and which goals would give way.

## Inputs
- `whatIfs.purchase = { name, price, salesTax, when, saved, apr, termMonths, promoMonths }` (defaults in `DEFAULTS`: a $3,000 example).
- The money left each month (`overview/next-best-action` `spare.monthly`: income after tax, spending and saving).
- Goals with their monthly saving, priority, date, money set aside and growth rate (`goals/goals`).
- Usable cash and the emergency target (`balance/liquidity`); the cash return (`assumptions.returnCash`).

## Outputs
`{ ready, inputs, total, saved, months, spare, save: { monthly, months, earned } | null, finance: { principal, payment, months, interest, promo }, cash: { fits, after, target }, effect: { save, finance } }`.

## Formulas
- Total = price × (1 + sales tax). Months to the date = whole months from today, the day of the month reached
  (`monthsBetween`: Oct 31 to Jun 30 is 7), at least 1.
- Save up: monthly = `pmtToReach(cash return / 12, months, total, already set aside)`; earned = total − set aside − monthly × months.
- Finance now, on total − set aside: a level payment `pmt(apr / 12, term, amount)`; all 0%: amount ÷ term; 0% for the first
  months then the rate: the level payment that clears it by the end (found by bisection: balance after the term = 0).
  Interest = payment × term − amount. (Deferred-interest store cards charge the whole interest if anything is left: named, not modelled.)
- Pay cash: usable cash − (total − set aside), against the emergency target (`cash.amount` = total − set aside; until
  2026-10-31 the whole total was taken from usable cash, though the screen showed the smaller amount).
- Goals give way (`giveWay`) when the monthly amount is more than the money left: least important first (priority 3,
  then 2, then 1), within a priority the latest due first; each gives up to its whole monthly saving; its new arrival =
  `solveMonths(rate / 12, set aside, new monthly, target)` (`goals/house`) against the old; a goal left at 0 is paused.
  What no goal covers is "more than you have".

## Edge cases
- No date: no saving plan; finance and cash still compared. Nothing spare: everything comes from goals.
- Goals already done or saving nothing are never touched.

## Tests
`module.test.mjs`: the example, saving up by hand, three kinds of financing, a purchase that fits, giving way in order
(paused, delayed, uncovered), a boat that squeezes the goals.

## Answer key
`tools/golden_property_goals` works 1,500 invented big purchases with 0 to 4 goals (save up, finance level, all at 0% or 0%
for the promo months, pay cash; done goals and a spare below 0) from the brief and its sources, never from this code, by two
exact derivations that agree on every value; `tests/golden-property-goals.test.mjs` compares (rules: `tests/golden/
property-goals/RULES.md`). It found one error here, fixed on 2026-10-31: paying cash took the whole total from usable cash,
not the total less what is already set aside, as this README and the screen say. Left for the owner, not failed: the promo
is a true 0% period, while a store's "no interest if paid in full" offer charges the interest back when it is not.

## Ideas / not yet
- Buy-now-pay-later plans (four payments) and their late fees.
- Waiting for a sale: the price drop needed to beat financing now.
