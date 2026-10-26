# Refinance  (`debt/refinance`)

**Status:** usable (phase 4)
**Purpose:** Whether a refinance offer pays: the new payment, when the closing costs are earned back, and the interest either way.

## Inputs
Plan sections read (`needs`): the mortgage (through the Mortgage page compute), `debtPlan.refinance` (`{ rate, termYears, closingCosts, yearsStaying }`). Writes: `debtPlan.refinance`.
`compute(plan, { today, rate, termYears, closingCosts, yearsStaying })`.

## Outputs
`current`, `offer` (payment, months, totalInterest), `monthlySaving`, `breakEvenMonths`, `yearsStaying`, `interestWhileStaying` (current, offer), `netWhileStaying`, `verdict`, `extraYears`, `needsOffer`, `hasData`.

## Formulas
- New payment: `pmt(rate/12, term months, balance)`; whole-loan interest from `amortization`.
- Break-even months = closing costs / monthly saving (null when the payment does not fall).
- Interest while staying: month-by-month interest for the years you expect to keep the home, both loans, same start balance; net = current interest - offer interest - closing costs.
- Verdict: worth it when the net beats half the closing costs and 500; close call when positive; not worth it otherwise.

## Tests
`tests/debt-pages.test.mjs`, `module.test.mjs`.

## Ideas / not yet
- Cash-out refinance, points as a rate buydown, comparing two offers side by side.
