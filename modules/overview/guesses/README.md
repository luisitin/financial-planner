# overview/guesses: Our guesses for you

**Status:** usable (C1 of the smart-guesses build plan: plumbing, data, this page; nothing else a person sees moves).

## Purpose
A layperson should get through the app without knowing every number. Where a box is left empty, the plan fills in a
figure that is real-world data worked out from what the plan already knows; with nothing known, the most likely
figure for the population. This page lists every such figure still in use, the ones that change your answers most
first, each with one plain "Our guess:" line, a box to type the real figure and "That's about right" to keep ours.

## The one rule (what the person sees)
- A grey figure in an empty box is exactly what the plan counts if the box stays empty. An empty box with no grey
  figure counts as nothing. What the person types always wins and is never moved.
- One why-line per guess, at most 70 characters after "Our guess: ", naming the answers it used; no publisher, year or
  statistics words on screen. Publisher, table, year and read date sit in one fold here ("Where our guesses come from").
- A guess never turns anything green, amber or red by itself.

## How it is stored (core/estimate; docs/CONVENTIONS.md "Guesses"; docs/DATA_MODEL.md `guesses`)
A guess is an ordinary value in its field plus one ledger entry `plan.guesses[path] = { k, v, u, s, at, d }`. The
field counts as a guess only while it still equals `v` (`same()`, per unit: rates within 1e-9, money within $0.005).
- **S1** only a page that saves a box the person saw with its grey figure creates one (`markGuess`, `saveField`).
- **S2** any typed value, equal or not, ends it (`saveField` clears it).
- **S3** `settle` (inside `store.update`, after the page's change) refreshes untouched entries in tier order; it never
  creates one, never writes a field whose value differs from `v`, and is idempotent.
- **S4** a removed record drops its entry; the last entry gone deletes `plan.guesses`.
- **S5** the older Get started flags are read as frozen guesses (`LEGACY`): `debts[].rateGuessed` / `paymentGuessed`,
  `guide.setup.ssWrote`, `retireAuto`, `cushionTarget` / `cushionFunds`. Settle never re-estimates them; they stay
  until the person types over them, keeps them, or (C2) takes the "Better guesses" card. "That's about right" or a
  typed figure here drops the flag, so the setup and Liabilities treat the figure as the person's own (for the
  cushion, `cushionTarget` becomes `null`, which overview/setup now reads as "the person's own").
- **S6** an entry whose estimator no module has any more stays frozen and leads this page ("Type the real figure").
  An entry that is not `{ k, v, ... }` at all (an import or a hand edit) is dropped by the next settle (`"bad"`) and
  skipped by every reader, so one bad entry never stops the rest.
- **S7** a fresh estimate whose tables are older than the entry's `d` is never written back.
- **S8/S9** scenario copies and the PC server never settle; the server computes on the plan the device sends.
- The gate: `estimate()` returns nothing for a plan whose currency is not USD, that holds a bank file in another
  currency (`imports[].currency`: transactions/import keeps a file's Currency column on its record), or whose person
  said they live outside the U.S. (`guide.setup.outsideUS`). A blank state with USD uses the national figure and adds "your state" to
  "Sharper if you tell us".

## The page (view.js)
Hero; one notice from the last save (kept in a module-level `pending`); "Matters most" (big guesses; when one is
frozen, or an older payment is stale (below), it leads and the card is titled "Type these first"); "Matters less" folded (small ones); "These look fine" (sets
`guide.guessesLookedAt`); the market-assumptions fold (a link to System > Assumptions: those are planning choices, not
guesses about you); "Where our guesses come from" last: the tables behind the guesses above, then every other table on
hand, each with our name for it, the publisher (`shownBy`), the publisher's table (`tableShown`), a plain "as of" line
(`asOf`), the read date and "The table ›" as an outlined 44 px button (`.btn.secondary.small`); its status says
"63 tables from 17 publishers" (`org` counted). A plan that takes no U.S. figures (the gate) gets no list there:
"We fill in typical figures only for households in the U.S. that count in dollars, so none of these tables is used for
your plan." Rates are shown and saved to a thousandth of a percent (6.125%), as Get started keeps them. Saving a debt's
rate while its older payment still stands adds "Your payment of $1,261 a month was worked out at the old rate, so type
your real one too." Records, never a table (390 px). Saving: Save (or Enter) commits through `saveField` as a typed figure;
"That's about right" through `confirmGuess`. A save is not made on blur: the re-render after a blur-save would move the
button under the finger before a tap on "That's about right" lands. Empty state: an empty plan points to Get started; a
plan with every figure typed says so, says a figure filled in later will show here, and offers the Dashboard. Rows of
the older guesses keep the setup's order (each debt's payment, then its rate; people in household order).
Ranking in C1 is by static weight (estimator `weight`, or the legacy weights below); the measured ranking (spec 11.2,
`compute(plan, { ranges: true })`, the "If it's off ..." line) arrives in C8.

## compute(plan, { estimators, tables, today })
`{ rows, top, count, frozen, stale, big, small, applies, sources: { used, all, orgs }, offers: { fill: [], upgrade: [] },
lookedAt, planEmpty }`. `rows`: `guessesInUse(plan)` (ledger + legacy) as `{ path, k, label, record, value, unit, kind,
why, weight, legacy, frozen, stale, href, sources, basis, order }`, sorted frozen first, then stale, then big, then
small, then by tier and order. `applies`: core/estimate `applies(plan)`; when false no row cites a table. The view
passes the registry merged from every manifest; without it the module's own is used. `offers` stays empty until C2
(upgrade) and C7 (fill).

### Older guesses: words and weights (`LEGACY_WORDS`, `LEGACY_SETUP`)
| key | label | why (after "Our guess:") | source cited | weight |
|---|---|---|---|---|
| `debt.mortgage.rate` (legacy 7.24%) | "<account>: interest rate" | the average rate on a new 30-year mortgage | `mortgage_rate_pmms_weekly_2026` | big |
| `debt.credit.rate` (22.36%) | same | the average rate on cards that charge interest | `cc_apr_fed_g19` | big |
| `debt.car-loan.rate` (7.17%) | same | the average bank rate on a six-year new-car loan | `auto_personal_rate_fed_g19` | big |
| `debt.loan.rate` (11.9%) | same | the average bank rate on a two-year personal loan | `auto_personal_rate_fed_g19` | small |
| `debt.student.rate` (6.52%) | same | the federal rate on new undergraduate student loans | `student_loan_rates_federal` | small |
| `debt.<kind>.payment` | "<account>: payment a month" | what pays off what you owe over 30 / 5 / 10 / 3 years at our rate guess (the rate is still a guess) or at your rate (it is the person's); cards: the month's interest plus 1% of what you owe, a usual minimum | the rate's sources while the rate is still a guess (+ `card_minimum_payment_rule_cfpb` for cards) | big |
| `overview/setup:ss` | "<name>'s Social Security at full retirement age" | worked out from the pay on file with Social Security's formula | (your own answers) | big |
| `overview/setup:retireSpend` | Spending a month once work stops | today's bills without childcare, plus loans still running then | (your own answers) | big |
| `overview/setup:cushionTarget` | Safety cushion to aim for | N months of your must-pay bills | (your own answers) | small |
| `overview/setup:cushionFunds` | Accounts that hold the cushion | your checking, savings and cash accounts | (your own answers) | small |

A legacy rate cites its table only while its value is that table's own figure (checked to 1e-9); an older value says
"a typical rate filled in when the box was left empty" and cites nothing. An older payment was worked out by Get started
with `typicalPayment(kind, owed, rate)` (core/math/finance.js: a loan's level payment over 360, 60, 120 or 36 months, a
card's month of interest plus 1% of the balance, whole dollars). Each render checks it against the debt's rate and
balance today: when they no longer give the same payment (to $0.005) the row is **stale**: it says "We worked this out
from the rate and what you owed back then. They've changed, so type your real payment." (no "Our guess:"), cites
nothing and leads the page. Example: $185,000 at 7.24% gives $1,261; with 6.125% typed it would be $1,124, so the
$1,261 is stale. A plan the gate closes (not U.S. dollars, a bank file in another currency, outside the U.S.) gets the
neutral rate line and no source on any row. The setup rows take their why from the setup's
estimator when it is in the registry, and from `LEGACY_SETUP` when it is not.

## Estimators in this commit (estimators/debts.js; spec 7.D)
All tier 2, unit rate, no spread (R11: rates have no band), rounded to 0.1 of a point.

| key | order | formula | tables | why |
|---|---|---|---|---|
| `debt.mortgage.rate` | 4 | the state's average contract rate on mortgages outstanding (FHFA NMDB 2026 Q2, row "Average contract interest rate (%)"); no state: the U.S. figure by loan count (4.4%); tap `mortgage-start` = `2022on`: the 2025 new home-purchase rate, the state's, or with no state the U.S. one by loan count (all purchase loans, 6.3%: "the average on new U.S. home loans lately") | `mortgage_outstanding_fhfa_by_state_2026q2`, `mortgage_outstanding_fhfa_national`, `mortgage_new_purchase_fhfa_by_state_2025`, `mortgage_new_loans_fhfa_national_2025` | "the average on Ohio mortgages people already have" (Ohio 4.6%, Arizona 4.3%) |
| `debt.credit.rate` | 10 | G.19 "accounts assessed interest", August 2026: 22.36% -> 22.4% | `cc_apr_fed_g19` | "the average rate on cards that charge interest" |
| `debt.student.rate` | 13 | Direct Subsidized/Unsubsidized undergraduate, first paid out 2026-07-01 to 2027-06-30: 6.52% -> 6.5%. Earlier years' rates are not in the tables. | `student_loan_rates_federal` | "the federal rate on new undergraduate student loans" |
| `debt.loan.rate` | 16 | G.19 personal loan, 24-month, August 2026: 11.90% | `auto_personal_rate_fed_g19` | "the average bank rate on a two-year personal loan" |

No page calls them yet: Get started starts using them in C2 together with what is owed and the payment (E21-E32), the
car-loan rate (E26, which needs the new/used class) and the home (E18, E23, E24).
The setup's own keys live in modules/overview/setup/compute.js `estimators` (tier 4, basis "yours": worked out from the
plan's own answers with the formulas the setup always used; `tables: []`, `dataAsOf` "2026-11-02").

## The statistics (spec 2.2; core/math/estimate.js, tested in tests/estimate-math.test.mjs)
- **R1** the statistic per kind of field: balances, prices, pay and loan amounts the median of the narrowest cell;
  spending rows survey means as shares of after-tax income; rates the published average; choices the mode; ages and
  years the median, interpolated; lumpy costs that add up over years (upkeep) the mean.
- **R2** anchor x one income-adjusted ratio per independent axis: `r_d = [m(T_d, level)/m(T_d, all)] / [g(I_d(level))/g(I_d(all))]`.
- **R3** `interpLog`: log-log interpolation between bucket middles, flat outside the end buckets (no cliffs).
  `interpLinear` is the same on a straight line, for shares and ages.
- **R4** `combineLog`: `ln v = sum(ln v_i / s_i^2) / sum(1/s_i^2)`, `s = (sum 1/s_i^2)^-1/2`.
- **R5** `hurdle`: p < 0.35 skip, 0.35-0.65 ask (Not sure takes the likelier side), > 0.65 assume; no published share
  (null, undefined, not a finite number) always asks; `logitCombine` adds
  one-way shares on the log-odds scale.
- **R6** `sigmaFromMeanMedian` `sqrt(2 ln(mean/median))`; `propagate` `sqrt(s_own^2 + sum (e_i s_i)^2)`; `elasticity`
  central difference on logs; `middleHalf` `v e^(-/+0.674 s)`. Declared (unmeasured) spreads may make a verdict wait;
  they are never printed as a range.
- **R9** `typoCheck`: only when `|ln(typed/guess)|/s > 2.33` and a common slip maps the figure inside `|z| <= 0.674`.
- **R11** `roundGuess`: flows to $10 under $1,000 else $50 (2 significant figures when a measured s > 0.5); balances 3
  significant figures when s <= 0.15 else 2; rates 0.1 point; ages and years whole.
- R7 (couples split by pay), R8 (totals are sums), R10 (the household envelope) and R12 (bank files) are the spending
  and saving commits' (C3, C4, C7).

## Data (data/*.js, built by tools/build-guess-data.mjs)
Built from the research step's files (`est/data/*.json`, read 2026-11-02; a copy is kept in the git-ignored
`vendor/guess-data/` for rebuilds). Values exactly as published, columnar (`{ cols, rows: { key: [value per col] } }`;
a state table's `cols` is `STATES`: the U.S., then the 50 states and DC by code). Each table carries title, publisher,
table, url (https only), vintage, readOn, stat, unit, dollarsOf (the year of its dollars, from the build's SELECT entry,
else the research's; a table whose figures carry their own year says `dollarsBy`: "row", "col" or "cell"), industry,
derived, by, and for the sources fold org, shownBy, tableShown and asOf (plain words: the research's publisher and
vintage carry working notes). The build refuses a table with no publisher, https URL, vintage or read date, a table in
dollars with no year, a publisher with no row in its `PUBLISHERS` list, any table that is the subject of an entry on its
file's `unverified` list, and the never-bundled ids (USDA food plans: a recommended diet, not spending; Fannie Mae's maintenance rule of
thumb: advice that stays on Home; the LIMRA, ACLI and NCS life and disability tables: no estimator uses them yet). The
`unverified` entries are prose with no ids, so tools/guess-data-unverified.mjs maps each one by hand (found by the start
of its `what`) to the tables it concerns, which are never bundled, and the substitutes bundled instead; an entry with
no row there, a row that matches no entry, or a bundled table an entry concerns or names without being its approved
substitute stops the build. It runs the leak guard on what it wrote. `node tools/build-guess-data.mjs <folder> --check` compares a fresh build with
the files (the build is deterministic). Refreshing: each file's header names the next releases; a yearly data commit
rebuilds them, settle then moves untouched guesses at the person's next change, and the `d` guard keeps an older app
from putting old figures back.
Industry sources (said so in the sources fold): Vanguard How America Saves, KFF and Experian. Child Care Aware of
America is a nonprofit; its table is not marked as an industry source. Research-derived (worked out by the research step from published files, `derived: true`): the
SCF income percentile cut-offs, the EIA gas bill, the AHS upkeep figures and the ACS property-tax rate (median tax over
median value). The FHFA balance per loan is a derived constant below.
Prices: survey shares are ratios to income and need no aging; balances are end of 2025 and are not aged; flows
published in an older year's dollars (NAIC 2023, AHS 2023, NDCP 2022, each table's `dollarsOf`) will be aged with the published CPI in
modules/retirement/historical/data/returns.js up to its last year (2025), never beyond and never with the plan's own
inflation setting (the estimators that use them arrive in C2-C3).

### Derived constants (`DERIVED`, recomputed from `T` in module.test.mjs)
| constant | value | how |
|---|---|---|
| `contractShare` (spend.js) | 0.897 | renters: rentedDwellings / (rentedDwellings + utilities - telephoneServices) |
| `taxRatio2023` (spend.js) | 0.997, 0.937, 0.896, 0.798 (second to fifth fifth) | incomeAfterTaxesMean / incomeBeforeTaxesMean per income fifth, 2023 |
| `energyShare` (spend.js) | 0.523 | (electricity + naturalGas + fuelOilOtherFuels) / utilities, all households |
| `vehicleInsShare` (spend.js) | 0.269 | vehicleInsurance / (gasoline + maintenance + rentals and licences + vehicle insurance + public transport) |
| `perLoanByState` (debts.js) | Ohio $156,814; Arizona $250,538; Texas $223,570 | unpaid principal balance x 1e9 / (active loans x 1e3) |
| `upkeepRatio` (home.js) | 0.00293 | the AHS all-owners aggregate maintenance / aggregate value cell (0.293%) |
| `scfMortgageMedianToMean` (balances.js) | 0.767 | SCF median / mean mortgage balance, all families with one |
| `deferralMedianToMean` (pay.js) | 0.868 | Vanguard median / average participant deferral rate (6.6 / 7.6) |

### Declared constants (used by the commits that follow; stated here so they are never hidden)
Survey spending spread 0.25 (not measured: may make a verdict wait, never printed as a range); the envelope factor's
lower bound 0.5; "Not sure" takes the likelier side of a hurdle; 3- to 5-year-olds priced at Child Care Aware's
"four-year-old" figure; unmarried partners priced with the married-couple cells (the survey has no other couple
column). Direction of bias (C3): the survey's lower-income and one-parent cells spend more than their after-tax income,
so spending guesses lean high for households under about $60,000 after tax; the envelope and the waiting verdict
contain it.

### The tables (63, from 17 publishers)
| table id | file | publisher | as of | dollars of | read | statistic |
|---|---|---|---|---|---|---|
| `ce2025_spend_by_incomeQuintile` | spend.js | U.S. Bureau of Labor Statistics, Consumer Expenditure Surveys | 2025 figures, published 2026 | 2025 | 2026-11-02 | mean |
| `ce2025_spend_by_householdComposition` | spend.js | U.S. Bureau of Labor Statistics, Consumer Expenditure Surveys | 2025 figures, published 2026 | 2025 | 2026-11-02 | mean |
| `ce2025_spend_by_region` | spend.js | U.S. Bureau of Labor Statistics, Consumer Expenditure Surveys | 2025 figures, published 2026 | 2025 | 2026-11-02 | mean |
| `ce2025_spend_by_housingTenure` | spend.js | U.S. Bureau of Labor Statistics, Consumer Expenditure Surveys | 2025 figures, published 2026 | 2025 | 2026-11-02 | mean |
| `ce2025_spend_by_ageOfReferencePerson` | spend.js | U.S. Bureau of Labor Statistics, Consumer Expenditure Surveys | 2025 figures, published 2026 | 2025 | 2026-11-02 | mean |
| `ce2025_profile_by_incomeQuintile` | spend.js | U.S. Bureau of Labor Statistics, Consumer Expenditure Surveys | 2025 figures, published 2026 | 2025 | 2026-11-02 | mean |
| `ce2025_profile_by_householdComposition` | spend.js | U.S. Bureau of Labor Statistics, Consumer Expenditure Surveys | 2025 figures, published 2026 | 2025 | 2026-11-02 | mean |
| `ce2025_profile_by_region` | spend.js | U.S. Bureau of Labor Statistics, Consumer Expenditure Surveys | 2025 figures, published 2026 | 2025 | 2026-11-02 | mean |
| `ce2025_profile_by_housingTenure` | spend.js | U.S. Bureau of Labor Statistics, Consumer Expenditure Surveys | 2025 figures, published 2026 | 2025 | 2026-11-02 | mean |
| `ce2025_profile_by_ageOfReferencePerson` | spend.js | U.S. Bureau of Labor Statistics, Consumer Expenditure Surveys | 2025 figures, published 2026 | 2025 | 2026-11-02 | mean |
| `ce2023_aftertax_income_by_incomeQuintile` | spend.js | U.S. Bureau of Labor Statistics, Consumer Expenditure Surveys | 2023 figures, the newest year with income after taxes | 2023 | 2026-11-02 | mean |
| `ce2023_aftertax_income_by_region` | spend.js | U.S. Bureau of Labor Statistics, Consumer Expenditure Surveys | 2023 figures, the newest year with income after taxes | 2023 | 2026-11-02 | mean |
| `ce2023_aftertax_income_by_ageOfReferencePerson` | spend.js | U.S. Bureau of Labor Statistics, Consumer Expenditure Surveys | 2023 figures, the newest year with income after taxes | 2023 | 2026-11-02 | mean |
| `acs2025_median_gross_rent_by_state` | spend.js | U.S. Census Bureau, American Community Survey | 2025 figures, published October 2026 | 2025 | 2026-11-02 | median |
| `eia2025_residential_electric_bill_by_state` | spend.js | U.S. Energy Information Administration | 2025 figures, published October 2026 | 2025 | 2026-11-02 | mean |
| `eia2024_residential_natural_gas_bill_by_state_DERIVED` | spend.js | U.S. Energy Information Administration (research-derived) | 2024 figures, published October 2026 | 2024 | 2026-11-02 | mean |
| `naic2023_auto_insurance_by_state` | spend.js | National Association of Insurance Commissioners | 2023 figures, published February 2026 | 2023 | 2026-11-02 | mean |
| `naic2023_homeowners_premium_by_state` | spend.js | National Association of Insurance Commissioners | 2023 figures, published July 2026 | 2023 | 2026-11-02 | mean |
| `ccaoa2025_childcare_annual_price_by_state` | spend.js | Child Care Aware of America | 2025 prices, published May 2026 | 2025 | 2026-11-02 | mean |
| `ndcp2022_childcare_weekly_price_by_state` | spend.js | U.S. Department of Labor, Women's Bureau | 2022 prices, published November 2024 | 2022 | 2026-11-02 | median |
| `ndcp_childcare_weekly_price_fallback_older_years` | spend.js | U.S. Department of Labor, Women's Bureau | Prices from an earlier year where 2022 is missing, published November 2024 | per cell | 2026-11-02 | median |
| `scf2025_median_value_if_held` | balances.js | Federal Reserve Board, Survey of Consumer Finances | 2025 survey, published October 2026 | 2025 | 2026-11-02 | median |
| `scf2025_mean_value_if_held` | balances.js | Federal Reserve Board, Survey of Consumer Finances | 2025 survey, published October 2026 | 2025 | 2026-11-02 | mean |
| `scf2025_pct_families_holding` | balances.js | Federal Reserve Board, Survey of Consumer Finances | 2025 survey, published October 2026 | - | 2026-11-02 | share |
| `scf2025_family_income` | balances.js | Federal Reserve Board, Survey of Consumer Finances | 2025 survey, published October 2026 | 2025 | 2026-11-02 | median |
| `scf2025_actual_income_percentile_cutoffs_derived` | balances.js | Federal Reserve Board, Survey of Consumer Finances (research-derived) | 2025 survey, published October 2026 | 2025 | 2026-11-02 | percentile |
| `vanguard_has2026_401k_balance_by_age` | balances.js | Vanguard, How America Saves (industry) | End of 2025, published 2026 | 2025 | 2026-11-02 | median and mean |
| `acs_median_earnings_by_state` | pay.js | U.S. Census Bureau, American Community Survey | 2025 figures, published October 2026 | 2025 | 2026-11-02 | median |
| `cps_ftyr_income_by_age5` | pay.js | U.S. Census Bureau, Current Population Survey | 2025 income, published September 2026 | 2025 | 2026-11-02 | median and mean |
| `cps_median_earnings_by_age` | pay.js | U.S. Census Bureau, Current Population Survey | 2025 earnings, published September 2026 | 2025 | 2026-11-02 | median |
| `vanguard_has2026_headline` | pay.js | Vanguard, How America Saves (industry) | 2025 figures, published June 2026 | 2025 | 2026-11-02 | as published |
| `vanguard_has2026_deferral_by_income_age` | pay.js | Vanguard, How America Saves (industry) | 2025 figures, published June 2026 | - | 2026-11-02 | mean |
| `vanguard_has2026_participation_by_income_age` | pay.js | Vanguard, How America Saves (industry) | 2025 figures, published June 2026 | - | 2026-11-02 | share |
| `vanguard_has2026_top_match_formulas` | pay.js | Vanguard, How America Saves (industry) | 2025 figures, published June 2026 | - | 2026-11-02 | share |
| `vanguard_has2026_deferral_distribution` | pay.js | Vanguard, How America Saves (industry) | 2025 figures, published June 2026 | - | 2026-11-02 | share |
| `cc_apr_fed_g19` | debts.js | Federal Reserve Board | August 2026, published October 2026 | - | 2026-11-02 | average |
| `auto_personal_rate_fed_g19` | debts.js | Federal Reserve Board | August 2026, published October 2026 | - | 2026-11-02 | average |
| `mortgage_outstanding_fhfa_by_state_2026q2` | debts.js | Federal Housing Finance Agency | April to June 2026, published September 2026 | 2026 | 2026-11-02 | average |
| `mortgage_outstanding_fhfa_national` | debts.js | Federal Housing Finance Agency | April to June 2026, published September 2026 | 2026 | 2026-11-02 | average |
| `mortgage_new_purchase_fhfa_by_state_2025` | debts.js | Federal Housing Finance Agency | Loans made in 2025, published September 2026 | - | 2026-11-02 | average |
| `mortgage_new_loans_fhfa_national_2025` | debts.js | Federal Housing Finance Agency | Loans made in 2025, published September 2026 | - | 2026-11-02 | average |
| `mortgage_rate_pmms_weekly_2026` | debts.js | Freddie Mac | The week of October 29, 2026 | - | 2026-11-02 | average |
| `student_loan_rates_federal` | debts.js | U.S. Department of Education, Federal Student Aid | Loans first paid out July 2026 to June 2027 | - | 2026-11-02 | as set by law |
| `card_minimum_payment_rule_cfpb` | debts.js | Consumer Financial Protection Bureau | December 2025 report | 2025 | 2026-11-02 | most common |
| `auto_loan_terms_experian_q2_2026` | debts.js | Experian Automotive (industry) | April to June 2026 | 2026 | 2026-11-02 | average |
| `auto_rate_by_credit_tier_experian_q2_2026` | debts.js | Experian Automotive (industry) | April to June 2026 | - | 2026-11-02 | average |
| `acs2025_median_home_value_by_state_and_mortgage_status` | home.js | U.S. Census Bureau, American Community Survey | 2025 figures, published October 2026 | 2025 | 2026-11-02 | median |
| `acs2025_median_home_value_by_state` | home.js | U.S. Census Bureau, American Community Survey | 2025 figures, published October 2026 | 2025 | 2026-11-02 | median |
| `acs2025_effective_property_tax_rate_by_state` | home.js | U.S. Census Bureau, American Community Survey (research-derived) | 2025 figures, published October 2026 | - | 2026-11-02 | ratio of medians |
| `acs2025_hoa_condo_fee_by_state` | home.js | U.S. Census Bureau, American Community Survey | 2025 figures, published October 2026 | 2025 | 2026-11-02 | median and share |
| `acs2025_year_moved_in_by_age_us` | home.js | U.S. Census Bureau, American Community Survey | 2025 figures, published October 2026 | - | 2026-11-02 | count |
| `acs2025_median_year_moved_in_by_state` | home.js | U.S. Census Bureau, American Community Survey | 2025 figures, published October 2026 | - | 2026-11-02 | median |
| `acs2025_homeownership_by_age_us` | home.js | U.S. Census Bureau, American Community Survey | 2025 figures, published October 2026 | - | 2026-11-02 | share |
| `fhfa_hpi_at_state_annual` | home.js | Federal Housing Finance Agency | 1990 to 2025, published March 2026 | - | 2026-11-02 | index |
| `ahs2023_routine_maintenance_spending` | home.js | U.S. Census Bureau and HUD, American Housing Survey (research-derived) | 2023 survey, the newest | 2023 | 2026-11-02 | median, mean and ratio |
| `kff_ehbs2026_premiums` | health.js | KFF, Employer Health Benefits Survey (industry) | 2026 figures, published October 2026 | 2026 | 2026-11-02 | mean |
| `kff_aca_benchmark_premium_40yo` | health.js | KFF State Health Facts (industry) | Plan years 2026 and 2027 | per row | 2026-11-02 | average |
| `cms_aca_age_rating_curve` | health.js | Centers for Medicare & Medicaid Services | In use since 2018, the newest published | - | 2026-11-02 | ratio |
| `cms_medicare_2026_parts_ab` | health.js | Centers for Medicare & Medicaid Services | 2026 figures, published November 2025 | 2026 | 2026-11-02 | as set |
| `cms_medicare_part_d_parameters` | health.js | Centers for Medicare & Medicaid Services | 2026 and 2027 figures | per col | 2026-11-02 | as set |
| `kff_medigap_average_premium_2025` | health.js | KFF, from NAIC Medigap data (industry) | 2025 premiums, published October 2026 | 2025 | 2026-11-02 | mean |
| `ssa_snapshot_2026_09_average_benefit` | retire.js | Social Security Administration | September 2026, published October 2026 | 2026 | 2026-11-02 | mean |
| `ssa_retired_worker_benefit_by_age_sex_2025` | retire.js | Social Security Administration | December 2025, published 2026 | 2025 | 2026-11-02 | mean |

`STATE_REGION` (data/index.js): the U.S. Census Bureau's four regions, the ones the CE survey reports by.

## The import rule (spec 6.2; a test reads the import graph)
compute.js and estimators/*.js import `core/*`, their own `data/`, and, read-only, other modules' data files and these
computes: `core/math/tax.js`, `modules/taxes/state/compute.js` (claude-a's file, imported and never edited) and
`modules/cashflow/expenses/compute.js`. No file reachable from this compute imports this compute, and it imports no
`overview/*` compute. overview/setup may import this compute (nothing here reaches setup).

## Coverage (coverage.js)
Every input the 2026-11-02 inventory marked "a layperson does not know this" (191 rows after de-duplication, the
"roughly / no" 401(k) balance on Get started and the "no (until quoted)" refinance rate included; the spec counted 188), with how a blank is handled: `guess:<key>`, `compute:`, `fallback:`, `example`, `ask`, `other-builder`
(claude-a's pages) or `later:C<n>`. `npm run check` validates it and prints "guess coverage: N of 191 unknown inputs
handled (M later)"; a `later:` row whose commit is built fails. C1: 48 handled, 143 later.

## Tests (module.test.mjs)
Data: every table has publisher, https URL, vintage and read date; every row's length equals `cols`; spot values (CE
all-households spending $81,905; Vanguard 35-44 median $46,919; FHFA Ohio 4.6%, Arizona 4.3%; ACS Ohio home value
$254,100; ACS Texas median gross rent $1,515; NAIC Ohio HO-3 $1,116; CCAoA Ohio four-year-old center $10,552);
`DERIVED` recomputed from `T`; nothing on an `unverified` list or the never-bundled list; no `readOn` after the test's
today. Contract: every estimator (this module's and setup's) returns null or an Estimate whose tables resolve, with a
why of at most 70 characters, `dataAsOf` set and `low <= value <= high` when measured; `checkEstimators` is empty;
the import graph follows the rule above. Gate: EUR and "outside the U.S." give null for every key; a blank state gives
the national figure with "your state" in `sharperWith`. The page compute: empty states, a frozen row first, ledger and
legacy rows, labels, sources. Coverage: 191 rows, each `how` valid, every `guess:` key defined.
Review of C1 (2026-11-06), each a test that failed before its fix: the 2022-or-later mortgage with no state (6.3%);
every table in dollars has its year; the sources fold's plain fields and the publisher count; the unverified map
(unmapped, stale and refused cases, on every clone); a dynamic `import()` is seen and only the three named data files
of other modules are allowed; an older payment stale after a rate or balance change, cited from its rate only while
the rate is a guess; a plan the gate closes cites no table; the european-bank.csv import closes the gate; and the page
drawn with a stand-in UI kit (44 px source links, 6.125% said as typed, the stale payment first, the non-U.S. fold).
Elsewhere: tests/estimate-math (R3-R11 by hand), estimate-paths, estimate-ledger, estimate-settle (stub estimators and
a 500-sequence fuzz: a typed figure always keeps its value), store-settle (once per update; never on load, adopt,
replace, resolve, resync or another tab's save; a throw keeps the change; the whole store-sync suite again with
`SETTLE_HOOK=1`), estimate-perf (200 settles of 40 guesses on the largest qa plan under 600 ms; 10,000 no-guess
settles under 50 ms), guesses-invariance (every qa fixture and every qa/households plan: settle changes nothing,
migrate adds no `guesses`, the store keeps the same plan with and without the hook, every module computes the same)
and guesses-legacy (the older flags frozen, listed, and made the person's own by "That's about right" or typing).
`qa/fixtures/guessed-plan.mjs` is a household made through Get started with the unknown boxes left empty (the older
guesses in place): the tests and the screenshots use it.

## Next (spec 15)
C2 debts are never dropped (owed, payment, car-loan rate, home; the "Better guesses" card); C3 spending; C4 retirement
saving; C5 the questions and the reveal (pay, goal targets); C6 the form kit and the pages outside setup (`restsOn`);
C7 existing plans and bank files; C8 verdict ranges and the measured ranking; C9 calculator previews and coverage;
C10 plain words.
