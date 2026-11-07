# Answer-key quality and interpretation

These fixtures check the documented retirement models against independent
arithmetic. They are not outputs captured from the application. The generators
under `tools/golden_retirement/` use the formulas and sources identified in each
page's brief; `common.py` only formats and writes CSV. Production computation is
reserved for the replay runner, after expected values have been written.

The separation matters: changing the implementation must not silently change an
expected answer. A sourced disagreement stays in the CSV, with a specific `todo`
reason. The runner must not turn an arbitrary failing assertion into a TODO or
replace its expected value with the observed output. An unmarked disagreement
requires investigation.

## Evidence to inspect

- `briefs/<page>.md`: rule inventory, README quotations, source references,
  rounding, assumptions and the page's exact flattened header.
- `<page>.csv`: invented inputs, independently calculated expected results,
  worked notes and explicit known disagreements.
- Notes identifying a second calculation, plus the separate second-check JSON
  files where used: independent arithmetic for every tenth row.
- `lead-audit.json`: the lead's sample audit; this is separate from application
  replay and should be regenerated after any answer-key change it covers.
- `tests/golden-retirement.test.mjs`: CSV replay through `parseCsv`, production
  calls, comparisons and explicitly identified TODOs.

The per-rule target is 60 grid, 30 edge and 10 extreme rows. Row count alone does
not establish coverage: thresholds must appear at equality and on either side,
and independent inputs must vary the quantities relevant to the rule. The
contributions and FIRE generators additionally reject duplicate input cases
within a rule, ignoring expected results, case IDs and notes. Their defaults,
calendar and empty-input tests vary legitimate household/amount/date context.

Money is stored to cents and compared within 0.005. Rates and probabilities use
six decimal places; counts, years, booleans, nulls and labels retain their own
meaning. Intermediate calculations are not rounded to cents unless the brief
explicitly calls for that rounding. A displayed zero must not substitute for a
missing result, and an empty list must remain distinguishable from an omitted
input.

## Limits of the conclusions

IRS publications supply statutory figures and rules; invented worked examples
supply arithmetic test cases. Defaults, frozen future-year limits, return blends,
annual timing, flat tax approximations, mortality fits and finite search caps are
application assumptions. They must not be described as IRS/SSA forecasts or as
comprehensive personal tax calculations.

The contributions tests assume the documented scope: full-year self-only HSA
eligibility and sufficient qualifying compensation where relevant. Family HSA
selection is an explicitly deferred feature. Employer HSA payments sharing the
contribution cap are a statutory issue, however, and remain a sourced disagreement
rather than being excused by that feature limitation.

The ordinary flat-tax model and the optional bracket model have separate rules.
Bracket tests cover the implemented filing-status tables, deductions, gains,
Social Security taxation and conversions described in their briefs; they do not
claim coverage of every deduction, credit, state tax or federal tax exception.
Future tax parameters follow the stated indexing convention and published table
vintage, not an assertion about future legislation.

Typed Social Security amounts test integration; the excluded Social Security
benefit calculator, Monte Carlo validation and full historical replay projects
remain outside this task. Historical selection/order cases and mortality cases
must be read with their identified data source and the application's documented
approximations. A green replay establishes agreement with these answer keys; it
does not establish that every planning assumption predicts real life.

Final acceptance includes regenerated fixtures, a refreshed independent lead
sample, the replay runner, `npm test` and `npm run check`. The lead re-derived 256
rows across all 128 rules, including extreme cases. One final review correction
is recorded explicitly: the cash-flow gross-up fixtures initially subtracted
from an unrounded starting balance instead of the cent amount written into the
plan. Regenerating from the actual cent input removed six spurious TODO labels.
The entire1,000-row cash-flow page was replayed, and all rows passed. Expected
values were repaired from the input arithmetic, never copied from app output.

## Batch 5b (2026-11-06): a changed rule, with the owner's answer
The withdrawal-strategy and projection keys were regenerated because the rule changed, not to match the app: the owner's answer,
2026-11-06, "You can do as you please. Just make sure a layman can easily understand and use the page", said yes to reading the share, years-left and guardrail rates as the withdrawal, with guaranteed income
spent on top. The oracles were changed from that rule first (`tools/golden_retirement/README.md`); the engine then had to meet
them, and the moved rows are listed with the batch, each with its reason. The fixed-real rows and every other page's key did not
move.

### Batch 5b review (2026-11-06): three more rule changes, the same owner's answer
The money review of Batch 5b found three places where the rule as first written did not keep the page's promise, and the owner's
words ("You can do as you please. Just make sure a layman can easily understand and use the page", 2026-11-06) cover the fix:
- D1: the tax a pension cannot pay comes out of savings on top of the share (it was taken out of the share, so 453 qa plans
  planned $0 to live on in their first retired year). 8 `income-first` rows moved (taxed bucket, pension below the tax).
- D4: after a losing year guardrails do not rise with prices but still fall with them, and are never above the plan in
  today's dollars. 17 `page-spending-summaries` rows' guardrails worst-stretch fields moved (1930s deflation windows).
- UX 14: the years-left payment uses the plan's expected return in a replayed history window too. 73 `page-spending-summaries`
  rows' years-left worst-stretch fields moved (17 of them also the guardrails fields above).
- Verify R1 (2026-11-07, same answer): the losing-year hold on guardrails' target applies only while the target needs a
  withdrawal; while income pays for all of it the target follows prices (frozen with nothing drawn, it sank below the plan unseen
  and was never raised back: the widow, 1960 window, $32,946 a year on a $36,000 plan with $470,928 left). `withdrawal_strategy.py`
  and `lead_audit.py` changed from the rule; regenerated with the same commands: no row moved (no key row has guardrails with
  income and a losing year; `tests/retirement-ways.test.mjs` "verify R1" covers it).
- Follow-up R3 (2026-11-07, same answer; the owner's standing words "make sure a layman can easily understand and use the page"):
  once Social Security or a pension covers a trimmed guardrails target, the target is raised back by the way's own raise rule
  (strictly below 0.8 times the rate, +10%) also when the draw is $0, never above the plan in today's dollars. Before, the raise
  needed a draw above $0, so a target trimmed while savings paid (the couple retiring at 62, health cover before 65) stayed
  down for good once Social Security covered it: $38,000 to $43,500 a year on a $60,000 plan for 29 years, ending with $1.27
  million. `withdrawal_strategy.py` (both branches) and `lead_audit.py` were changed from the rule; regenerated with the same
  commands (`withdrawal_strategy.py`, `projection.py`, `lead_audit.py`, `roth_conversions.py`): ONE row moved, and no
  projection, lead-audit or other page's row.
  - `withdrawal-strategy-income-first-063` (edge, guardrails, a pension of $39,999.99 against a $40,000 plan, prices falling 2%
    a year): the pension pays for the whole trimmed target, so its draw is $0; the target is now raised back to the plan
    ($40,000.00) instead of staying at the pension, and the cents of the second-year spending and the worst-stretch
    fields moved (0.95 to 0.94, 39,203.99 to 39,204.00, 39,999.99 to 40,000.00, 0.00 to 0.01). Nothing else in the key has income
    that pays for a whole trimmed target. `tests/retirement-ways.test.mjs` covers the couple retiring at 62.
  - Money review M1 (same day): the raise at a $0 draw waits until savings could pay what the raised target needs without a
    trim (`needs(up) <= 0` or `needs(up) / savings <= 1.2 x the rate`), else the target follows prices. Without it a retiree with
    tiny or empty savings was raised on money that was not there, came up short, was trimmed, and was raised again (373 short
    years that start from empty savings on 18 sampled plans, runs out up to 10 years earlier on 3 of 230). `withdrawal_strategy.py`
    (income-first) and `lead_audit.py` changed from that rule and were regenerated with the same commands plus `package.py`: the key
    rows are identical to the ones above (no further row moved, `income-first-063` included); only `coverage.json` changed, for the
    new hash of `withdrawal-strategy.csv`.
- Follow-up R4 (2026-11-07): the room under a rate in Roth conversions is worked on ORDINARY taxable income, with qualified
  dividends and gains stacked on top (IRS Pub. 550; the Qualified Dividends and Capital Gain Tax Worksheet). `roth_conversions.py`
  asks the oracle's `ordinaryTaxable` instead of `taxableIncome`; its rows carry no qualified income, so no row moved.
The oracles were changed from the rule first, then the key regenerated; every moved row is listed with the batch. The projection
key, the lead audit and every other page's key did not move.
