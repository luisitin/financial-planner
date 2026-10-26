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
- Minimum-payment trap: `minimumOnly` (`core/math/payoff.js`) with the card's required payment, or 2% of the balance with a 25 floor when none is set: months and interest until zero, or never.
- Balance transfer: interest over the promo months at the card's rate when paying max(required, balance / promo months) each month, against the fee (balance x fee %); `saves` = interest - fee; `payToClear` = (balance x (1 + fee)) / promo months.

## Tests
`tests/debt-pages.test.mjs`, `module.test.mjs`.

## Ideas / not yet
- Statement-date awareness for utilisation, rewards and annual fees.
