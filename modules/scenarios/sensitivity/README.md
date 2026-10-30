# Sensitivity  (`scenarios/sensitivity`)

**Status:** usable (phase 9)
**Purpose:** Which of your numbers matter most: returns, inflation, when you retire, how much you save, Social Security, each nudged down and up, ranked by how much it moves what you can spend.

## Inputs
Everything `retirement/projection` `buildInputs` reads. Params: `today`. Writes nothing. `heavy: true` (22 spending searches, about 900 projections).

## Outputs
`{ ready, missing, base: { affordableMonthly, spendingMonthly, endReal, success }, rows[], biggest }`; each row `{ id, label, help, baseLabel, low, high, swing, worse }` with `low`/`high` = `{ label, affordableMonthly, endReal, success }`, sorted by `swing` (the monthly spending between the two ends), largest first.

## The nudges (`NUDGE`), one at a time, everything else as the plan has it
| input | low / high |
|---|---|
| Stock return, bond return, inflation, pay rises | 1 percentage point down / up |
| The first person's retirement age (when not yet retired) | 2 years earlier (never before next year) / later; the plan rebuilt, so saving stops and spending starts then |
| How long the plan runs | every adult's plan-end age 5 years shorter / longer |
| Saving into retirement accounts | 25% less / more |
| When Social Security starts | everyone claiming at 62 / at 70 (when the plan has Social Security figures) |
| Social Security paid in full | `SS_PAYABLE_IF_DEPLETED` = 77% of benefits / in full. 2025 Social Security Trustees Report: the retirement (OASI) trust fund runs dry in 2033, after which about 77% of scheduled benefits are payable from incoming taxes. |
| Stocks in retirement | 20 points less / more (kept between 0% and 100%) |
| Flat tax on withdrawals (flat-tax mode only) | 5 points less / more |

The measure is the largest steady, inflation-adjusted spending that lasts to the end (`affordableSpending`, as on Will the money last?), a month; the second measure (chips) is what is left at the end, today's dollars.

## Edge cases
Not ready without the plan basics. No retirement-age row once retired; no saving or pay-rise rows without contributions or once retired; no Social Security rows without figures; no flat-tax row in brackets mode.

## Tests
`module.test.mjs`: the eleven rows for the family and their order, one end checked against a hand-made change (stock return, Social Security cut), the direction each input pushes, the rows that drop out.

## Ideas / not yet
- Nudges sized by each input's real uncertainty (a standard deviation) instead of round steps; two inputs at once (a heat map); the Monte Carlo chance as a third measure.
