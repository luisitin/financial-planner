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
