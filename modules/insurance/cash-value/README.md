# Cash-value model  (`insurance/cash-value`)

**Status:** usable (phase 8)
**Purpose:** A whole or universal life policy you already own, as an investment: the return it has earned on the premiums so far, what cashing it in would leave after tax, the return from here if you keep paying, and keeping it against cashing in, buying term for the same cover and investing the rest.

## Inputs
`insurance.policies` (kind `whole`: premium, period, benefit, cash value), `retirement.taxRate` (the tax on a gain), `assumptions` and `retirement.stocksNow` (the return on the alternative, via term-vs-permanent's `planReturn` less its `TAX_DRAG`). Writes six optional fields on a whole-life policy: `yearsPaid`, `surrenderValue`, `basis`, `laterYears`, `cashValueLater`, `termQuote`.

## Outputs
`compute(plan)` -> `{ items[], count, returnRate, taxRate }`; each item `{ id, name, personName, benefit, premiumYearly, cashValue, yearsPaid, surrender, basis, gain, tax, netCash, pastReturn, laterYears, cashValueLater, termQuote, keepReturn, altValue, breakeven, verdict: "cash-in"|"keep"|"close"|null, missing[] }`.

## Formulas
Premiums at the start of each year (annuity due); `rateFor` and `fv` from `core/math/finance.js`.
- Surrender = the entered surrender value, else the cash value. Basis = the entered premiums paid, else premium a year x years paid. Gain = surrender - basis; tax on cashing in = max(0, gain) x the plan's tax rate (`DEFAULT_TAX_RATE` 22% without one): a gain on surrender is ordinary income (IRC 72(e)). Net cash = surrender - tax.
- Return so far = rateFor(surrender, years paid, premium, 0, due).
- Return from here (keep) = rateFor(illustrated cash value in L years, L, premium, surrender, due): the surrender value you leave in plus the premiums still to come, to the in-force illustration's projected value.
- Cash in instead: net cash invested now plus (premium - term quote) a year, at the plan's return less the tax drag: fv(r, L, premium - term, net cash, due). Breakeven = the rate at which that equals the illustrated value; cash in wins when r > breakeven + 0.25 points, keep when r < breakeven - 0.25.

## Edge cases
- No years paid: no return so far. No illustration or no term quote: no verdict; the page lists what to ask for.
- A term quote of 0 means the cover is no longer needed: all of the premium is invested.
- Death benefit differences along the way, policy loans and the tax-free death benefit are not modelled; the page warns never to cancel before new cover is in force and names the 1035 exchange.

## Tests
`module.test.mjs`: no policy, the return so far and cashing in at a loss, the return from here, keep or cash in against the breakeven, the tax on a gain (with and without the plan's rate), missing figures and defaults.

## Ideas / not yet
- Universal life: cost of insurance rising with age, the chance it lapses; policy loans.
- Read the in-force illustration with the AI (the user clicks apply).
