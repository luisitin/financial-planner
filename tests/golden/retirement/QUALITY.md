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
sample, the replay runner, `npm test` and `npm run check`. The lead re-derived254
rows across all127 rules, including extreme cases. One final review correction
is recorded explicitly: the cash-flow gross-up fixtures initially subtracted
from an unrounded starting balance instead of the cent amount written into the
plan. Regenerating from the actual cent input removed six spurious TODO labels.
The entire1,000-row cash-flow page was replayed, and all rows passed. Expected
values were repaired from the input arithmetic, never copied from app output.
