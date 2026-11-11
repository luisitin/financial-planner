# Bracket explorer  (`taxes/brackets`)

**Status:** usable (phase 6)
**Purpose:** Which bracket your next dollar lands in, how much room is left before the next rate, and what a raise, bonus or conversion would really cost.

## Inputs
Everything the Federal estimate reads (`taxInputs`); `extra` (page state: the extra income to price, default 10,000).

## Outputs
`ordinaryTaxable`, `bracketRate`, `roomInBracket`, `nextRate`, `marginal` (the true rate on the next 1,000), `ladder[]` (each rung: from, to, how much of yours sits in it, the tax on that), `above[]` (the next slices of income and their rates), `extra` (tax, rate, the bracket it ends in, what you keep), `qualifiedNote`.

## Formulas
`bracketsFor`, `taxOnOrdinary` and `federalTax` in `core/math/tax.js`. The extra income is priced as the difference between two full returns, so benefits taxation, gains stacking and credit phase-outs are included.

Filing separately with two adults is two returns (the Federal estimate's `separate`, Publication 501): each spouse has a ladder of their own, so the page shows the return of the adult marked "Me" (the one more income lands on, `whose`), lists both returns' bracket, room and tax in `separate`, and keeps the household's tax and overall rate. The extra income is priced on the household's total, which adds it to that return.

## Edge cases
Qualified income is not on the ladder (it stacks above at the gains rates; a note says so). The top rung has no limit.

## Tests
`tests/tax-pages.test.mjs`, `module.test.mjs`.

## Ideas / not yet
- Price a Roth conversion here with the Medicare surcharge lines drawn on the ladder.

## One next dollar, one rounding (care fourth pass, 2026-11-02)
`marginal` is the Federal estimate's next dollar (`nextDollarOf`: over whole steps of the child care credit when it is in
play), so this page and the Federal estimate say the same cents; the overall rate goes through `ratePct`. Without the care
credit it is the next 1,000's cost, as before. `careMoves` (the next dollar with the care against without it) lets the
"Next dollar" stat say why it is off the bracket: "more than the bracket: the child care credit gets smaller" (Jo at 88,000:
14%), or "less than the bracket: the child care credit covers part of the tax on more pay"; it said "benefits or gains get
pulled along".

## Review 2026-11-06
- Credits more than the tax (Jo at 30,000: -1,700; two children: -1,162) read "the credits are more than the tax, so you
  pay no federal income tax and about $1,700 of credits come back", not "overall you pay -5.7%". Test: "credits more than
  the tax read as no tax".
- **A 0% next dollar (follow-up to the verifier).** "Less than the bracket: the child care credit covers part of the tax on
  more pay" was shown when more pay costs nothing. At 0% the stat now says "the child care credit covers the tax on more
  pay" when that credit alone covers all the income tax (`careCoversTax`: care credit >= income tax; Jo at 30,000: 585 of
  credit on 585 of tax), else "with the child care credit, the credits cover the tax on more pay" (Lee, head of household,
  45,000, two children, 10,800 of care: 2,100 of care credit on 2,148 of tax, the child tax credit the rest), as the Federal
  estimate says it. Above 0% the words are unchanged. Test: "a 0% next dollar is not 'covers part of the tax'".
- **The child care credit named only when it moves the next dollar (verifier, E).** `careMoves` compared the next dollar
  worked over the credit's whole step (4,000 joint) with the 1,000 probe without care, so a bracket's edge or the refundable
  child tax credit's limit inside the step read as the credit: Pat & Sam (joint, 98,800 taxable, 2,000 below 22%, a flat
  1,050 credit) read "17% more than the bracket: the child care credit gets smaller"; H-0319 (the credit 0) "the child care
  credit covers part of the tax on more pay". With the Federal estimate's `nextDollarOf` fixed (its credit part over the
  step, the rest over 1,000) both read the bracket: 12% and 6%. Test: federal "a bracket's edge inside the care credit's step".
- **One threshold with the Federal estimate (fix round 6).** `careMoves` is the Federal estimate's
  `careMovesNextDollar(marginal, the 1,000 probe without the credit)`: half a cent or more, to the billionth (it was
  > 0.0005 here and > 0.005 there; 12 of 1,500 random households disagreed). The words only change where the figure is
  half a cent or more from the bracket, so no qa household's page text moves. Test: "Brackets and the Federal estimate use
  one threshold".

## The Federal estimate's return (round 8 review, 2026-11-06)
- **The ladder:** the ladder, the bracket, the room, the slices above and "what more income would cost" are worked on
  `known(plan).inputs`. That is a business at its profit, this year's withdrawals, stock pay and rentals after costs.
- **The totals:** `totalTax` and `effectiveRate` are `known().total` and `.rate` (self-employment tax and the extra 10% on
  an early withdrawal in them).
- **Filing separately:** each return's tax is the Federal estimate's return total (`known().returns`), so the two add up to
  the household's.
- **Why.** The freelancer read "the 22% bracket" here while the Federal estimate said 12%.
- **The Deductions tile:** it shows the deduction (standard or itemized, with the senior deduction) plus the 20% business
  deduction (`businessDeduction` = `result.deduction.qbi`, IRC 199A; taken after AGI and before the ladder). When there
  is a business deduction, the tile names both parts, so AGI less the tile is the ladder's taxable income. For the
  freelancer this is AGI 69,489.48 − 16,100 − 10,677.90 = 42,711.58. Test: "the Deductions tile names the business
  deduction".
- **The next dollar under a business deduction:** while the 20% business deduction is held to 20% of taxable income, one
  more dollar of other income adds 80 cents of taxable income (IRC 199A(a)(2)). So the next dollar costs bracket × 0.8:
  9.6% in the 12% bracket. The tile then says "less than the bracket: the 20% business deduction grows with it".
- Review round 2: the note on dividends and gains writes its amount with "$".

## Stress test 2026-11-11 (touch and input)

- "What more income would cost" redraws only the answer under the chips and the box (x-3, x-redraw-on-change); with nothing earned on file the card is left out and the hero carries a filled "Add your income" (T3).
- No "you are here" on the ladder until there is income (claude-r N5).
