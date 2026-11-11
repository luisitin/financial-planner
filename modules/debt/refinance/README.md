# Refinance  (`debt/refinance`)

**Status:** usable (phase 4)
**Purpose:** Whether a refinance offer pays: the new payment, when the closing costs are earned back, and the interest either way.

## Inputs
Plan sections read (`needs`): the mortgage (through the Mortgage page compute), `debtPlan.refinance` (`{ rate, termYears, closingCosts, yearsStaying }`). Writes: `debtPlan.refinance`.
`compute(plan, { today, rate, termYears, closingCosts, yearsStaying })`.

## Outputs
`current`, `offer` (payment, months, totalInterest), `monthlySaving`, `breakEvenMonths`, `yearsStaying`, `interestWhileStaying` (current, offer), `netWhileStaying`, `verdict`, `extraYears`, `needsOffer`, `hasData`.

## Formulas
- New payment: `pmt(rate/12, term months, balance)`; whole-loan interest from `amortization`. When the mortgage page splits tax and
  insurance out of today's payment (`mortgage.escrow`, while the balance or payment is our guess; 2026-11-07), the same amount is
  added to the new payment, so `monthlySaving` = today's principal and interest less the new one, and the interest while staying
  is worked from the loan parts only (`current.toLoan`, `offer.toLoan`). A plan with its own payment and balance: escrow 0, nothing moves.
- Break-even months = closing costs / monthly saving (null when the payment does not fall).
- Interest while staying: month-by-month interest for the years you expect to keep the home, both loans, same start balance; net = current interest - offer interest - closing costs.
- Verdict: worth it when the net beats half the closing costs and 500; close call when positive; not worth it otherwise.

## Tests
`tests/debt-pages.test.mjs`, `module.test.mjs`.

## Ideas / not yet
- Cash-out refinance, points as a rate buydown, comparing two offers side by side.

## Touch and input stress test (2026-11-11, claude-g)
- The answer is one card right under Compare (D5): the verdict sentence, a green "Compared: $859 a month, $641 less than now." for
  each compare, then the four figures. The hero keeps the verdict word and today's loan. Typing a new offer marks the figures as
  the last offer compared until Compare is tapped again.
- "Add the mortgage" opens Net worth's add form set to Mortgage, with "Back to Refinance" after the save (DP-3).
- Follow-ups (2026-11-11): after Compare the answer card is brought up under the top bar; "Add its rate and payment" opens the
  mortgage's own form (`mortgageId` from compute) with a way back; "ends 13 years 10 months sooner", not "13.8 years".
