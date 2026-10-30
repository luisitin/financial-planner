# Renovation  (`property/renovation`)

**Status:** usable, phase 7
**Purpose:** A home project against what it adds to the home's value, and the cheapest way to pay: cash, a home-equity line, a cash-out refinance or a loan.

## Inputs
- `whatIfs.renovation = { project, cost, recoup, helocRate, helocYears, refiRate, refiYears, refiCosts, loanRate, loanYears }` (all optional; defaults in `DEFAULTS`).
- The largest property account (the home), the largest mortgage with its rate and payment (`balance/liabilities`).
- Usable cash and the emergency target (`balance/liquidity`); the federal estimate (itemizing, top rate); the plan's
  blended return (`insurance/term-vs-permanent` `planReturn`).

## Outputs
`{ inputs, project, cost, recoup, valueAdded, equityChange, home: { name, value, mortgage, equity, borrowable } | null, mortgage, itemizes, marginal, discount, ways: [{ id, label, monthly, interest, fees, deductible, taxSaved, today, cost, note, risk, fits }], cushion, best }`.

## Formulas
- Value added = cost × the share it adds back: national averages from the 2024 Cost vs. Value report (Zonda,
  Remodeling magazine), rounded to 5% (`PROJECTS`), or your own.
- A loan: level payment `pmt(rate/12, years×12, amount)`; month by month, interest = balance × rate / 12.
- **In today's money** (how the ways are ranked): every payment discounted at the plan's blended return,
  Σ payment / (1 + r/12)^m, minus the cash received. Cash = 0.
- Home-equity line: the cost over `helocYears` at `helocRate` (default 8%, 10 years); borrowable = value × 85% − mortgage
  (lenders' usual combined limit).
- Cash-out refinance: a new loan of mortgage + cost + closing costs (default 3%) at `refiRate` over `refiYears`, against
  keeping the old mortgage on its own payment: the payment change, the extra interest, and in today's money
  PV(new payments) − PV(old payments) − cost.
- Personal loan: `loanRate` (default 12%) over `loanYears` (5).
- Tax: interest on home loans used to "buy, build or substantially improve" the home is deductible when itemizing
  (IRC §163(h)(3)); saved = interest × top rate, only if the federal estimate itemizes.
- Cushion: usable cash − cost, in months of essential spending.

## Edge cases
- No home: no line or refinance offered. No mortgage with a payment: no refinance. Not enough equity or cash: shown, not ranked.
- The averages are national; a local agent's view replaces them.

## Tests
`module.test.mjs`: the schedule and its present value, a level loan, value added (average and own), the family's four ways
and the ranking, the refinance by hand, cash with no home.

## Ideas / not yet
- Energy projects: tax credits (the residential clean energy credit) and the bills they save.
