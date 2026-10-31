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
  Σ payment / (1 + r/12)^m, minus the cash received, less the tax the interest saves discounted the same way
  (top rate × deductible share × Σ interest / (1 + r/12)^m, only when itemizing). Cash = 0. The best is the cheapest that
  fits, a later way winning only when cheaper by more than $1.
- Home-equity line: the cost over `helocYears` at `helocRate` (default 8%, 10 years); borrowable = value × 85% − mortgage
  (lenders' usual combined limit).
- Cash-out refinance: a new loan of mortgage + cost + closing costs (default 3% of mortgage + cost) at `refiRate` over
  `refiYears`, against keeping the old mortgage on its own payment: the payment change, the extra interest (negative when
  the new loan costs less interest), and in today's money PV(new payments) − PV(old payments) − cost less the tax change.
  It fits only when the new loan is at most 80% of the home's value (`refiLtv`; HUD Mortgagee Letter 2019-11, FHA cash-out
  refinances: "The maximum LTV is 80 percent of the Adjusted Value", read 2026-10-31; other lenders' limits were not
  checked, and a VA loan can go higher). Until 2026-10-31 it used the line's 85% test without its own costs.
- Personal loan: `loanRate` (default 12%) over `loanYears` (5).
- Tax: interest on home loans used to "buy, build or substantially improve" the home is deductible when itemizing
  (IRC §163(h)(3)(B)), on home debt up to $750,000 ($375,000 filing separately: §163(h)(3)(F)(i)(II); IRS Pub. 936 (2025):
  "For debt secured after December 15, 2017, the limit is $750,000 ($375,000 if married filing separately)"). The share of
  the interest that counts (`deductibleShare`) = 1 up to the limit, else limit ÷ home debt, by the balances at the start
  (Pub. 936's worksheet uses each year's average balances; an older mortgage under the $1 million limit is not told apart).
  Line: saved = interest × the share of (mortgage + cost) × top rate. Refinance: the closing costs rolled in were not used
  to buy, build or improve, so their interest never counts (Pub. 936: "Any additional debt not used to buy, build, or
  substantially improve a qualified home isn't home acquisition debt"): saved = (the new loan's interest × min(mortgage +
  cost, limit) ÷ new loan − the old mortgage's interest × its share) × top rate, negative when the refinance gives up
  deduction. Only if the federal estimate itemizes. Until 2026-10-31 there was no limit, the closing costs' interest
  counted and a lost deduction showed as 0.
- Cushion: usable cash − cost, in months of essential spending.

## Edge cases
- No home: no line or refinance offered. No mortgage with a payment: no refinance. Not enough equity or cash: shown, not ranked.
- The averages are national; a local agent's view replaces them.

## Tests
`module.test.mjs`: the schedule and its present value, a level loan, value added (average and own), the family's four ways
and the ranking, the refinance by hand, cash with no home.

## Ideas / not yet
- Energy projects: tax credits (the residential clean energy credit) and the bills they save.
