# Pay off debts  (`debt/payoff`)

**Status:** usable (phase 4)
**Purpose:** One plan for every loan and card: the same money each month, highest rate or smallest balance first, and the date each one is gone.

## Inputs
Plan sections read (`needs`): `accounts` and `debts` (through the Debts page compute: a debt needs a rate and a required payment), `debtPlan` (`{ extra, order, customOrder }`). Writes: `debtPlan`.
`compute(plan, { today })`.

## Outputs
`debts[]` (with `required` and `extraSet` beside `minPayment`), `missing[]`, `extra`, `extraSaved`, `order`, `budget`, `required`, `alreadyExtra`, `tie`, `rollover[]`, `plans` (`avalanche`, `snowball`, `custom`: `months`, `endDate`, `totalInterest`, `totalPaid`, `debts[]` with `endDate`, `timeline`), `chosen`, `best`, `plus100`, `baseline`, `hasData`.

## Formulas
`core/math/payoff.js` `payoffPlan`: each month interest is added (rate / 12 on the opening balance), every debt gets its required payment, and everything left of the budget (required payments + extra, plus payments freed by finished debts) goes to the target debts in order. Avalanche = highest rate first (least interest), snowball = smallest balance first, custom = the owner's order. `plus100` = the chosen order with 100 more a month. Baseline = required payments only.

## Carrying out the Dashboard's next move (2026-11-01, round 2 of the owner's experience list)
The Dashboard's filled "Your next move: Pay down the cards first" opened this page on "$615 required plus $0 extra", a date
years later than Next best action promised and a bare "0" box: the move came without an amount.
- **The offer.** Until an extra has ever been saved here (`extraSaved` false) and Next best action's next step is the costly or
  middling debt, a card offers Next best action's left-over (`spare.monthly`, after tax, bills and saving; floored to $10, at
  least $25): "You have about $4,170 left over each month ... Paid on top of the required payments until it is paid off, the
  Visa card is gone by about January 2027 instead of July 2030, with $3,729 less interest. Then the $4,170 is free again for
  your next step." A filled "Use $4,170 a month" saves `debtPlan = { extra, order, targets }` and confirms in green.
  `offer(plan, { today, amount, stepId })` in compute.js works it out (tested): the step's debts (rate of 10% or more, or 4% to
  10%, mortgages never, as Next best action counts them), the plan run with the extra aimed at them, and null when it would not
  end them sooner (no card then). When the next step is something else (the starter cushion, the match), there is no offer.
- **An aimed extra** (`debtPlan.targets`, 2026-11-01): the extra goes to those debts only, in the chosen order, and stops once
  they are paid off; the payments of finished debts still roll on to the next debt (`core/math/payoff.js` `takesExtra`). Before,
  the offer saved a plain extra, which kept paying $4,170 a month after the card was gone, until the mortgage ended in 2030, while
  the offer had only talked about the card and Next best action had moved on to the next step. The hero says "$2,580 a month
  (the required payments), plus $4,170 more on the Visa card until about January 2027"; the plan card says where the extra goes
  and offers "Keep it going to the next debts" (drops `targets`). Once they are all paid off (`targetsDone`), `extra` is 0, the
  amount is kept (`extraTyped`) and the card offers "Put $4,170 a month on the other debts". The Timeline and Net worth
  projection read the same plan, so they show the card paid off in January 2027 and the mortgage on its own schedule.
- **Live preview.** `params.extra` and `params.order` run the plan with another extra or order without saving; the Extra box (a
  money box: "$2,680") and the order redraw the date at the top as you type, marked "With what you typed below. Save the plan to
  keep it." Saving is still the Save plan button.
- **What the payment is made of.** `required` = the minimums, `alreadyExtra` = extras set on the Debts page (`debts[].extra`),
  `extra` = this page's. The hero reads "$2,790 a month ($2,580 required, $210 extra set on the Debts page)"; it used to say
  "$2,790 required plus $0 extra". Each debt's line reads "$190 a month required plus $210 extra".
- **Roll-over.** `rollover[]`: with no extra chosen here, a debt whose end in the plan is earlier than on its own payment (the
  Debts page's `payoffDate`) gets a line: "Mortgage: March 2039 here because, as the other debts are paid off, their payments
  move to it. On its own payment it ends January 2046, the date on the Debts page." The two pages gave the two dates silently.
- **Ties.** `tie` when every order ends the same month at the same interest (to the dollar): one sentence replaces the three
  equal rows and the trophy. When only some orders tie for least interest, each gets "least interest" and there is no trophy.
- The "$100 more a month" line stays (design log pass 2, round 10) except while the offer is shown, whose amount replaces it.

Pay from savings first (2026-11-02): when Next best action's expensive-debt step has `fromSavings` (cash above the full
cushion), a card at the top says how much and what cash stays, with "I moved it: update my balances"; the monthly offer
waits until then.

## Edge cases
Debts without a rate or payment are listed as missing and left out. A plan whose payments do not cover the interest reports "never" and the debts concerned. Dates need `today`.

## Tests
`tests/payoff.test.mjs` (the math against nper), `tests/debt-pages.test.mjs` and `module.test.mjs` (the page on the shared household; the payment split, the preview overrides, the roll-over and the tie). The math itself is unchanged and still matches the frozen key `tests/golden/debt/payoff.csv`.

## Ideas / not yet
- A payoff timeline drawing (designer), one-off lump sums, pausing a debt (0% promo).
