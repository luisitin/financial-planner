# Allocation  (`investments/allocation`)

**Status:** usable (phase 7)
**Purpose:** Your mix by asset class across every account against the mix you aim for, and how far each class has drifted.

## Inputs
Holdings (`investments/holdings`), `investments.target` (`{ us_stocks, intl_stocks, bonds, cash, real_estate, other }` fractions, or null = built from `retirement.stocksNow`: 60/40 US/international, the rest bonds), `investments.band` (0.05).

## Outputs
`rows[]` per class: actual and target fractions, drift, dollars held, dollars to move, `flagged` and why; `flaggedCount`, `worst`, `stockShareActual` / `stockShareTarget`, `unknownValue`, `coverage` (holdings against the Net worth balances), `byAccountClass[]`, `notes`. `targetMix(plan)` is shared with the Rebalance, Risk and Backtest pages.

## Formulas
The 5/25 rule: a class is flagged when its drift exceeds the band (5 points) or a quarter of its own target. Balanced and target-date funds count by their split. Unclassified holdings are left out of the percentages and named in a note.

## No verdict against a mix nobody chose (2026-11-02)
Until the owner saves a target, the page used to measure the holdings against one built from the Projection's 70% stock
share and say "3 classes have drifted past the band ... trim $69,581" to a 36-year-old holding 92% stocks, mostly in a
2055 target-date fund (which holds about 90%). Now `verdict` is:
- `"pick"` with no target of your own: the hero states the mix ("You hold 92% stocks and 8% bonds and cash"), no class
  is "off target", and `choices` offer one tap: what I hold now, what my target-date fund holds (its year from the largest
  dated fund held; `targetDateMix` in holdings), the plan's mix (`retirement.stocksNow`), or type my own. A choice changes
  only how much is in stocks: inside stocks it keeps the US/international split held, inside the rest the bonds/cash
  split, so picking 90% while holding 92% is "close to the target", not a $48,000 trade between US and international.
  Saving one whose stock share differs from the Projection's by 5 points or more offers "Use 90% stocks on the Projection
  too" (`retirement.stocksNow`), so Projection and Allocation agree.
- `"partial"` when classified holdings are under `KNOWN_ENOUGH` (80%) of the money invested (the larger of the holdings
  and the Net worth balances of investment accounts): "Add what's in your other accounts first".
- `"drift"` / `"ok"` as before, against the owner's own target.

## Edge cases
No holdings: the target form still works. Accounts without holdings are not in the mix; a note gives the coverage.

## Tests
`tests/investments.test.mjs`, `module.test.mjs`.

## Ideas / not yet
- Sub-classes (small caps, emerging markets), regions, a donut chart if the designer wants one.
