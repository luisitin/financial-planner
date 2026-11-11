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
| Stock return, bond return, inflation, pay raises | 1 percentage point down / up |
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

## Review fix 2026-11-02 (who can still claim)
"When Social Security starts" moves only who has not claimed and is under 70 (the Social Security page's `claimed`, as Goal seek does), from now (to the month, never before 62) to 70; the row says when the others already get it, and is left out when nobody can still choose.

## Review 2026-11-02 (round 5)
- "Social Security paid in full" (the 77% trust-fund row) has its own condition again: any Social Security in the
  projection, paid already or still to come. The previous fix had put it behind "someone can still choose a claiming
  age", so a retired couple who both get it lost it and was told "How long the plan runs" mattered most, while the
  method note still described the 77% row.
- People left out of "When Social Security starts" are named by reason: "Lee only: Sam already gets it" or "Lee only: Sam
  is 70 or over, when waiting adds nothing" (before, "the others already get it" also covered someone 76 who never claimed).
- When the trust-fund row is the biggest, the headline leaves out its "in full" end, which is the plan as it stands
  ("77% instead of in full cuts it by $1,040 a month", not "...; in full raises it by $0").
- The low end reads "now (64 and 6 months)" only when that age is within a month of everyone moved (`nowForAll`, as on
  Goal seek); a couple of 64 and 60 reads "at 64 and 6 months", since it is 19 months away for the younger one.

## Review 2026-11-02, round 5 (second pass)
The method note ("How it is worked out") said "whoever has not claimed yet and is under 70 claiming as soon as they
can (62, or their age today) or at 70", but everyone moved claims at the same age, the oldest one's age today: a
couple of 64 and 60 both move to 64 and 6 months, not 62 for the younger one. The sentence is now built in compute
(`ssMethodNote`, returned as `ssMethod`) from the rows as they were made: "Social Security: Sam and Lee claiming at the
same age, the older one's age today (62 at the earliest), or both at 70; and the 77% that would be payable...", "Sam
claiming at today's age (62 at the earliest) or at 70" for one person, and only the trust-fund part when nobody can
still choose.

## Ideas / not yet
- Nudges sized by each input's real uncertainty (a standard deviation) instead of round steps; two inputs at once (a heat map); the Monte Carlo chance as a third measure.

## Review 2026-11-06 (round 7): you and your
- Review 2026-11-06 (round 7): the retirement row's label, the claiming row's note and `ssMethodNote` say you/your for the unnamed first adult and "your spouse" for Get started's partner ("When you retire", "your spouse only: you already get it", "Social Security: you and your spouse claiming ..."), via `core/words.js`; typed names read as before. Test: "review 2026-11-06 (round 7)".
Final check (2026-11-07): the list of what the plan still needs uses the words every page uses (`core/words.js` `needItem`: "a birth date on the People page", "what you will spend in retirement (on the Expenses page, or on the Will the money last? page)"). Test in `tests/wording-verify.test.mjs`.
The sentence above the bars says the month planned to the dollar ("against the $7,000 it plans"); what the plan can pay for stays at $10.

## Loans in the spending figure (2026-11-11, loans lane fix round 1, money review D11)
The runs on this page spend a loan the figure holds only until its payoff, as Will the money last? does (they use the same
engine inputs). The one figure this page prints as "spending" is the figure itself, loans included; it is not lowered for the
years after a payoff. Left as it is: What matters most compares runs, and each run has the payoff in it.
