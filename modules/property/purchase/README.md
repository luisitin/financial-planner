# Big purchase planner  (`property/purchase`)

**Status:** usable, phase 7
**Purpose:** Any big purchase: save up by the date you want it, finance it now or pay cash, and which goals would give way.

## Inputs
- `whatIfs.purchase = { name, price, salesTax, when, saved, apr, termMonths, promoMonths }` (defaults in `DEFAULTS`: a $3,000 example).
- The money left each month (`overview/next-best-action` `spare.monthly`: income after tax, spending and saving).
- Goals with their monthly saving, priority, date, money set aside and growth rate (`goals/goals`).
- Usable cash and the emergency target (`balance/liquidity`); the cash return (`assumptions.returnCash`).

## Outputs
`{ ready, inputs, total, saved, months, spare, save: { monthly, months, earned } | null, finance: { principal, payment, months, interest, promo }, cash: { fits, after, target }, effect: { save, finance }, previewed? }`.
`compute(plan, { today, previews? })`: `previews` and `previewed` are in "Our guess in the rate box" below. Also exported: `PREVIEWED`.

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

## Our guess in the rate box (smart guesses C9 second stage, 2026-11-14; spec 12.1 "K3 previews")
An empty **The payment plan's rate** box shows our guess in gray, **22.4**, with one line under it: "Our guess: the average
rate on cards that charge interest." The answer counts it while the box stays empty, on this page only, and says so beside
the rate: "24 months at 22.4% (our guess): $749 of interest, so it costs $3,749." (Riley, the $3,000 example). An empty box
saves `null`, never the figure, and no `plan.guesses` entry is made; opening the page writes nothing. Without
`params.previews` `compute` is exactly as before (module test, on five plans).

| box | estimator | formula and table |
|---|---|---|
| the payment plan's rate | `debt.credit.rate` (the guesses module's; the same figure Debts and Get started give a credit card) | the Federal Reserve's average rate on credit card plans, accounts assessed interest, commercial banks: **22.36%**, to a tenth of a point (R11) **22.4%**. Table `cc_apr_fed_g19`: Board of Governors of the Federal Reserve System, G.19 Consumer Credit, "Terms of Credit", release of 2026-10-07 (2026 Q3, August survey, preliminary), read 2026-11-02 |

Choices made here:
- **A card's rate, not a store card's.** A store's payment plan is often a store card, which usually charges more than the
  average card; no table of store card rates is bundled, so the gray figure is the average card that charges interest and the
  line says exactly that. The old help line ("store cards often charge 25% to 30%") named no source and is gone; the
  cross-review on docs/WORKBOARD.md (2026-10-31) points to a CFPB finding of about 33% on new store cards, which is not
  bundled or checked here, so no store-card figure is shown. A sourced store-card table would make a closer gray figure.
  The help line adds "Many store plans charge no interest at first." (critic e9 P4, 2026-11-14: 22.4% on a sofa could read as
  the store's quote; "Months at 0%, if offered" under "More details (optional)" takes such a plan). To keep the first view
  inside its count, the hero says the same in fewer words ("Here is what each costs and does to your other goals."; "Until
  you say what you want to buy, it shows a $3,000 example."). Not done: a gray "3,000" in the Price box. Price is required
  (Compare refuses it empty), so a gray figure there would say an empty box counts while Save turns it away; the example
  stays named in the hero and as the first figure, "Price $3,000".
- **No gray figure without a table**: the length (24 months), sales tax (none), what is set aside (none) and the months at 0%
  (none) open empty, each with its help saying what an empty box counts ("Left empty, we count 24 months."). Before, the
  form opened with 22, 24, 0, 0 and 0 typed in the boxes and saved them as the person's.
- **The figures**: the purchase's five boxes first (what, price, when, set aside, the rate), length, sales tax and 0% months
  under "More details (optional)" (docs/OPTIONAL.md R21); a part (`parts()`), open until a purchase is saved, then shut with
  the total as its status ("our guess" while the rate is ours). After "Compare" it stays open and the green line names the new
  answer ("Saved. The purchase: $2,400, or $125 a month on the payment plan.", R7, R17). "More on this" is `links()`
  ("Which goals would wait?", "What should we save for first?"). No hand-written `<details>` remain.
- Without a guess (another currency, outside the U.S., or a shell without `ctx.guess`) the rate box is empty with "Left
  empty, we count 22% a year." and the page counts `DEFAULTS.apr` as before.

## Edge cases
- No date: no saving plan; finance and cash still compared. Nothing spare: everything comes from goals.
- Goals already done or saving nothing are never touched.

## Tests
`module.test.mjs`: the example, saving up by hand, three kinds of financing, a purchase that fits, giving way in order
(paused, delayed, uncovered), a boat that squeezes the goals. C9: the card rate from its table (and none in another
currency), invariance without previews, the preview only in an empty box, and the page drawn: the gray figure, "(our guess)"
outside any fold, opening writes nothing, "Compare" with the box empty saves no figure and no guess (S11), a typed rate ends
the gray figure, and no guess for another country or without `ctx.guess`.

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

## Touch and input stress test (2026-11-11, claude-g)
- "Price" is required (1 or more): Compare with it empty did nothing at all (x-2).
