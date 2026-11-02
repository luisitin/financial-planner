# Credit cards  (`debt/credit-cards`)

**Status:** usable (phase 4)
**Purpose:** How much of your card limits you use, what paying the minimum really costs, and whether a balance transfer helps.

## Inputs
Plan sections read (`needs`): `accounts` (type credit), `debts` (rate, minimum payment, `creditLimit`), `debtPlan.transfer` (`{ months, feePct }`). Writes: `debtPlan.transfer`.
`compute(plan, { today, promoMonths = 15, feePct = 0.03 })`.

## Outputs
`cards[]` (`balance`, `limit`, `utilisation`, `rate`, `minPayment`, `interestMonthly`, `trap`, `transfer`, `dueLater`), `totalBalance`, `totalLimit`, `utilisation`, `interestMonthly`, `count`, `missing[]`, `hasData`.

## Formulas
- Utilisation = balance / limit, per card and combined; 30% is the usual line, 10% the best.
- Minimum-payment trap: `minimumOnly` (`core/math/payoff.js`) with the card's required payment, or, when none is set, 2% of the balance owed at the start of each month (before that month's interest) with a 25 floor, worked again every month as Regulation Z's sample calculation does (12 CFR 1026 Appendix M1 (b)(1), (b)(3) and Appendix M2): months and interest until zero, or never when a payment is at or below the month's interest (1026.7(b)(12)(ii)). Checked against `tools/golden_debt` (`tests/golden-debt.test.mjs`).
- Balance transfer: interest over the promo months at the card's rate when paying max(required, balance / promo months) each month, against the fee (balance x fee %); `saves` = interest - fee; `payToClear` = (balance x (1 + fee)) / promo months.

## Tests
`tests/debt-pages.test.mjs`, `module.test.mjs`.

## What you really pay, and how to get under 30% (round 4, 2026-11-02)
- `cards[].paying`: when the Debts page's payment is more than the required amount, each card leads with it: "You pay $400 a month: paid off about July 2028, $1,384 of interest to come" (the Debts page's own months, date and interest); the minimum-payment trap follows as "Paying only the $190 required: ...". Before, the page showed only the trap, never what the family pays.
- `under` = `underLines(cards, totalLimit, today)`: less30 = balances - 30% of the limits, less10 = balances - 10% (floor 0); date30/date10 = the first month the balances, each paid down at its own payment with interest at its rate each month (balance x (1 + rate/12) - payment), come to 30% / 10% of the limits or less (today when already there; null when not within 50 years, e.g. no payment). The hero says "$1,900 less on the cards gets you under 30%: about June 2027 at what you pay now, and under 10% (best for your score) about March 2028" with a link to the payoff plan. 30% and 10% are the usual credit-score lines (the page's own wording, from the Consumer Financial Protection Bureau's and the scoring companies' guidance).
- The balance transfer line names its interest: "against the $1,229 of interest the card would charge over those 15 months".

## Ideas / not yet
- Statement-date awareness for utilisation, rewards and annual fees.
