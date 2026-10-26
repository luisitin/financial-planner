# Independent retirement answer keys

The lead read the ten compute files, their READMEs and their imports before assigning these briefs.
The oracle scripts under `tools/golden_retirement/` may read primary published data, but must
never execute, import, translate or copy application implementations to calculate expectations.
Production code is executed only by the replay runner, after the CSV has been written.

## Fixed layout contract (each page fixes its union of columns in its CSV header)

`case_id,rule,kind,target`, flattened input columns (`plan.*`, `params.*`, `input.*`,
`options.*`, `arg.*`), flattened `expected.*` columns, `todo,note`.
The actual header is authoritative and must be copied into the page brief after generation.
Array indexes are dot-separated integers. Blank means omitted, `@null` means null,
`@empty-array` means an empty list. No JSON payloads hide the inputs.
Money has two decimal places; rates and probabilities six. Dates are ISO calendar dates.
Targets: `compute` calls this page, `project`/`affordableSpending` call the shared engine,
`rmdAmount`/`rmdFactor`/`rmdStartAge`, `survival`/`ageAtSurvival`/`lifeExpectancy`,
`perYear`, `realRate`, `pmt`, and tax helpers call the named pure function.

Each separately listed rule gets at least 100 rows (60 grid, 30 edge, 10 extreme).
Use the complete invented plan where useful; primitive tests supplement rather than replace
the page tests. Include families, positive/negative/zero values where meaningful, 2026 and
2056, calendar boundaries, empty inputs, and the published thresholds.
Every tenth row must carry an explicit independent second derivation and pass it. Do not
call a repeated evaluation of the same formula a second method. The lead audits at least 2%.
Keep a genuine code disagreement in the CSV with a specific `todo` reason; no dynamic
"whatever fails is TODO" logic. Unmarked disagreements fail the test suite.

## Scope and sources

The app's documented approximations are the expected model unless a cited primary source
supplies a missing rule. Do not silently replace the documented flat-tax or mortality model
with a different planning model. Do test statutory contradictions and name them explicitly.
No SSA benefit calculation, Monte Carlo sampler or full historical-backtest dataset is in
scope; typed benefits and fixed invented sequences exercise integration. Historical selection
and ordering on the two in-scope pages do require independently sourced history or algebraic
cases whose outcomes are independent of the history.

Primary sources: IRS Publication 590-B https://www.irs.gov/publications/p590b ; IRS Notice
2025-67 https://www.irs.gov/pub/irs-drop/n-25-67.pdf ; Notice 2024-80
https://www.irs.gov/pub/irs-drop/n-24-80.pdf ; HSA Rev. Proc. 2025-19
https://www.irs.gov/pub/irs-drop/rp-25-19.pdf ; Rev. Proc. 2025-32
https://www.irs.gov/pub/irs-drop/rp-25-32.pdf ; Rev. Proc. 2024-40
https://www.irs.gov/pub/irs-drop/rp-24-40.pdf ; IRS Publication 915
https://www.irs.gov/publications/p915 ; SSA period tables
https://www.ssa.gov/oact/STATS/table4c6.html ; Damodaran historical returns
https://pages.stern.nyu.edu/~adamodar/New_Home_Page/datafile/histretSP.html .

Future-year indexing, fixed return assumptions, contribution periods, end-of-year timing,
Gompertz fit parameters, and the 80-year FI search cap are application modeling assumptions,
not predictions, tax advice, or numbers published by those agencies. Show their arithmetic.
