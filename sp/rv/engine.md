# Engine report: the money model behind "Will the money last?"

Repo `$REPO`, branch `claude/creative-build-b531q0`, tip `fe678cb`. Read-only. Every claim is file:line.
Throwaway scripts used for the numbers: `scratchpad/rv/engine-timing/*.mjs` (they import the repo's pure computes, write nothing).

## Short answers

1. **The money left over each month is ignored by the projection, before and during retirement.** Only typed retirement
   contributions go in while working. Cash already in checking and savings sits in a "cash" bucket earning 2% until it is
   spent first in retirement. In retirement, income above spending is dropped (only a required withdrawal's excess is
   reinvested). Two defects sit next to this: income paid *before* the household's retirement year (a partner's pay who
   works on, a pension or Social Security already paid) is dropped, and in **brackets** tax mode its tax is **taken out of
   savings** every working year.
2. **The account decides Roth or not; a person cannot split one contribution.** Each contribution row names one account,
   and the account's type maps to one bucket (`401k`/`ira` pre-tax, `roth`/`hsa` tax-free, `brokerage` taxable). A
   60/40 Roth/traditional 401(k) takes two accounts and two rows. The **employer match always goes where the row goes**,
   so a match typed on a Roth row goes Roth (tax-free), which is not the law's default (pre-tax). The engine also never
   taxes a Roth match or credits the tax saved by a pre-tax contribution.
3. **A minimal change is two optional fields on `retirement.contributions[]` (`roth`, `matchRoth`), no version bump.**
   Eleven readers must follow it. Splitting one 401(k) *balance* into Roth and pre-tax touches 29 files that branch on
   account type, so keep two accounts for balances for now.
4. **Every market and planning input has a default.** The defaults are written into every plan by `migrate()`. Confirmation
   is recorded only as one `assumptions.reviewedAt` date for all ten Assumptions fields, and per field only for the
   figures the guesses ledger tracks. Stock shares, the flat tax rate, the claiming age, the plan-to age and health
   prices have no confirmation flag.
5. **The levers already exist.** Sensitivity (tornado), Goal seek (solve each lever), Scenario compare (`LEVERS`) and
   Advisor's plan (one assumption at a time). One engine run takes 0.1 ms in flat mode, 0.8 ms in brackets mode and up to
   3.4 ms with Roth conversions. Sensitivity takes 27 to 112 ms in flat mode, rising to 2.2 s with brackets and Roth
   conversions on the family plan. On the phone (GitHub Pages) it all runs on the main thread, with no worker.

---

## (1) The money left over each month

**What the engine adds while working.** Only `inputs.contributions`:
- `core/math/retirement.js:129-139`: for each contribution, `amt = c.yearly * (1+salaryGrowth)^i` goes into `buckets[c.bucket]` until the person's retirement age (`:133`), their `untilYear` or `skipYears` (`:135`).
- No pay, no spending and no tax on pay are modelled before retirement. Spending and withdrawals are set only `if (retired)` (`:158-169`).
- `buildInputs` never reads the left-over. The inputs object is `projection/compute.js:1008-1019`: start and end years, people, balances, contributions, incomes, spending, retireYear, loans, rates, returns, stdev, rmd, strategy, withdrawal rate and order, tax, Roth conversion, plus health events (`:1027`). None of it comes from Next best action's `spare` or `core/math/leftover.js`.
- `grep spare.monthly|leftOverOf|yearSaving(` finds readers only in liquidity, benefits, budget, expenses, payoff, prioritizer, alerts, health-score, next-best-action, setup and purchase. Nothing under `retirement/` or `scenarios/` reads it.

**The left-over figure the app shows elsewhere** is `spare.monthly`:
- Formula: gross pay − business costs − federal, payroll and state tax − spending − retirement saving − goal saving − debt extra − held-back pay (`overview/next-best-action/compute.js:146-164`; `core/math/leftover.js:1-6`).
- It reaches the Dashboard and Budget but never the projection.
- Goal saving (`spare.goalSaving`) and the debt extra are not in the projection either. Freed debt payments after a payoff are not saved.

**Cash already saved:**
- Checking, savings and cash accounts map to the `cash` bucket (`projection/compute.js:37`, summed at `:886` for every account; the emergency fund and goal-funded accounts are *not* excluded).
- The bucket grows at `returnCash` (`core/math/retirement.js:309`; default 0.02, `core/schema/migrate.js:54`).
- It is always spent first in retirement (`core/math/retirement.js:101`).
- So "money that built up in savings" is assumed to stay in cash, never invested.

**In retirement:**
- Fixed-real (the default): `need = max(0, spending + health − income) + one-offs` (`core/math/retirement.js:178`). Income above spending is simply not added to any bucket.
- The only money reinvested is a required withdrawal beyond the year's need, which goes to taxable (`:303-304`), and a negative one-off event (`:176`).
- Percent and VPW spend surplus income by design. Guardrails spends `max(target, income − tax − health)` (`:301`).

**Defect A: income before the household's retirement year is dropped, and taxed from savings in brackets mode.**
- Lines paid from *this* year go into `incomes`:
  - a partner who works past the household's retirement year: `from = Math.max(year, r.from)` (`projection/compute.js:966`);
  - Income-page pensions already paid: `startYear = nowYear` (`:72`);
  - Social Security already paid (`:98-100`).
- In working years `spending = 0`, so `need = 0` and the income vanishes (`core/math/retirement.js:178`).
- In brackets mode `taxFor` counts `incomeTaxable` in every year (`:197`) and `settle` withdraws that tax from the buckets (`:212-226`).
- Measured on the family fixture:
  - Bo's retirement age set to 75: his $69,600 pay is an income line from 2026 to 2062, and the 2026 to 2054 working years are dropped. In brackets mode $3,992 in 2026 and $4,114 in 2027 come **out of savings**. The most the plan could spend falls from $10,658 a month (flat) to $9,571 (brackets).
  - A $6,000 a month pension already paid to Bo: $72,000 a year is dropped, and in brackets mode $4,280 a year of tax comes out of savings (`scratchpad/rv/engine-timing/partnerpay.mjs`, `preincome.mjs`).
- In flat mode the income is dropped and untaxed.

**Financial independence page (FIRE) inconsistency.**
- Its 25-times-spending "years to FI" adds a left-over: `(income.monthly − expenses.monthly) × 12`, with income **before tax** (`retirement/fire/compute.js:72-73`; `cashflow/income/compute.js:48,74` keeps full amounts).
- Its lead answer (`withIncome`, the engine via goal seek's `earliestRetireAge`) adds none.

**How big the ignored left-over is** (`spare.mjs`). The full `spare.monthly` was added as a contribution. This is an upper bound: the engine also grows it with raises (`:136`).

| plan | left over/mo | today: lasts? / most it could spend a month | left-over invested (taxable) | left-over kept as cash (2%) |
|---|---|---|---|---|
| family (working couple) | $3,884 | lasts / $8,434 | $16,145 | $12,142 |
| sam (single, no savings) | $746 | short 2067 / $0 | lasts / $4,349 | $2,606 |
| jordan | $398 | short 2050 / $0 | still short / $3,423 | $3,128 |
| patLee | $5,990 | lasts / $6,217 | $7,328 | $7,142 |

## (2) How a contribution becomes Roth, traditional or taxable

**Shape.** `retirement.contributions[]` is `{ id, accountId, personId, amount, period, employerMatch (yearly $), pctOfPay? }` (`docs/DATA_MODEL.md:47`; `core/schema/migrate.js:62`). It has no tax field. There is no `taxTreatment` field on accounts either. The account's `type` is the only signal (`balance/net-worth/compute.js:8-28`; `roth` is labelled "Roth IRA / 401(k)", taxBucket free, `:15`).

**Bucket.** `bucket = BUCKET_OF[acct.type] ?? "taxable"` (`projection/compute.js:934`):
- `BUCKET_OF` (`:37`): checking, savings and cash → cash; brokerage and crypto → taxable; 401k, ira and cash_value_life → deferred; roth and hsa → free.
- A row whose account is gone, or the scenario lever "save more" (`scenarios/compare/compute.js:20`, `accountId: ""`), lands in **taxable**.

**Employer match.**
- `yearly = perYear(amount) + employerMatch`, all into that one bucket (`projection/compute.js:939`). So a match on a `roth` row goes **tax-free**.
- The law's default is pre-tax (IRC 402(a), 402A). SECURE 2.0 §604 (Dec 29, 2022) lets a plan *offer* a Roth match the employee elects. It is then taxable income that year.
- The app treats a match as the signal that a `roth` row is a Roth 401(k) (`retirement/contributions/compute.js:16-21`; `overview/next-best-action/compute.js:300-304`). So the designed Roth 401(k) case always sends its match Roth.
- Neither the engine nor `taxes/federal` (`:305-307` reads `perYear(amount)` only) counts a Roth match as income.

**Per person.** Yes:
- `personIndex` from `c.personId` (unknown → first adult, `projection/compute.js:928,939`) sets the stop age (`core/math/retirement.js:132-134`) and adds a pre-tax row to that person's required-withdrawal (RMD) slice (`:138`).
- A 401(k) or matched row also stops at the owner's last pay line (`projection/compute.js:936-939`).
- The buckets themselves are household-wide (`core/math/retirement.js:94`). Only RMD slices are per person (`rmdOwners`, `projection/compute.js:302-307`, by account `ownerId`).

**Per account.** Yes, each row names one account (`retirement/contributions/view.js:94`, "Into which account": accounts whose bucket is not cash, `:85`).

**Splitting one 401(k) 60/40.** Not possible in one row or one account:
- The form has no tax choice (`retirement/contributions/view.js:93-100`).
- Workaround: two accounts (a `401k` one and a `roth` one whose name contains "401(k)" or that carries a match) and two rows.
- Get started makes one retirement account per adult: "Through work" is type `401k`, a Roth set on Net worth stays Roth, and only "On my own" asks Traditional or Roth for an IRA (`overview/setup/compute.js:88,94,111,929`). It writes one row with both the employee's money and the match (`:933-938`).

**Inconsistencies a split would expose:**
- A `roth` row with no match and no "401(k)/403(b)/457/TSP" in its name is checked against the **IRA** limit ($7,500), not the 401(k) one (`retirement/contributions/compute.js:20-21`).
- The Paycheck page takes pre-tax 401(k) from plan rows of type `401k` only (`cashflow/paycheck/compute.js:127,139`). Its "Roth 401(k), after tax" line reads only the typed `whatIfs.paycheck[pid].roth` (`:187`), never a plan row.
- Equal dollars, Roth wins in the engine:
  - The engine has no working-year tax and no left-over, so the tax a pre-tax contribution saves today is never credited.
  - Family fixture, Ana's 401(k) retyped `roth` with the same $15,270 (match included): the most the plan could spend rises from $8,434 to $8,919 a month in flat mode (+$485) and to $8,938 in brackets mode (+$504).
  - Meanwhile this year's federal tax rises from $14,112 to $16,890 (+$2,778, `taxes/federal`), which the projection never sees (`scratchpad/rv/engine-timing/rothbias.mjs`).
  - Any Roth/traditional lever built on today's engine is biased toward Roth.

## (3) A minimal, backward-compatible schema change

**Fields.** On `retirement.contributions[]`, two optional fields, read with a default (DATA_MODEL "Rules for changing it", `docs/DATA_MODEL.md:56`; AGENTS.md rule 7). No `SCHEMA_VERSION` bump (`core/schema/migrate.js:9`):
- **`roth?: number` (0..1):** the share of the person's own money that goes in as Roth (a designated Roth source, IRC 402A).
  - Absent means it comes from the account type, exactly as today: `roth` → 1, everything else → 0.
  - It is meaningful on a work plan (type `401k`, or a `roth` row that is a Roth 401(k) by `limitKind`). Traditional and Roth IRAs are separate accounts by law, so an IRA split stays two accounts.
- **`matchRoth?: number` (0..1):** the share of the employer's money the person elected as Roth (SECURE 2.0 §604).
  - Absent means 0: employer money is pre-tax (deferred), whatever the account type.
  - This moves computed figures only for rows that today carry a match on a `roth` account (match free → deferred). No stored data changes shape, which is the precedent DATA_MODEL already uses for "changed meaning, no version bump: only computed figures move" (`docs/DATA_MODEL.md:42` status, `:47` supplementPremium).
  - Zero movement alternative: read absent as 1 on a `roth`-typed row (today's behaviour) and write 0 explicitly on new rows. That keeps a default that is wrong under the law.

**Engine.** `core/math/retirement.js` needs no change: it takes rows by bucket (`:137`) and RMD slices by `personIndex` (`:138`).

**Readers that must follow** (grep `retirement.contributions|BUCKET_OF|limitKind`):
1. `retirement/projection/compute.js:932-940` (buildInputs): one row becomes up to four engine rows.
   - own × (1−roth) → deferred (keep the `rmdExempt` rule)
   - own × roth → free
   - match × (1−matchRoth) → deferred
   - match × matchRoth → free
   - Keep `untilYear`, `personIndex` and `name`. The work-plan test at `:936` is unchanged.
2. `retirement/contributions/compute.js:20-23,61-69`: `limitKind` (a Roth share on a `401k` row stays the 401(k) limit); items gain pre-tax and Roth yearly amounts. `view.js:93-100` gains the form field and `:305-306` the edit values (and the record lines).
3. `taxes/federal/compute.js:305-335`: `pretax` (`:316`) = Σ own × (1−roth) of 401(k) rows; `roth` for the catch-up order; a Roth match share is added to income. The IRA deduction (`:332`) stays by type.
4. `cashflow/paycheck/compute.js:84,127,138-139,187`: the pre-tax 401(k) is own × (1−roth); the Roth part feeds the "Roth 401(k), after tax" line, which today reads only the typed figure.
5. `cashflow/budget-percent/compute.js:55` (`yearTaxes`) and the Next best action left-over (`next-best-action/compute.js:130-164`) follow through the federal tax. `retirementSaving = con.yearly` is unchanged.
6. `overview/guesses/estimators/spend.js:147-151` (`typedPretax`): × (1−roth).
7. `career/benefits/compute.js:159-166,270` (`isK` replaces the person's `401k` rows with one pre-tax row, which would drop a Roth share) and `view.js:239-249` (writes a new row). `taxSaved` and `paycheckChange` (`:74,153`) assume all pre-tax.
8. `investments/limits/compute.js:100-103,140,224`: traditional vs Roth IRA money by type, and 401(k) room.
9. `overview/next-best-action/compute.js:284-315,564,577`: the match step tests `401k`-type and work-Roth accounts. It is unaffected by a share but must keep reading `limitKind`.
10. `overview/setup/compute.js:929-938` (Get started's `put()` must keep the new fields on `setup-contrib-<pid>`) and `:2094-2109` (reads the row back).
11. `scenarios/goal-seek/compute.js` "saving" lever (adds to `main.bucket` of the biggest engine row; after a split that is one of the split rows) and `scenarios/sensitivity/compute.js` "saving" (scales every row; fine).

Pass-through only (keyed by person, account or amount; no change):
- `ai/reader/compute.js:167,199`
- `household/people/compute.js:100,159`
- `scenarios/stress-tests/compute.js:203`
- `taxes/filing-status/compute.js:31`
- `taxes/hsa-fsa/compute.js:36`
- `system/diagnostics/compute.js:47-48,88,100`
- `system/audit/compute.js:18`
- `system/help/compute.js:20`
- `overview/timeline/compute.js:106`
- `investments/performance/compute.js:25`
- `career/offer-compare/compute.js:128`

Docs and tests:
- `docs/DATA_MODEL.md:47`
- `core/schema/migrate.js:62` (comment)
- `retirement/contributions/README.md:7,51`
- `retirement/projection/README.md:14-16`
- `retirement/contributions/module.test.mjs`, `tests/retirement-pages.test.mjs`, the federal and paycheck tests
- qa fixtures with a Roth row: `qa/fixtures/family-plan.mjs:26,68`, `retirement-plan.mjs:23`

**Mixed balances: not part of the minimal change.** Splitting one 401(k) *balance* would need an optional `accounts[].rothBalance`. Today's equivalent is two accounts. It would touch:
- `projection/compute.js:886` (bucket split) and `:302-307` (`rmdOwners`: Roth 401(k)s have no lifetime RMD from 2024, SECURE 2.0 §325);
- `balance/net-worth/compute.js:64` (`byTaxBucket`) and its view;
- `retirement/rmd/*`, `overview/timeline`, `household/calendar`, `overview/guide/journeys`;
- `retirement/withdrawal-strategy/compute.js:170`;
- `taxes/federal/known.js:170,179,209,216`;
- estate, insurance/life-needs, reports/plan-summary and investments/holdings.

In all, 29 non-test files branch on `type === "401k"|"roth"|"ira"`.

## (4) Assumptions: defaults, where they live, and what the plan records as confirmed

Stored defaults are in `emptyPlan()`. `migrate()` merges them into **every** plan (`core/schema/migrate.js:92-93`), so after the first save an untouched default cannot be told from a typed one. `buildInputs` repeats each as a fallback.

| input | default | stored default / engine fallback | source stated |
|---|---|---|---|
| inflation | 3% | `migrate.js:54` / `projection/compute.js:1011` | BLS CPI-U century average (`system/assumptions/compute.js:10-11`) |
| stock return | 7% | `migrate.js:54` / `:1012` | Damodaran, Shiller; 7% "leaves room for fees" (`assumptions/compute.js:12-13`) |
| bond return | 4% | `migrate.js:54` / `:1012` | Damodaran 10-year Treasuries (`:14-15`) |
| cash return | 2% | `migrate.js:54` / `:1011` (`rates.cash`; the cash bucket, `core/math/retirement.js:309`) | "middle guess" (`:16-17`) |
| stock and bond swings | 15% / 5% | `migrate.js:55` / `:1013` (Monte Carlo only) | Damodaran (`:18-21`) |
| pay raises | 3% | `migrate.js:55` / `:1011`; grows **every** contribution, match included (`core/math/retirement.js:136`) | BLS employment cost index (`:22-23`) |
| stocks now / once retired (glide) | 70% / 50%, straight line to the retirement year, flat after | `migrate.js:61` / `:1011`; glide `core/math/retirement.js:124-126`; `investments.glide` is never read by the engine | **none stated** (projection view's form only, `projection/view.js:332-333,339`) |
| flat tax on pre-tax withdrawals | 15% | `migrate.js:61` / `:1011` | **none stated** (`projection/view.js:335`) |
| spending rule, withdrawal rate, withdrawal order | same every year, 4%, taxable → pre-tax → Roth | `migrate.js:61,67` / `:1015-1016` | projection README |
| retirement age | 65 (per person: `people[].retirementAge`) | `migrate.js:55` / `:884` | `assumptions/compute.js:24-25` |
| plan to age | 95 (per person: `lifeExpectancy`) | `migrate.js:55` / `:884` | SSA life tables (`:26-27`); "a planning choice" (`overview/guesses/coverage.js:27,199`); retirement/longevity can write `lifeExpectancy` |
| Social Security claim age | full retirement age (70 for someone 70 or over who has not claimed) | `retirement/social-security/compute.js:216`; levers fall back to `?? 67` (`scenarios/compare/compute.js:15`, sensitivity, goal seek) | SSA claiming rules in that module |
| Social Security amount | record → typed → Get started's estimate from pay (`guide.setup.ssWrote`, guess `overview/setup:ss`) → none, said in a note | `projection/compute.js:942-944,1033` | SSA formula |
| spending in retirement | today's Expenses (`spendingSource "expenses"`), or Get started's figure from today's bills (`retireAuto`, `setupFigure` `:341-352`), or the ledger guess from age 50 (`overview/setup:retireSpend`) | `projection/compute.js:889-908` | Expenses / Get started |
| health before 65 | marketplace benchmark `BENCHMARK_40` × age curve; "law" credits | `retirement/healthcare/compute.js:68,89` (`data/aca.js`) | healthcare README `:10` |
| Medicare | Part B from data; Part D `PART_D_BASE`; supplement = Medigap Plan G average $194 a month | `retirement/medicare/compute.js:104,108` | DATA_MODEL `:47`, medicare data |
| health cost growth | today's dollars, rising only with general inflation (no medical trend) | events × `priceLevel` (`core/math/retirement.js:176`); healthcare README `:22` | — |
| health on top of spending | yes unless `retirement.healthIncluded` | `projection/compute.js:890` | — |
| brackets mode: gain share, dividend yield, brackets indexed by plan inflation | 50%, 2% | `migrate.js:69` / `projection/compute.js:44-47` | — |
| pension: rises with prices, start age | yes, 65 | `projection/compute.js:949` | — |
| employer match | dollars a year as typed; the "common match" guess is 50% up to 6% of pay | `career/benefits/compute.js:24`, guess `contrib.match` | — |

**What the plan records as confirmed:**
- `assumptions.reviewedAt`: **one** date for all ten Assumptions fields, set by "Save and mark as reviewed" (`system/assumptions/view.js:63-70`). It goes stale after 365 days (`assumptions/compute.js:42-50`). The per-field `changed` is only "differs from default" (`:41`).
- `plan.guesses` (the guesses ledger): per-field "this is our guess" until typed over or confirmed with "That's about right" (`docs/DATA_MODEL.md:45`; `core/estimate/paths.js`). It covers account balances, contribution `.amount` and `.employerMatch`, `retirement.spendingMonthly`, the Social Security estimate (via `ssWrote`), debts and expenses.
- **Not tracked at all**: stock shares, flat tax rate, spending rule, withdrawal rate and order, claim age, retirement and plan-to ages, health prices, the cash rate (`overview/guesses/coverage.js:84-96` lists them "later:C9"; `:194-200` "fallback").
- `retirement.medicare.supplementPremium` blank is flagged `supplementDefault` in compute output (`medicare/compute.js:112`), not stored.

## (5) Existing "what moves the answer" computations, and their cost

**What exists:**
- **Sensitivity** (`scenarios/sensitivity/compute.js`, heavy).
  - Each input is nudged down and up (`NUDGE` `:15`): returns ±1 point, inflation ±1, retirement age ±2, plan-to age ±5, saving ±25%, stocks in retirement ±20 points, flat tax ±5 points, raises ±1.
  - It also includes the claim age ("now" vs 70) and Social Security paid at 77%. Each nudge is measured as the most the plan could spend (`affordableSpending`) and the end balance, then ranked by swing (`:34-44`, `:118-121`).
  - No row for: employer match, the left-over invested, the cash rate, the Roth split, health on top, spending itself.
- **Goal seek** (`scenarios/goal-seek/compute.js:110-240`, heavy). It solves each lever alone by bisection (`largestWhere`/`smallestWhere` `:14-27`): the most you could spend, the earliest retirement age (`earliestRetireAge` `:48`, with a `search: "bisect"` mode), the saving needed (`:169-175`, into the biggest row's bucket), the return needed, the lump sum short or the room today, and the best claim age. `params.only` limits the levers (`:114`).
- **Scenario compare** (`scenarios/compare/compute.js:14-27` `LEVERS` with get/set/apply; `applyChanges` `:33-50` on a plan copy; `results` `:52`, 400 Monte Carlo paths; `describe` `:95`).
- **Advisor's plan** (`scenarios/advisor-plan/compute.js:10-20`): one assumption at a time, effects ranked.
- **Projection page:**
  - The page shows a "What goes into this" read-only list of every assumption, linked to its page (`retirement/projection/view.js:205-219`).
  - Its hero has an outlined "What would change it ›" link to Goal seek (projection README "Getting to what you can change").

**Cost**, measured with Node 22 on this container (Intel Xeon 2.1 GHz, one thread), median or minimum of repeated runs. On GitHub Pages there is no server, so heavy modules run in the browser's main thread (`core/app.js:176-181`; no `Worker` anywhere). A mid-range Android phone is commonly 2 to 4 times slower at JavaScript; recent iPhones are about the same speed.

| | family (2 working adults, 60 years) | retiredCouple (29 years) | sam (single, 72 years) |
|---|---|---|---|
| one engine run, flat / brackets / brackets + Roth conversions | 0.13 / 0.79 / 3.4 ms | 0.11 / 0.54 / 0.62 ms | — |
| runs inside one "most it could spend" search | 21 | 24 | — |
| `buildInputs` | 4.7 ms | 1.9 ms | 2 ms |
| Will the money last? `compute` | 14 ms | 25 ms | 2 ms |
| Sensitivity, flat / brackets / brackets + Roth conversions | 112 / 569 / 2,168 ms | 27 / 124 / 153 ms | 38 ms |
| Goal seek, flat / brackets / brackets + Roth conversions | 208 / 387 / 977 ms | 4 / 14 / 25 ms | 228 ms |
| Compare (400 paths), flat / brackets / brackets + Roth conversions | 71 / 506 / 1,130 ms | 32 / 69 / 153 ms | 56 ms |
| Stress tests / Advisor's plan / Monte Carlo page | 145 / 54 / 883 ms | 66 / 85 / 365 ms | 22 / 53 / 462 ms |

Retired-couple brackets timings are noisy (two runs each). One lever as "change one input, then find the most it could spend" costs one `buildInputs` (2-5 ms, only for levers that change the plan) plus about 22 engine runs. That is about 5-8 ms in flat mode, about 25 ms in brackets mode and about 80 ms with Roth conversions on this CPU.

## What a levers panel could reuse (no proposal, inventory only)

**Engine and searches:**
- The engine core: `buildInputs` (`projection/compute.js:876`), `copyInputs`, `project`, `affordableSpending` (`core/math/retirement.js:346,88,356`).
- Sensitivity's `measure` / `fromInputs` / `fromPlan` pattern and ranked rows (`sensitivity/compute.js:34-44`).
- Compare's `LEVERS` get/set/apply, `applyChanges` and `describe` (`compare/compute.js:14-50,95`).
- Goal seek's solvers, levers and `only` (`goal-seek/compute.js:14-27,110-240`; levers start at `:129` spending, `:169` saving, `:201` claim age).

**Defaults, guesses and confirmation:**
- `system/assumptions` `ASSUMPTIONS` with `def`, `source` and `changed`, plus `reviewedAt` (`compute.js:9-50`).
- The guesses ledger: `isGuess`/`clearGuess`, overview/guesses `rowOf` (`compute.js:170`) and `coverage.js` (which inputs are guesses vs defaults).
- The projection's "What goes into this" list (`view.js:205-219`).

**Pay, saving and match:**
- Match and pay maths: `matchAt`, `matchDollars`, `fullMatchAt`, `taxSaved`, `paycheckChange` (`career/benefits/compute.js:34-48,74,153`).
- The left-over: Next best action `spare` (`compute.js:146-164`) and `core/math/leftover.js` (`leftOverOf`, `yearSaving`).
- Contribution limits for a "save more" cap: `limitsFor`, `catchUpFor` (`contributions/compute.js:32-58`).

**Social Security and health wording:**
- Social Security `claimFactor` and `estimateBenefit` (`social-security/compute.js:31,144`).
- `healthAdded` and `healthSummary` wording (`projection/compute.js:1098,1208`).
