# Disagreements retained in the answer key

12,700 source-based cases cover127 separately named rules. Every rule has60 grid,
30 edge and10 extreme cases;1,270 rows have a second derivation. The lead independently
re-derived254 rows (2%) with a third script that imports neither workers nor application code.
There are468 explicitly marked TODO cases. The other12,232 golden cases pass normally.

These are differences from either a cited primary rule or the documented mathematical model,
not a request to silently replace the app's simplified planning assumptions. Production
calculations are unchanged. Case IDs below locate the exact flattened inputs and expectations.

| Difference | Independently worked expectation | Current result / example |
|---|---|---|
| HSA employer deposits omitted from annual usage | In2026, employee4,400 + employer10 =4,410 used; limit4,400; excess10. Employer HSA deposits share the limit. | Used4,400 and excess0. `contributions-hsa-employer-cap-001`. [IRS Pub969](https://www.irs.gov/publications/p969). |
| Affordable-spending search has an insufficient upper bound | One year,20,000 in taxable, no tax/return/income: spendable20,000. |10,004 from the initial ceiling; it is never expanded. `projection-affordable-001`. Projection README's largest-feasible-spending definition. |
| Affordable-spending search stops too soon at large balances | Two years,1,000,000,000, no tax/return:1,000,000,000 /2 =500,000,000 per year. |499,999,998. Thirty bisection steps leave a2-dollar error. `projection-affordable-092`. |
| VPW payment timing | With100,000 and one remaining year at3%, a payment at the start of the year is100,000; its discounted-payment coefficient is1. |103,000, the end-of-year annuity payment, is taken before returns. `withdrawal-strategy-vpw-beginning-timing-092`. [Bogleheads VPW](https://www.bogleheads.org/wiki/Variable_percentage_withdrawal). |
| Older required-withdrawal cohorts | A pre-July1949 birth begins at70.5, not72; a January1948 birth reaches70.5 in2018. |Start age72. `rmd-cohort-061` and calendar cases. [IRS Pub590-B](https://www.irs.gov/publications/p590b). |
| Required withdrawals lose account ownership | Owner A:1,000 /26.5 =37.735849 →37.74. Owner B:500,000 /26.5 =18,867.924528 →18,867.92. |Household501,000 /26.5 =18,905.66 reported for each adult. `rmd-ownership-001`. [IRS Pub590-B](https://www.irs.gov/publications/p590b). |
| Life-insurance cash value treated as an IRA | An ordinary life policy is not an IRA;1,000 of cash value has no IRA required withdrawal. |Classified as pre-tax with an IRA distribution (37.74 at73). `rmd-exclusions-009`. [IRS retirement-plan investment FAQ](https://www.irs.gov/retirement-plans/retirement-plan-investments-faqs), IRC408(a)(3). |
| Published deduction rounded in its source year |2025 head-of-household standard deduction is23,625 exactly. |23,650, a25-dollar increase. `withdrawal-order-indexing-004`. [IRS individual deductions](https://www.irs.gov/newsroom/working-families-tax-cuts-individuals-and-workers). |
| Married-separate senior eligibility | At125,000 income,2025 married-separate age65: standard15,750 + age allowance1,600 =17,350; senior deduction0. |Deduction20,350 includes an ineligible3,000. `withdrawal-order-senior-003`. [Schedule1-A](https://www.irs.gov/instructions/i1040gi). |
| Couple's senior phaseout applied only once | At200,000 joint income, each senior gets6,000 −0.06×50,000 =3,000. Two seniors:6,000; total deduction34,700 +6,000 =40,700. |Senior deduction9,000; total43,700. `withdrawal-order-senior-027`. [Schedule1-A](https://www.irs.gov/instructions/i1040gi), IRC151(d)(5)(C). |
| Conversion room rounded to whole dollars | Single age65, income28,499.99:12,400 bracket top +18,150 standard/age +6,000 senior −28,499.99 =8,050.01. |8,050. `roth-conversions-room-061`. |
| Ineligible senior deduction also inflates conversion room | Married-separate age65:12,400 +17,750 −28,499.99 =1,650.01. |7,650. `roth-conversions-room-073`. |
| Conversion target stops within one dollar | Single age68,2026, fill22%: x −18,150 −[6,000 −0.06(x−75,000)] =105,700. Thus1.06x =134,350; x =126,745.283019 →126,745.28. |126,745. `roth-conversions-eligibility-009`. |
| Positive conversions under one dollar skipped | With0.01 pre-tax, enough cash, zero tax due and available bracket room: convert0.01. |0.00. `roth-conversions-eligibility-091`. No modeled or IRS one-dollar minimum. |
| Survival inverse stops at120 before crossing | Age119, unspecified sex/better health: S(120)=0.120945608 >0.1, S(121)=0.011713734 <0.1. First integer crossing121. |120. The README Gompertz model, not an exact SSA prediction. |
| Remaining-life sum drops the tail after120 | At120, male/average, the same midpoint survival sum extended until negligible is0.231338624 remaining years. |0 years because the sum starts and stops at120. |
| Couple search stops after70 years | Couple18 male/better and13 female/average: joint survival after70 years0.702748869; at83 years0.118518369; at84 years0.090145242. Primary plan-to age102, calendar2110 from2026. |Primary age88/year2096. Same README Gompertz model; independently sourced fit assumptions remain labeled approximations. |

The final CSVs and `coverage.json` are authoritative for exact counts and all case IDs.
The report does not hide the limitations of documented approximations: flat taxes, simplified
guardrails, numerical mortality fit and hypothetical future indexing remain intentional models.

Verification: `npm test` and `npm run check` pass on Node24.21.0; the same commands also pass
on Node20.20.2 after replacing Windows-incompatible shell-glob discovery with
`tools/run-tests.mjs`. On the updated main branch the full suite has15,436 tests and
zero unmarked failures. Its2,714 TODOs comprise468 retirement cases from this work
and2,246 existing federal-tax cases. TODOs remain until their production behavior is addressed.

Additional checks: syntax and Git whitespace checks pass. The leak scan found no content
issues after scoped exemptions for invented large balances and public source IDs.
Publication uses the repository owner's public GitHub noreply commit identity.
