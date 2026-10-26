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
