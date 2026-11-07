# Independent retirement oracles

These Python scripts implement the written worker briefs under
`tests/golden/retirement/briefs/`. They never import or execute the application.
The JavaScript replay runner is the only producer of actual implementation results.
Expected values are never recorded from that runner.

Regenerate with Python 3.12 (standard library unless downloading a fresh NYU workbook):

```powershell
python tools/golden_retirement/projection.py
python tools/golden_retirement/contributions.py
python tools/golden_retirement/cash_flow.py
python tools/golden_retirement/withdrawal_strategy.py
python tools/golden_retirement/withdrawal_order.py
python tools/golden_retirement/roth_conversions.py
python tools/golden_retirement/rmd.py
python tools/golden_retirement/sequence_risk.py
python tools/golden_retirement/longevity.py
python tools/golden_retirement/fire.py
python tools/golden_retirement/lead_audit.py
python tools/golden_retirement/package.py
npm test
npm run check
```

`common.py` supplies CSV serialization only. `tax_oracle.py` supplies independent
primary-source tax arithmetic. `history_source.py` uses the frozen, separately
downloaded NYU source snapshot; its header documents URL and SHA-256 provenance.
Only refreshing that source requires `xlrd`; ordinary regeneration does not.

Each rule has 60 grid, 30 edge and 10 extreme cases. Every tenth row is checked
again using another derivation before writing it. `lead_audit.py` is a separately
written third implementation: it reads the CSVs, imports no workers or production
code, and re-derives two cases from every rule (including extreme samples).

The scripts intentionally preserve source/model disagreements with explicit TODO
reasons. New unexpected disagreements fail replay; the runner does not convert
failures into TODOs. Removing a TODO requires resolving the implementation or
reviewing the source-based expectation, not accepting whatever output appears.

The large delivery bundle at the workspace root contains the ten complete CSVs
and the runner, each in a fenced block with its save path. It is an export, not
another copy used by the tests.

## Batch 5b (2026-11-06): the owner's answer and the regenerated keys
The owner's answer to the batch 5 question (read the share, years-left and guardrail rates as the withdrawal, spend guaranteed
income on top, and regenerate the frozen keys), word for word, 2026-11-06: "You can do as you please. Just make sure a layman can easily understand and use the page". So `withdrawal_strategy.py` follows that
rule, written from it and not from the app (guardrails tested on the withdrawal, its raise never above the plan's spending
grown with prices; a new `income-first` group of 100 rows with pensions above, near and below the plan), `projection.py`'s
guardrails raise is capped the same way, and `lead_audit.py` re-derives the new rule independently. Regenerated with Python
3.13 (byte-identical output to 3.12 for the unchanged pages): `withdrawal_strategy.py`, `projection.py`, `lead_audit.py`,
`package.py`. Every moved row and why is listed with the batch (90 withdrawal-strategy rows: 66 guardrails, 24 page summaries'
guardrails fields; 20 projection guardrails rows; 100 rows added).

Batch 5b review (2026-11-06), under the same answer: the share ways pay tax a pension cannot pay from savings on top of the share
(D1), guardrails follow falling prices after a losing year and never pass the plan in today's dollars (D4), and the years-left
payment uses the expected return in a replayed history window (UX 14). `withdrawal_strategy.py` and `lead_audit.py` were changed
from those rules (`projection.py` only in a comment and its second check: its rows have no falling prices), then regenerated with
the same commands: 81 withdrawal-strategy rows moved (8 income-first, 73 page summaries), nothing else.

Batch 5b verify (2026-11-07), under the same answer: guardrails' losing-year hold applies only while the target needs a
withdrawal (R1: with income paying for all of it, the target follows prices). `withdrawal_strategy.py` and `lead_audit.py` were
changed from that rule and every script regenerated with the commands above: no CSV row and no `lead-audit.json` entry moved.
