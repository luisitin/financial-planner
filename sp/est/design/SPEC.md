# Smart guesses: the build spec

Final spec, 2026-11-02. It is written for the builder who owns `overview/setup` (claude-b) and for anyone who adopts it
later. The owner's request: a layperson can open the app and get through it. Any box they cannot answer shows a
figure that is real-world data, worked out from what the plan already knows. With nothing known it shows the most
likely figure for the population, and every answer they add makes the next guesses sharper.

**How this spec was put together**
- **Architecture and commit order:** `design-eng.md`, the base all three judges picked.
- **Estimator rules, formulas and answer keys:** `design-stats.md`, corrected here.
- **Screens and wording:** `design-ux.md`, corrected here.

Every must-not-ship item the judges raised is resolved in 1.3, and every gap they found in 1.4.

**Where the figures come from.** The reference scripts that worked out this spec's figures are in
`$SP/est/design/spec-tools/`:
- `proto3.mjs`: the spending model and the persona rows.
- `proto2.mjs`: mortgage, insurance and prices.
- `share.cjs` and `env.mjs`: the survey shares and the household envelope.

The balance, contribution, car-loan and home-value figures come from design-stats' own prototype,
`design/tools/proto.mjs` (output in `design/tools/proto-out.json`). Run each script with the `est/data` folder (and
the repo for proto2/proto3) as arguments.

**The three example households** are invented; they come from the walkthroughs and are used as test answer keys:
- **S (Sam):** 24, single, Texas, $48,000 salary, renting.
  - Typed: a car-loan payment of $420, a card balance of $3,000, checking $1,200 and savings $800.
  - Left blank: the 401(k) (through work), the car's value and all spending.
- **J (Jordan):** 41, single parent of two children aged 7 and 3, Ohio, $58,000 salary, owns a home.
  - Typed: a $1,100 mortgage payment and $900 of daycare.
  - Left blank: everything else.
- **N (Pat and Lee):** 61 and 59, married, Arizona, pay $85,000 and $40,000, no children.
  - Typed: home $450,000, $500,000 in Pat's 401(k) box (meant as both of theirs), cash $28,000, mortgage payment $1,600.
  - Left blank: the mortgage balance and rate, Lee's 401(k), all contributions and the match, and all spending.

---

## 0. The decisions in one screen

1. **One rule for the person.**
   - A grey figure in an empty box is exactly what the plan counts if the box stays empty. An empty box with no grey
     figure counts as nothing.
   - No example values sit in boxes. A labelled example goes in the help line ("For example, 4,000").
   - What the person types always wins and is never moved.
2. **A guess is an ordinary value plus one ledger entry.**
   - The number goes where a typed number would go, and `plan.guesses[path] = { k, v, u, s, at, d }` records it.
   - The field counts as a guess only while its value still equals `v`. The comparison is per unit: rates within 1e-9,
     money within $0.005.
   - All 271 cross-module computes, the PC server and other builders' pages read real numbers with no change.
3. **Fresh on write, never on read.**
   - `settle` runs inside `store.update`, after the page's change, wrapped in try/catch. It refreshes the guesses
     nobody has touched, in tier order.
   - It never creates a guess.
   - It never runs on load, adopt, replace, resolve or another tab's save, so opening the app writes nothing.
   - Old setup flags (`rateGuessed`, `paymentGuessed`, `ssWrote`, `retireAuto`, cushion) are read through adapters and
     stay frozen until the person accepts a one-time "Better guesses" card.
4. **Where things live.**
   - Estimators are pure functions exported from a `compute.js`.
   - The core set and the sourced compact tables live in a new module, `modules/overview/guesses/`.
   - `core/estimate/` is plumbing only: it holds no data and imports no module.
   - Any module, including the other builder's, can add estimators in its own files.
5. **Statistics.** All of the following is set out in section 2.2 and section 7.
   - **Balances and prices** use the median.
   - **Spending rows** use narrow-cell survey means, expressed as shares of the plan's own after-income-tax income.
   - **Combining tables:** an anchor times one income-adjusted ratio per independent axis, interpolated so a guess never
     jumps.
   - **The total** is the sum of the rows, and one sourced household spending envelope shares the rows out.
   - **Whether something exists** is never invented: the hurdle rule decides.
   - **Loans** combine a payment identity with population priors.
   - **Typed figures** get a typo check, and one value-of-information tap is allowed per screen.
   - **Non-U.S. plans** get no U.S. figures.
6. **Verdicts that rest on guesses wait.**
   - A tile whose figure rests mostly on guesses shows the figure, in calm grey, with "by our guesses", and gives no
     green, amber or red.
   - Stage 1 ships with the spending guesses. Stage 2 names the guess that decides the verdict.
   - A dollar range is printed only when every spread in it is measured.
7. **One place to see and fix them:** the "Our guesses for you" page. The done screen shows "Our guesses for now".
   Plans made before this change get two opt-in cards: "Fill in what you skipped" and "Better guesses".
8. **Ten commits, in order of impact** (section 15): plumbing and data, debts, spending, retirement saving, the
   questions and the reveal, the form kit and the other pages, existing plans and bank files, verdict ranges,
   calculator previews and coverage, plain words.

---

## 1. Base, grafts, and every flaw fixed

### 1.1 The base

The architecture comes from design-eng:
- the ledger and settle inside `store.update`;
- no change to `emptyPlan()` or `migrate()`;
- adapters for the old flags;
- estimators exported from `compute.js`;
- an import rule that prevents cycles;
- `values[key] = null` plus `meta.guessed` in `ui.form`;
- `planSummary` tags;
- the invariance tests;
- the ten-commit plan.

### 1.2 Grafts

- **From design-stats:**
  - the statistic per kind of field;
  - the hurdle rule;
  - anchor times ratios (R1, R2, R3), with its validation (3.0% median error for state × age);
  - interpolation, so bins have no cliffs (R6);
  - splitting a couple's figure by pay (R7);
  - the total as the sum of the rows (R8);
  - the typo check (R9);
  - precision weighting with `combineLog`;
  - value-of-information taps;
  - rent as contract rent (gross rent × 0.897);
  - the FHFA existing-loan mortgage rate by state;
  - the $40 card floor;
  - verdicts that wait and the guess that decides;
  - the data build that refuses unsourced or unverified tables;
  - birth years asked on Q1;
  - the persona answer keys (several corrected in 7.H).
- **From design-ux:**
  - the one rule;
  - placeholders rather than pre-filled values;
  - the one global placeholder CSS rule;
  - why-lines of at most 70 characters, with sources in one fold (DESIGN_LOG 2026-09-15 round 17);
  - one basis line per screen for spending;
  - "Sharper if you tell us";
  - % chips and match chips;
  - debts ask the payment first;
  - retirement spending asked only from age 50;
  - the home's value asked once;
  - children's ages asked as "How old?";
  - "Skip: use our guesses";
  - the done-screen order;
  - tile reasons that come from the compute;
  - no amber or red for our own uncertainty;
  - one muted line on records;
  - records instead of a table on the guesses page;
  - "That's about right";
  - the plain-words pass, limited to our own lane.

### 1.3 Must-not-ship items, and what this spec does instead

| from | flaw | resolution | where |
|---|---|---|---|
| stats | calibration backtest on the invented `qa/` households as a pass/fail gate | It runs only as a labelled smoke check in the tester's lane and never fails `npm test`. Real calibration against public microdata is listed for later. | 14.6, 16 |
| stats | `guesses: {}` in `emptyPlan()` while settle deletes the key when it is empty | `guesses` is left out of `emptyPlan()`. It is read as `plan.guesses ?? {}` and deleted when it empties. | 3.1 |
| stats | settle registered only from *enabled* manifests; no try/catch | Settle is registered from every loaded manifest, whatever the per-device page toggles. It is wrapped in try/catch, so a throw keeps the person's change. | 4.6, 4.7 |
| stats | per-box basis lines of about 115 characters with publisher, year, "close/fair/rough" and "$X to $Y" | One why-line of at most 70 characters, with no publisher and no year. Sources sit in one fold on the guesses page. Strength words stay internal and are never shown. | 5.6 |
| stats | a month range ("$670 short to $300 spare") printed from the assumed 0.25 spread | The assumed spread may make a verdict wait, but a dollar range is never printed from it. | 8 |
| stats | childcare guessed for every child | Childcare goes through an existence question, then age buckets. The 3-to-5 bucket priced at the "four-year-old" figure is labelled as an assumption. | 7.A E06 |
| stats | hidden defaults rewired in golden-covered modules (career/benefits match, ACA benchmark, Part D); plan-to 99/97; G11 written silently; G35 raises | None of these is built. They are listed for the owner (17). The under-50 retirement figure is shown on screen before it is written. | 7.G, 10 Q6 |
| ux | rent from ACS gross rent (which includes utilities) plus a separate utilities guess; the "1-bedroom" assumption | Rent is contract rent: the state's all-unit median gross rent × 0.897 × an income and household ratio. No bedroom count is used. | 7.A E01 |
| ux | groceries priced from USDA food plans | Groceries are survey spending (a share of take-home). USDA plans are not used. | 7.A E03 |
| ux | spending capped at "take-home minus a typical saving rate", unsourced | No cap at take-home. A sourced household envelope (survey outlays as a share of after-tax income, by income, household and region) can exceed take-home, so a shortfall still shows. The verdict waits. | 2.2 R10, 8 |
| ux | invented bands (±25%, ±2 points, ×0.5 to ×2) driving the ranking and the verdict flips | Spreads are measured from the table (mean/median), or declared once (spending 0.25, labelled). Rates have no band. | 2.2 R11 |
| ux | geometric mean of one-way cells (Jordan's 401(k) $36,900) | Anchor × income-adjusted ratio: Jordan's 401(k) is about $26,000. | 7.B E12 |
| ux | the childcare example uses one toddler and leaves out the 7-year-old | Both children are priced by age bucket. | 7.A E06 |
| ux | `ui.form` returns the guess as the typed value | `values[key] = null` and `meta.guessed.has(key)`. | 9.3 |
| ux | plain-words rows that edit the other builder's files | Those rows become a WORKBOARD message, not edits. | 13.2 |
| ux | spending guessed even on a screen the person skipped | A guess is written only on a screen the person saw: Continue or "Skip: use our guesses" after the grey figures were shown, or a tap on a card that lists them. | 2.3 S1 |
| ux | tables in `core/estimate/data` (core would import modules) | The tables live in `modules/overview/guesses/data/`. | 6 |
| ux | a `migrate()` change that copies the old flags | No `migrate()` change. Adapters plus an explicit upgrade card. | 3.4, 11.5 |
| ux | the shell's note keyed on manifest `needs` (it would show nearly everywhere) | The note is opt-in through a manifest field, `restsOn`, and needs a "big" guess. | 4.7, 9.5 |
| ux | "guess the state tax rate silently" (claude-a's field) | Not built. The reveal reads `FLAT` from taxes/state. | 10 Done, 16 |
| ux | the heavy ranking on every Dashboard render | It is memoised by `meta.rev` in the view. The Dashboard uses the static weight until the memo matches. | 11.2 |
| ux | the pay guess "from age and state" at Q2 while ages come at Q3 | Birth years move onto Q1. | 10 Q1 |
| eng | spending guesses land before the verdicts wait | The stage 1 "by our guesses" state ships in the same commit as the spending guesses (C3), and for net worth in C2. | 8, 15 |
| eng | the spending cap at "take-home minus payments on file" | Removed. The envelope replaces it (R10); it is not a cap at take-home. | 2.2 R10 |
| eng | "NAIC homeowners and CCAoA tables are not in est/data" | Both are in `spend.json` (364 and 510 rows) and both are bundled. There is no fallback to the survey average. | 6.4 |
| eng | the old-flag adapters silently move the owner's real plan at the next unrelated save | Legacy entries are frozen. Settle never re-estimates them. A one-time card shows old → new and writes nothing until "Use the new guesses" is tapped. Tested on a plan with old flags; CHANGELOG and WORKBOARD lines. | 3.4, 11.5, 14.2 |
| eng | `same()` with one 0.005 tolerance (half a point on a rate) | Tolerance by unit, stored in the entry (`u`). | 4.3 |
| eng | the `d` guard compared against the oldest read date | The guard is per estimate: a fresh estimate whose tables are older than the entry's `d` does not overwrite it. | 4.4 |

### 1.4 Gaps all three missed, and the fix

| gap | fix | where |
|---|---|---|
| spending guesses run high (the survey's low incomes outspend their reported income) | Rows are shares of after-tax income applied to the plan's own after-income-tax income (`ce2023_aftertax_income_by_*`). A household envelope shares the rows out. Persona totals are tested against take-home. The README states the direction of bias. | 7.A, 14.3 |
| mean vs median for lumpy recurring costs | Upkeep uses the AHS aggregate ratio (a mean), labelled "computed from AHS microdata by the research step". Medians stay for balances. | 7.A E01, 7.C |
| old prices aged with the plan's own inflation | They are aged with the published CPI in `modules/retirement/historical/data/returns.js`, up to its last year (2025), never beyond. Changing the plan's inflation setting never moves a guess. | 6.7 |
| mortgage age (refinancing) and a national prior | There is no "year moved in" for the loan age. The loan is worked back from the payment, with a hard upper bound from 30 years. The priors are FHFA state balance per loan (with SCF ratios) or home value × the FHFA state loan-to-value. A tap asks "When did you take out this mortgage, or last refinance it?" | 7.D E21 |
| participation assumed from the 83% headline | Participation by pay and age from `vanguard_has2026_participation_by_income_age`, combined on the log-odds scale. | 7.B E13 |
| partly typed spending outside setup | One question, "Is something missing?", when typed spending is far below the household's guessed total. | 11.6 |
| guesses made at compute time read as facts | Compute outputs gain an additive `estimates: [...]` key. The view says "our estimate" on that figure, and help lines say what blank counts. | 8.4 |
| no coverage check | `modules/overview/guesses/coverage.js` lists all 188 "does not know" inputs from the inventory, with how each is handled. `npm run check` validates it and prints the count. | 6.9 |
| U.S. data on non-U.S. plans | The gate in `estimate()`: currency must be USD, and the person must not have said "I live outside the U.S." | 4.8 |
| `ui.form` puts the grey example "e.g. 7 for 7%" in every percent box | Removed in C6. Percent boxes get a "%" sign inside the box, drawn with inline style like the money sign: no new CSS. | 9.4 |
| existing plans get nothing | A "Fill in what you skipped" card. It shows the guesses first and writes them on one tap. | 11.4 |
| bank files ignored | With two or more full months of categorised outflows, the spending rows come from the person's own bank files. | 7.A R12 |
| unused FHFA balance per loan, loan-to-value and payment | Used in E21 and E22. | 7.D |
| wrong figures not caused by blanks (Medicaid from near-zero income, "type Arizona's rate", the pension form placed first) | The Arizona reveal is fixed in C5. The other two are filed as FEEDBACK items, kept out of this work. | 15 C5, 16 |
| calculator pages not mapped | K3 previews in my lane (goals/house, goals/education, property/rent-vs-buy, career/benefits). Keys are offered to claude-a. | 12, 15 C9 |
| no app-wide check of the one rule | The tester's smoke check: no box shows an example, and a grey figure equals what is saved. Filed for the tester. | 14.6 |
| reports and exports print guesses as facts | `modules/reports/report-kit.js` marks figures from guessed fields "(our guess)". The export carries the ledger. | 15 C8 |
| research notes carry local paths | The data build strips `notes`, keeps only public https URLs and runs the leak guard on its output. | 6.6 |

---

## 2. The rules

### 2.1 What the person sees (P)

- **P1.** A grey figure in an empty box is what the plan uses if the box stays empty.
  - Said once per screen: "Leave a box empty and we'll use the grey figure: what's typical for someone like you."
  - An empty box with no grey figure counts as nothing.
- **P2. Placeholders, not pre-filled values.**
  - Typing replaces the grey figure with no deleting. Clearing a typed figure brings the grey back.
  - A saved guess reopens as the grey figure, never as typed text.
- **P3. Blank never means zero, and a blank box never drops a record the person said exists.** A box with no sourced
  figure stays empty, with "For example, ..." in its help line.
- **P4. "Our guess" is the only label.**
  - One why-line under a box (at most 70 characters after "Our guess: ").
  - One basis line per screen when the rows share a basis (spending).
  - Publisher, table and year sit in one fold on the guesses page.
  - Strength words ("close", "rough") and "median" never appear on screen.
- **P5. "Not sure" is the empty box** for amounts. "Not sure" chips appear only on choices that block Continue.
- **P6. We guess amounts, never possessions or people.** Whether something exists is decided by what the person
  picked, or by one tap (R5).
- **P7. Calm about our own uncertainty.**
  - A guess never turns a figure green, amber or red by itself.
  - A verdict that rests mostly on guesses waits and says so in grey (section 8).
  - A page whose main figure rests on a big guess says so in one muted line.
- **P8. One place:** "Our guesses for you" (`#/overview/guesses`). Every guess still in use is there, with a box to type
  the real figure and "That's about right" to keep ours.
- **P9. Ask less.**
  - No retirement-spending question under 50.
  - The home's value is asked once.
  - Debts ask the payment first.
  - Saving at work is asked as % of pay.
  - At most one sharpening tap per screen, plus at most two "does this exist" taps, each with "Not sure".
- **P10. Every save confirms itself.** When guesses moved with an answer, the green notice adds "2 of our guesses
  moved with it." (`takeSettled`).

### 2.2 Statistics (R)

**R1. The statistic for each kind of field.**

| kind of field | statistic |
|---|---|
| balance, price, pay, loan amount | median of the narrowest published cell |
| spending row | mean of narrow cells, as a share of after-tax income (rows must add up) |
| rate | the published average |
| choice | the mode |
| age or year | the median, interpolated within its bins |
| upkeep and other lumpy costs that add up over years | the mean (the total converges to it) |

**R2. Anchor × ratios.** The guess is the anchor cell (the most specific table that holds the strongest known
predictors) times one ratio per other known axis:

```
guess = m(anchor, known cell) × Π_d r_d
r_d = [m(T_d, level)/m(T_d, all)] / [g(I_d(level))/g(I_d(all))]
```

- The ratio is income-adjusted: `g` is the item's own income curve and `I_d(level)` the group's typical income.
- Use one ratio per independent axis: household type, place, and tenure (housing rows only).
- An unknown axis gives ratio 1.
- Validation: state × age household income gives a 3.0% median error (design-stats, `validateStateAge`).

**R3. Interpolation.** Buckets are interpolated on log scales between bucket middles and held flat outside the end
buckets. A $1 change never makes a guess jump.

**R4. Precision weighting.** Two independent log-normal estimates combine as
`ln v = Σ(ln v_i / s_i²) / Σ(1/s_i²)`, `s = (Σ 1/s_i²)^-½` (`combineLog`).

**R5. Hurdle rule** for whether something exists, from p = the share of people like this who have it:
- p < 0.35: assume none, write nothing; a hint may give the typical figure.
- 0.35 ≤ p ≤ 0.65: one yes/no tap with "Not sure". Not sure takes the likelier side.
- p > 0.65: assume yes.
- When p comes from several one-way tables, combine them on the log-odds scale with an income-adjusted age term
  (`logitCombine`).
- With no published p at all (childcare): always ask.

**R6. Spread.**
- Measured: `σ = sqrt(2 ln(mean/median))` from the same table cell.
- Carried through chains: `σ² = σ_own² + Σ (e_i σ_i)²` (`propagate`, `elasticity`).
- Declared where not measured: survey spending 0.25 (labelled in the README). Rates have no spread.
- `measured: false` spreads may make a verdict wait. They are never printed as a range.

**R7. Couples.** Prefer a per-person table. A household figure is split across the adults in proportion to their
pay. One partner's typed figure never moves the other's guess.

**R8. Totals are sums.** The spending total is the sum of the rows, never a separate estimate.

**R9. Typo check.**
- Fires when `|ln(typed/guess)|/σ > 2.33` and a common slip (percent typed as dollars, a year as a month, an extra or
  missing zero) maps the typed figure inside the guess's middle half (`|z| ≤ 0.674`).
- One inline question with two buttons. The form holds once (the "kept" convention).
- It replaces the setup's under-$15,000 pay check, keeping that check's words.

**R10. Household spending envelope.** Households already paying a lot for home, childcare and loans spend less on
everything else.

```
envelope = sQ_env(a) × r_comp,env × r_region,env × a / 12
CE outlays = totalExpenditures − personalInsuranceAndPensions − cashContributions − education + mortgage principal
```

- The envelope's share is survey outlays as a share of after-tax income (the formula above), from
  `ce2025_spend_by_*` and `ce2025_profile_by_*` with the 2023 after-tax ratio. It uses the same anchor-and-ratio
  machinery as the rows.
- **Flexible rows** (utilities, groceries, car and transit, insurance and health, eating out, shopping) are scaled by
  `k = clamp((envelope − typed rows − loan and card payments − guessed housing) / guessed flexible rows, 0.5, 1)`.
  - The 0.5 bound is declared in the README.
  - Housing, childcare and typed rows are never scaled.
- **It is not a cap at take-home.** The envelope is a survey figure and can exceed take-home (one-parent households
  at Jordan's income: 103% of after-tax income), so a shortfall still shows.

**R11. Rounding by strength** (`roundGuess`):
- Monthly and yearly flows: $10 under $1,000, else $50. When σ > 0.5 and the spread is measured: 2 significant figures.
- Balances: 3 significant figures when σ ≤ 0.15, else 2.
- Rates: 0.1 point.
- Ages and years: whole numbers.

**R12. The person's own data beats the population.** With at least two full calendar months of categorised outflows
in `transactions`, a spending row is the person's monthly average for its categories (7.A). The why-line says "your
bank files, last N months".

### 2.3 Storage (S)

- **S1. Who creates a guess.** Only a page that saves a box the person saw with its grey figure creates one:
  Continue, Save, or "Skip: use our guesses" after the figures were drawn, or a tap on a card that lists them.
  `markGuess` and `saveField` are the only writers.
- **S2. Still a guess?** A field is a guess while `same(value, v, u)`. Any typed value, equal or not, ends it
  (`saveField` clears it).
- **S3. What settle does.** It refreshes untouched entries in tier order, inside the person's own change. It never
  creates an entry, never writes a field whose value differs from `v`, and is idempotent.
- **S4. Removed records.** When the record is gone, its entry goes. When the last entry goes, `plan.guesses` is
  deleted.
- **S5. Legacy flags.** They keep their meaning and keep being written (mirrored). They are read as frozen guesses
  and never re-estimated by settle.
- **S6. Unknown estimator key** (the code that made it was removed): the entry stays frozen and listed first on the
  guesses page with "Type the real figure".
- **S7. The `d` guard.** A fresh estimate whose `dataAsOf` is older than the entry's `d` is not written (an older app
  on another phone never puts old figures back).
- **S8. Scenarios** (`scenarios/compare`) apply levers to a copy of the plan and do not settle it.
- **S9. The PC server** never settles. It computes on the plan the device sends, which already holds the guessed values.

---

## 3. Data model

### 3.1 `plan.guesses`

```js
guesses: {
  "accounts[setup-owe-mortgage].balance": { k: "debt.mortgage.owed", v: 111000, u: "total", s: 0.73, at: "2026-11-02", d: "2026-11-02" },
  "debts[setup-debt-mortgage].rate":       { k: "debt.mortgage.rate", v: 0.046,  u: "rate",  s: null, at: "2026-11-02", d: "2026-11-02" },
  "expenses[setup-x-groceries].amount":    { k: "spend.groceries",    v: 550,    u: "month", s: 0.25, at: "2026-11-02", d: "2026-11-02" },
}
```

`guesses` is optional:
- it is not in `emptyPlan()`;
- it is read as `plan.guesses ?? {}`;
- it is deleted when it empties.

So a plan whose guesses were all typed over has exactly the shape of a plan that never had any.

### 3.2 The entry

| key | meaning |
|---|---|
| `k` | estimator key. `"<topic>.<name>"` for overview/guesses (`spend.groceries`); `"<group>/<id>:<name>"` for one a module adds (`overview/setup:ss`) |
| `v` | the value written, already rounded (number) |
| `u` | unit: `month` `year` `total` `rate` `age` `year-date`; decides the tolerance in `same()` |
| `s` | σ on the log scale, or `null` (rates, unmeasured) |
| `at` | the day `v` last changed (unchanged when the same value is written again, so the setup's `wouldChange` stays false) |
| `d` | the read date of the tables behind this estimate (its `dataAsOf`) |

### 3.3 Paths

```
path    := segment ("." segment)*
segment := name | name "[" id "]"
```

- `name[id]` is the item of array `name` with `id === id`.
- Ids come from `ui.uid()` or the setup's own ids (`setup-...`). Neither contains `.`, `[` or `]`; `parsePath` throws if
  one does.
- A plain `name` walks an object key (`retirement.spendingMonthly`,
  `retirement.socialSecurity.setup-self.monthlyAtFRA`).
- `getAt` returns `undefined` when anything on the way is missing.
- `setAt` never creates a missing record or key: it returns `false`. Callers create the record first.
- **One spelling:** `debts[<accountId>]` is rewritten to `debts[<debt row id>]` by `canonical()` before it is stored.
  Reads accept both.

### 3.4 Legacy flags (read through adapters, frozen)

| today | read as | key | mirrored when the ledger writes the same path |
|---|---|---|---|
| `debts[i].rateGuessed` | `debts[<id>].rate`, unit rate | `debt.<kind>.rate` (kind from the setup id, else the account type) | `markGuess` sets `rateGuessed`; `clearGuess` deletes it |
| `debts[i].paymentGuessed` | `debts[<id>].minPayment`, unit month | `debt.<kind>.payment` | same, with `paymentGuessed` |
| `guide.setup.ssWrote[pid]` | `retirement.socialSecurity.<pid>.monthlyAtFRA` | `overview/setup:ss` | `ssWrote[pid]` kept equal |
| `guide.setup.retireAuto === true` | `retirement.spendingMonthly` | `overview/setup:retireSpend` | `retireAuto` kept true |
| `guide.setup.cushionTarget`, `cushionFunds` | `goals[setup-goal-cushion].target`, `.fundedBy` | `overview/setup:cushionTarget`, `:cushionFunds` | both kept equal |

- `guessesInUse()` returns ledger entries plus the legacy synthetic entries, each with `legacy: true`. The ledger wins
  on a shared path.
- Settle skips legacy entries entirely (S5), so the owner's current plan never moves on its own.
- The "Better guesses" card (11.5) lists every legacy entry whose new estimate differs from its value. "Use the new
  guesses" calls `markGuess` for each: the ledger entry is written and the flag is mirrored. "Keep the old ones"
  stores the choice, and the card does not return.
- The existing readers keep working untouched: `journeys.js detailed()`, `standing().guessed`, `revealWords` and the
  household/people person removal.

### 3.5 New optional fields (no version bump)

| field | meaning |
|---|---|
| `guide.setup.taps` | `{ [key]: value }`: one-tap answers on Get started that the estimators read. Keys: `health-cover` (`work`/`own`/`public`/`unsure`), `childcare` (`yes`/`no`/`unsure`), `hoa` (`yes`/`no`/`unsure`), `mortgage-start` (`pre2010`/`2010s`/`2020-21`/`2022on`/`unsure`), `car-loan-start` (`0`/`1-2`/`3-4`/`5+`/`unsure`), `retire-joint` (`{ pid, total }` when "both of ours"), `pay-mode-<pid>` (`gross`/`take-home`), `take-home-<pid>` (`{ amount, period }`), `escrow` (`yes`/`no`/`unsure`) |
| `guide.setup.outsideUS` | `true`: the person said they live outside the U.S.; no U.S. figure is used anywhere |
| `guide.guessesLookedAt` | `"YYYY-MM-DD"`: "These look fine" on the guesses page (the Dashboard step "Look over our guesses") |
| `guide.guessUpgrade` | `{ at, choice: "new" \| "kept" }`: the answer to the one-time "Better guesses" card |
| `guide.fillSkipped` | `{ at, choice: "used" \| "later" }`: the answer to "Fill in what you skipped" |

### 3.6 `docs/DATA_MODEL.md` text (same commit as the code, C1)

A new row, placed after `whatIfs`:

> | `guesses` | `{ [path]: { k, v, u, s, at, d } }` -- figures the plan filled in where a box was left blank. `path`
> names the field (`accounts[<id>].balance`, `debts[<id>].rate`, `expenses[<id>].amount`, `retirement.spendingMonthly`;
> grammar in core/estimate/paths.js), `k` the estimator (modules/overview/guesses README), `v` the value written
> (rounded), `u` its unit (month, year, total, rate, age, year-date), `s` its spread on the log scale (null = not
> measured), `at` the day `v` last changed, `d` the read date of the tables behind it. The field itself holds an
> ordinary value every page reads; it is a guess only while it still equals `v` (rates within 1e-9, money within half
> a cent). Written only when a person saves a box they saw blank with our grey figure (`markGuess` / `saveField`);
> refreshed inside each change while untouched (`settle`, core/store.js); dropped when typed over, confirmed ("That's
> about right") or when its record is removed. Older guesses stay where they were and are read the same way, frozen
> until the person takes the new ones: `debts[].rateGuessed` / `paymentGuessed`, `guide.setup.ssWrote`, `retireAuto`,
> `cushionTarget` / `cushionFunds`. Optional (not in `emptyPlan()`, read as `plan.guesses ?? {}`, removed when empty);
> added 2026-11-xx | overview/guesses |

Two more edits in the same commit:
- **The `debts` row:** append "(read as guesses by core/estimate `guessAt`)".
- **The `guide` row:** append, inside `setup?`: "`taps` (one-tap answers the guesses read: health-cover, childcare,
  hoa, mortgage-start, car-loan-start, retire-joint, pay-mode-<id>, take-home-<id>, escrow), `outsideUS` (no U.S.
  figures)". Then add: "`guessesLookedAt?`, `guessUpgrade?: { at, choice }`, `fillSkipped?: { at, choice }` (overview/guesses)".

### 3.7 `migrate()`

Nothing changes:
- `SCHEMA_VERSION` stays 1;
- `emptyPlan()` is unchanged;
- the back-fill loop never adds `guesses`;
- `ownersToIds` is untouched.

Folding the legacy flags into the ledger is optional later work (v2), done only after nothing reads them (16).

---

## 4. The core API

### 4.1 Files

| file | holds | imports |
|---|---|---|
| `core/estimate/paths.js` | `parsePath`, `getAt`, `setAt`, `canonical`, `pathOf` | nothing |
| `core/estimate/ledger.js` | `TOLERANCE`, `same`, `guessAt`, `isGuess`, `guessesInUse`, `guessesTouching`, `markGuess`, `clearGuess`, `confirmGuess`, `saveField`, `LEGACY` adapters | paths.js |
| `core/estimate/engine.js` | `applies`, `estimate`, `settle`, `rangeOf`, `checkEstimators` | ledger.js, paths.js, `../math/estimate.js` |
| `core/estimate/index.js` | re-exports; the only import path for pages | the three above |
| `core/math/estimate.js` | `interpLinear`, `interpLog`, `sigmaFromMeanMedian`, `middleHalf`, `combineLog`, `propagate`, `elasticity`, `logitCombine`, `hurdle`, `typoCheck`, `roundGuess` | nothing |
| `core/store.js` | `settleWith(fn)`, `takeSettled()`; one call in `update()` | unchanged |
| `core/app.js` | merge the manifests' `estimators`; register settle; `ctx.guess`; the opt-in grey note; the "guesses moved" notice | core/estimate |
| `core/ai.js` | `planSummary` adds "(our guess)" after guessed figures | core/estimate |

Everything in `core/estimate/` and `core/math/estimate.js` is pure and dependency-free, and imports in Node.

### 4.2 `paths.js`

```js
export function parsePath(path)            // -> [{ name, id? }]; throws Error("bad guess path: ...") on a malformed path or an id with . [ ]
export function getAt(plan, path)          // -> value | undefined
export function setAt(draft, path, value)  // -> true | false (false: a record or key on the way is missing; nothing created)
export function canonical(plan, path)      // "debts[<accountId>].x" -> "debts[<debt id>].x"; anything else unchanged
export const pathOf = (list, id, field) => `${list}[${id}].${field}`;
```

### 4.3 `ledger.js`

```js
export const TOLERANCE = { rate: 1e-9, month: 0.005, year: 0.005, total: 0.005, age: 0, "year-date": 0 };
export function same(a, b, unit)              // numbers: |a-b| <= TOLERANCE[unit] (default 0); strings: ===; else JSON equality
export function guessAt(plan, path)           // -> { path, k, v, u, s, at, d, legacy? } | null  (only while same(getAt(plan,path), v, u))
export function isGuess(plan, path)           // -> boolean
export function guessesInUse(plan)            // -> entries still in use: ledger + legacy (legacy: true), ledger wins on a shared path
export function guessesTouching(plan, sections, { weights } = {})  // entries whose first path segment is in `sections`; `weights` = { [k]: "big"|"small" } to filter
/** Write a guess: the field and its entry. Idempotent: the same k and v -> nothing changes (`at` kept). Mirrors legacy flags. */
export function markGuess(draft, path, est, today)       // est: Estimate (5.1); -> boolean changed
/** The person typed it, confirmed it, or removed it: drop the entry and the mirrored flag; the value stays. */
export function clearGuess(draft, path)                   // -> boolean changed
export const confirmGuess = clearGuess;                    // "That's about right"
/** The one call a page makes when it saves a box that may hold a guess. */
export function saveField(draft, path, read, est, today)
//   read = { value: number|null, guessed: boolean }   (ui.form meta, or a setup box)
//   guessed && est          -> markGuess(draft, path, est, today)
//   !guessed && value!==null -> setAt(draft, path, value); clearGuess(draft, path)   (typed: theirs, even if equal)
//   !guessed && value===null -> setAt(draft, path, null);  clearGuess(draft, path)   (cleared, no guess: as today)
export const LEGACY = [/* { match(plan) -> [{ path, k, v, u }], mirror(draft, path, value | undefined) } for the five rows of 3.4 */];
```

Settle and the guesses page never compare with a global tolerance: they always pass the entry's `u`.
`rateIsGuess` and `paymentIsGuess` in setup stay exactly as they are (1e-9 and 0.005).

### 4.4 `engine.js`

```js
/** U.S. figures apply: currency USD (absent = the emptyPlan default "USD") and not guide.setup.outsideUS. */
export function applies(plan)                 // -> boolean
/**
 * One estimate. estimators: the merged registry. opts: { today, path?, rec?, args?, memo? } -- args = what is on the
 * screen and not saved yet (so the grey preview equals what saving the blank box writes); memo = a Map shared by one
 * pass (the profile, the household spending plan). Returns null unless applies(plan) and the estimator returns a finite
 * value with tables (each a known table id), dataAsOf and why. Rounds with roundGuess unless the estimator says rounded.
 */
export function estimate(plan, key, { estimators, today, ...opts })   // -> Estimate | null
/**
 * Refresh untouched guesses inside a draft (store.update). Never creates. Legacy entries are skipped.
 */
export function settle(draft, { estimators, today })
//   -> { changed: [{ path, k, from, to }], dropped: [{ path, k, why: "typed" | "gone" }] }
/**
 * A verdict's range when guessed inputs move to their middle-half ends. moves: [{ paths: [path...], factorLow, factorHigh }]
 * (guessed spending rows move together as one group). fn(plan) -> number. Works on structuredClone copies; never settles.
 */
export function rangeOf(fn, plan, moves)      // -> { low, mid, high, decisive: index into moves }
/** For tests and check.mjs: every estimator has tier, order, label, unit, weight; reads only earlier tiers; no duplicate key. */
export function checkEstimators(estimators)   // -> [problem strings]
```

**`settle`, exactly:**

```
led = draft.guesses; if (!led || no keys) return { changed: [], dropped: [] }        // O(1) for every plan today
for tier of [1, 2, 3, 4, 5]:                                                          // 5 = unknown keys (frozen)
  memo = new Map()                                                                    // the profile is rebuilt after each tier
  for [path, e] of entries of led whose estimator tier is `tier`, by estimator order then path:
    cur = getAt(draft, path)
    if cur === undefined:            delete led[path]; LEGACY mirror clear; dropped.push({ path, k: e.k, why: "gone" }); continue
    if !same(cur, e.v, e.u):         delete led[path]; mirror clear;        dropped.push({ path, k: e.k, why: "typed" }); continue
    if !estimators[e.k]:             continue                                           // S6
    est = estimate(draft, e.k, { estimators, today, path, memo })
    if !est:                         continue                                           // the gate closed or an input went: frozen, still labelled
    if est.dataAsOf < e.d:           continue                                           // S7, per estimate
    if same(est.value, e.v, e.u):    continue
    setAt(draft, path, est.value); led[path] = { ...e, v: est.value, s: est.sigma ?? null, at: today, d: est.dataAsOf }
    mirror(draft, path, est.value); changed.push({ path, k: e.k, from: e.v, to: est.value })
if no keys left: delete draft.guesses
return { changed, dropped }
```

Each of these properties is a test (14.1):
- settle never creates an entry;
- it never writes a field whose value differs from its entry's `v`;
- settling twice is the same as settling once;
- a single pass reaches the fixed point;
- it returns the same draft object it was given;
- legacy entries are untouched.

### 4.5 `core/math/estimate.js`

```js
export function interpLinear(points, x)                  // points [[x, y]] sorted; flat outside the ends
export function interpLog(points, x)                     // log x, log y; flat outside the ends (R3)
export const sigmaFromMeanMedian = (mean, median) => (mean > median && median > 0 ? Math.sqrt(2 * Math.log(mean / median)) : null);
export const middleHalf = (v, s) => [v * Math.exp(-0.674 * s), v * Math.exp(0.674 * s)];
export function combineLog(a, b)                         // { value, sigma } x2 -> { value, sigma }  (R4)
export function propagate(sigmaOwn, parts)               // parts [{ elasticity, sigma }] -> sigma
export function elasticity(f, x, h = 0.1)                // [ln f(x e^h) - ln f(x e^-h)] / 2h
export function logitCombine(pAll, terms)                // terms: [p_level...] (each one-way share) -> p, log-odds additive
export const hurdle = (p) => (p < 0.35 ? "skip" : p > 0.65 ? "assume" : "ask");
export function typoCheck(typed, est, slips)             // slips: [{ id, map: (t) => t', words }] -> null | { slip, value, words } (R9)
export function roundGuess(value, unit, sigma, measured) // R11
```

### 4.6 The store hook (`core/store.js`)

```js
let settleFn = null, settled = null;
export const store = {
  // ...
  /** Register the function that refreshes guesses inside every update (core/app.js does it once at boot). */
  settleWith(fn) { settleFn = typeof fn === "function" ? fn : null; },
  /** What the last update's settle changed, once: { changed, dropped } | null. */
  takeSettled() { const s = settled; settled = null; return s; },
  update(mutator) {
    otherTab();
    const next = structuredClone(plan);
    mutator(next);
    if (settleFn) { try { settled = settleFn(next); } catch (e) { settled = null; console.error("[store] settle failed", e); } }
    plan = touch(next);
    keepHere(plan);
    notify();
    this.scheduleSave();
  },
};
```

`load`, `adopt`, `replace`, `resolve`, `resync` and `otherTab` never call it. Add these lines to the header comment:
`store.settleWith(fn)` and `store.takeSettled()`.

### 4.7 The shell (`core/app.js`)

```js
// after loadModules(), before store.load()
const ESTIMATORS = {}, WEIGHTS = {};
for (const m of modules.values()) for (const [k, e] of Object.entries(m.estimators ?? {})) {   // every loaded manifest, toggles ignored
  if (ESTIMATORS[k]) { console.error(`[planner] estimator ${k} is defined twice (${m.group}/${m.id})`); continue; }
  ESTIMATORS[k] = e; WEIGHTS[k] = e.weight ?? "small";
}
store.settleWith((d) => settle(d, { estimators: ESTIMATORS, today: fmt.today() }));
// makeCtx: one field
guess: (key, opts = {}) => estimate(store.get(), key, { estimators: ESTIMATORS, today: fmt.today(), ...opts }),
```

**The grey note.** In `show()`, above `<div data-page>`, where the guide frame goes, for a manifest that declares
`restsOn: [sections]`:
- `const big = guessesTouching(plan, m.restsOn, { weights: WEIGHTS }).filter((e) => WEIGHTS[e.k] === "big")`.
- When `big.length`, draw `ui.guessNote(labels of the two biggest + "and N more")` (9.5).
- No note on overview/setup or overview/guesses.

**The notice.** After each `store.update` the shell reads `store.takeSettled()`. When `changed.length` is above zero
it appends to the page's green notice, or to the shell's bottom copy of it, " N of our guesses moved with it."

### 4.8 The gate (`applies`)

- `estimate()` returns `null` for every key when `plan.meta.currency` is set and is not `"USD"`, or when
  `guide.setup.outsideUS` is true.
- **A blank state with USD is allowed:** estimators use their national row and add "your state" to `sharperWith`.
  This is the owner's "with no inputs, estimate from the population info we have".
- Q1's state list gains a last option, "I live outside the U.S.". It sets `outsideUS: true` and leaves
  `household.state` as "".
- Test: the EUR household in `qa/households/14-unusual-structures` and `qa/fixtures/european-bank.csv` imports get no
  guess anywhere.

### 4.9 `tools/check.mjs` additions

- **Purity grep:** the same pattern as for `compute.js`, extended to `core/estimate/*.js`, `core/math/*.js` and
  `modules/*/*/estimators/*.js`.
- **The estimator registry:** import every `modules/*/*/compute.js` and merge its `estimators`. Fail on
  `checkEstimators()` problems or a duplicate key.
- **Coverage** (6.9): fail on a malformed entry or an unknown key, and print
  "guess coverage: N of 188 unknown inputs handled (M later)".

---

## 5. The estimator contract

### 5.1 The Estimate

```js
/** @typedef Estimate
 *  key         "spend.groceries"
 *  value       550                          rounded (R11) unless the estimator rounded it
 *  unit        "month" | "year" | "total" | "rate" | "age" | "year-date"
 *  sigma       0.25 | null                  log-scale spread
 *  measured    false                        sigma comes from the table (true) or is declared (false)
 *  low, high   null | numbers               middle half; only when measured
 *  why         "typical for a parent of two in Ohio on your pay"   <= 70 chars, the words after "Our guess: "
 *  uses        { pay: "typed", state: "typed", household: "typed", tenure: "typed" }   "typed" | "guess" | "worked out"
 *  sharperWith [{ label: "your rent", href: "#/overview/setup/spend" }]
 *  tables      ["ce2025_spend_by_incomeQuintile", ...]     every id must exist in the bundled data
 *  dataAsOf    "2026-11-02"                 newest readOn of `tables`
 *  weight      "big" | "small"              big: can move a headline figure by $100 a month or a verdict (static)
 *  ask?        { key, kind: "hurdle" | "voi" | "split", question, options: [{ value, label }] }   a tap to show; value may be null
 */
```

### 5.2 What a module exports

```js
// in any module's compute.js (pure); the manifest re-exports it: import { compute, estimators } from "./compute.js"; export default { ..., estimators }
export const estimators = {
  "debt.mortgage.owed": {
    tier: 2, order: 24, label: "Mortgage still owed", unit: "total", weight: "big",
    page: () => "#/balance/liabilities",                         // where the real figure is typed
    reads: ["home.value", "home.propertyTax", "home.insurance", "debt.mortgage.rate"],   // earlier keys only (checked)
    fn(plan, opts, lib) { /* -> Estimate without `key` | null */ },
  },
};
// lib = { estimate(key, opts) (earlier keys only), memo(name, make) (per pass), today, applies }
```

### 5.3 Tiers and order

| tier | what | keys, in order |
|---|---|---|
| T1 | pay | `pay.gross`, `pay.fromTakeHome` |
| T2 | owned and owed | `home.value`, `home.propertyTax`, `home.insurance`, `debt.mortgage.rate`, `debt.mortgage.owed`, `debt.mortgage.payment`, `debt.car-loan.rate`, `debt.car-loan.owed`, `debt.car-loan.payment`, `debt.credit.rate`, `debt.credit.owed`, `debt.credit.payment`, `debt.student.rate`, `debt.student.owed`, `debt.student.payment`, `debt.loan.rate`, `debt.loan.owed`, `debt.loan.payment`, `account.retire.balance`, `account.retire.split`, `account.ira.balance`, `account.invest.balance`, `account.cash`, `account.car.value` |
| T3 | spending | `spend.housing`, `spend.utilities`, `spend.groceries`, `spend.transport`, `spend.insurance`, `spend.childcare`, `spend.dining`, `spend.shopping`, `spend.missing` (11.6) |
| T4 | saving and retirement | `contrib.amount`, `contrib.match`, `overview/setup:ss`, `overview/setup:retireSpend`, `overview/setup:cushionTarget`, `overview/setup:cushionFunds`, `goal.home.target`, `goals/education:target` |

A T3 estimator reads only typed figures and T1-T2 values. Take-home for spending is worked out with typed retirement
contributions only, because guessed contributions are T4.

### 5.4 The profile (memoised per tier: `lib.memo("profile", () => profileOf(plan, today))`)

```js
profileOf(plan, today) -> {
  today, year, applies,
  adults: [{ id, role, age, pay, payHow: "typed"|"guess"|"worked out"|null, paySigma, works, retired, ownBusiness }],
  kids: [{ id, age }], size,
  hh: "singlePersonAndOther" | "oneParentChildUnder18" | "marriedCoupleOnly" | "marriedCoupleOldestChildUnder6" | "marriedCoupleOldestChild6to17" | "marriedCoupleOldestChild18plus",
  state, region,               // region from data/index.js STATE_REGION (Census regions), null when state blank
  tenure: "renter" | "ownerWithMortgage" | "ownerWithoutMortgage",
  grossPay, a, aHow,            // a = household after-income-tax income a year (7.0)
  has: { checking, savings, retire, invest, home, car }, owes: { credit, "car-loan", student, mortgage, loan },
  typedSpend: { [row]: monthly }, loanPayments, bank: { months, byRow } | null,
}
```

**How the household type (`hh`) is chosen:**

| household | `hh` |
|---|---|
| one adult, no child | `singlePersonAndOther` |
| one adult with a child under 18 | `oneParentChildUnder18` |
| two adults (spouse or partner), no child | `marriedCoupleOnly` |
| two adults, oldest child under 6 | `marriedCoupleOldestChildUnder6` |
| two adults, oldest child 6-17 | `marriedCoupleOldestChild6to17` |
| two adults, oldest dependent 18 or older | `marriedCoupleOldestChild18plus` |

- The survey has no unmarried-couple column; married-couple cells are the closest pattern (README).
- **Tenure:**
  - a mortgage picked or held: owner with a mortgage;
  - a home and no mortgage: owner without one;
  - otherwise: renter.

### 5.5 Rounding

`roundGuess` (R11). Rows are rounded first, then totals are summed from the rounded rows. The screen, the plan and
the "Got it" line always agree.

### 5.6 Why-lines

**The rules:**
- At most 70 characters after "Our guess: ", in plain words.
- They name the answers used: "for one person in Texas", "on your pay", "worked back from your $420 payment".
- No publisher, no year, no statistics words.
- A guessed predictor is named as one: "on our pay guess".
- The figure itself is in the box. For screen readers the box's `aria-label` ends ", blank uses our guess of about
  $1,200".

**Patterns:**

| pattern | example (characters after "Our guess: ") |
|---|---|
| typical | "typical rent before utilities for one person in Texas on your pay" (65) |
| worked back | "worked back from your $420 payment, about halfway through a usual loan" (70) |
| average | "the average rate on cards that charge interest" (46) |
| state average | "the average on Ohio mortgages people already have" (50) |
| split | "your $500,000 split by pay" (27) |
| bank | "your bank files, last 3 months" (31) |
| sum | "the rows above, added up" (25) |

**The spending screen basis line** (one per screen, replacing the per-box lines): "The grey figures are what a
household like yours usually spends: one adult renting in Texas on about $48,000 a year."

### 5.7 `sharperWith`

Each estimator lists the missing inputs that would change it most, at most two, each with a link to the box that
asks it. The labels are:
- "your state"
- "your pay"
- "your rent"
- "when you took out the mortgage"
- "when you got the car loan"
- "what the home cost and when"
- "your bank files"
- "how you get health cover"

The guesses page and the done screen show "Sharper if you tell us: your rent ›".

### 5.8 Taps (`ask`)

An estimator in the hurdle "ask" band returns `{ value: null, ask }` until the tap is answered. An estimator whose
guess is rough (σ > 0.5) and has a listed value-of-information tap returns its value plus `ask`.

- **Where taps appear:** the view shows at most one `voi` tap per screen (the one with the largest `sigma`) and at
  most two `hurdle` taps.
- **Where answers go:** `guide.setup.taps[key]` (3.5). Outside setup, a hurdle answer is a typed fact on that page
  (for example, Home's HOA fee box gets 0 typed when the answer is No).

### 5.9 Typo slips (R9)

| slip | applies to | typed → meaning | words |
|---|---|---|---|
| `pct-of-pay` | contributions (month) | t ≤ 100 → t% × pay/12 | "Did you mean 5% of your pay, about $240 a month?" |
| `year-as-month` | spending rows, rent, payments | t → t/12 | "$15,000 a month? Did you mean $15,000 a year ($1,250 a month)?" |
| `extra-zero` / `missing-zero` | balances, rows | t → t/10 or t×10 | "$4,000? Most people like you have about $400." |
| `pay-low` | pay (year) | the setup's existing check | its existing words |

---

## 6. The guesses module and the data files

### 6.1 Files: `modules/overview/guesses/`

| file | contents |
|---|---|
| `module.js` | `id: "guesses"`, `group: "overview"`, `title: "Our guesses for you"`, `icon: "🧮"`, `order: 3.6`, `status: "usable"`, `version: 1`, `heavy: true`, `needs: ["*"]`, `writes: ["guesses", "accounts", "debts", "expenses", "income", "retirement", "goals", "guide"]`, `estimators` (from compute.js), `purpose: "The figures the plan guessed for you, the ones that matter most first. Type the real ones when you have them."`, `aliases: ["guesses", "estimates", "typical figures"]` |
| `compute.js` | re-exports `estimators` from `estimators/*.js`; `profileOf`; `compute(plan, params)` for the page: `{ rows, top, count, sources, offers: { fill: [...], upgrade: [...] } }` (11.2-11.5) |
| `estimators/spend.js`, `saving.js`, `home.js`, `debts.js`, `pay.js`, `goals.js` | the estimator objects by topic |
| `data/index.js` | `READ_ON` per file, `NEWEST_READ`, `STATE_REGION` (Census regions, source line), `STATES` |
| `data/spend.js`, `balances.js`, `pay.js`, `debts.js`, `home.js`, `health.js`, `retire.js` | compact tables (6.3, 6.4) |
| `coverage.js` | 6.9 |
| `view.js` | the page (11.2) |
| `README.md` | every formula with its tables and conditioning order; R1-R12; tiers; the ledger rules; the declared constants (spending σ 0.25, envelope bound 0.5, Not sure = the likelier side, 3-5-year-olds priced at the "four-year-old" figure, married-couple cells for partners); the direction of bias (7.A); sources with read dates; which sources are industry (Vanguard, Experian, KFF, NAR, LIMRA) and which are research-derived (SCF income cut-offs, EIA gas bill, AHS ratios, FHFA balance per loan) |
| `module.test.mjs` | 14.3 |

### 6.2 The import rule (a test reads the import graph)

**`modules/overview/guesses/compute.js` and its `estimators/*.js` may import:**
- `core/*`;
- their own `data/`;
- other modules' `data/*.js`: `modules/taxes/federal/data/federal.js`,
  `modules/retirement/social-security/data/ssa.js`, `modules/retirement/historical/data/returns.js`;
- these computes, read-only: `core/math/tax.js`, `modules/taxes/state/compute.js` (exports `FLAT`, `NO_WAGE_TAX` and
  `flatTax`: claude-a's file, imported and never edited), and `modules/cashflow/expenses/compute.js` (`CATEGORIES`).

**What the test checks:**
- No file reachable from `guesses/compute.js` imports `guesses/compute.js`.
- `guesses/compute.js` imports no `overview/*` compute.
- Setup's apply functions take `guess` as a parameter, so setup's compute does not need to import guesses.
- `setup/compute.js` may import `guesses/compute.js` (for `standing()`'s top-3 list). That is allowed because nothing
  guesses imports reaches setup.

### 6.3 The data file format

```js
// modules/overview/guesses/data/spend.js
// GENERATED by tools/build-guess-data.mjs from vendor/guess-data/spend.json (read 2026-11-02). Do not edit; change the
// build's SELECT list and rebuild. Formulas: ../README.md.
export const READ_ON = "2026-11-02";
export const T = {
  ce2025_spend_by_incomeQuintile: {
    title: "Average yearly spending by category, by income fifth",
    publisher: "U.S. Bureau of Labor Statistics, Consumer Expenditure Surveys",
    table: "Table 1101. Quintiles of income before taxes ... 2025",
    url: "https://www.bls.gov/cex/tables/calendar-year/mean-item-share-average-standard-error/cu-income-quintiles-before-taxes-2025.xlsx",
    vintage: "2025 data, released 2026", readOn: "2026-11-02",
    stat: "mean", unit: "dollars a year per household", dollarsOf: 2025, industry: false, derived: false,
    by: "incomeQuintile", cols: ["all", "lowest20", "second20", "third20", "fourth20", "highest20"],
    rows: { foodAtHome: [6491, 3600, 5079, 6002, 7504, 10308], /* only the items an estimator reads */ },
  },
};
export const DERIVED = { /* constants the build works out, each { value, from: [table ids], how } */ };
```

- **Values:** exactly as published, never rounded or inflated at build time.
- **Layout:** columnar. A state table's `cols` is `STATES`.
- **Each table carries:** `derived: true` for research-step derivations, and `industry: true` for industry sources.

### 6.4 The SELECT list: which research tables become which compact tables

All are read 2026-11-02 from `est/data/*.json`. The build copies them to `vendor/guess-data/` (git-ignored) and lists
them in `vendor/sources.json`.

| compact file | table id (kept as is) | kept | publisher / vintage |
|---|---|---|---|
| spend.js | `ce2025_spend_by_incomeQuintile`, `_by_householdComposition`, `_by_region`, `_by_housingTenure`, `_by_ageOfReferencePerson` | items: foodAtHome, housekeepingSupplies, utilities, electricity, naturalGas, fuelOilOtherFuels, telephoneServices, rentedDwellings, gasolineAndOtherFuels, vehicleMaintenanceRepairs, vehicleRentalLeasesLicensesOther, vehicleInsurance, publicAndOtherTransportation, healthcare, medicalServices, drugs, medicalSupplies, lifeAndOtherPersonalInsurance, foodAwayFromHome, entertainment, alcoholicBeverages, apparelAndServices, personalCare, furnishingsAndEquipment, reading, tobacco, miscellaneous, otherHouseholdExpenses, totalExpenditures, personalInsuranceAndPensions, cashContributions, education | BLS CE, 2025 data released 2026 |
| spend.js | `ce2025_profile_by_*` (same five) | incomeBeforeTaxesMean, pctRenter, mortgagePrincipalPaid, persons | BLS CE 2025 |
| spend.js | `ce2023_aftertax_income_by_incomeQuintile`, `_by_region`, `_by_ageOfReferencePerson` | incomeBeforeTaxesMean, incomeAfterTaxesMean | BLS CE 2023 (newest year with after-tax income; listed on the research's unverified list as the reason for the substitution) |
| spend.js | `acs2025_median_gross_rent_by_state` | value by state + US | Census ACS 2025 1-year |
| spend.js | `eia2025_residential_electric_bill_by_state`; `eia2024_residential_natural_gas_bill_by_state_DERIVED` (derived) | value | EIA 2025; EIA 2024 (derived from price, deliveries, customers) |
| spend.js | `naic2023_auto_insurance_by_state` | 2023 averageExpenditure, states + US | NAIC 2023 |
| spend.js | `naic2023_homeowners_premium_by_state` | HO-3 by state + US | NAIC 2023 |
| spend.js | `ccaoa2025_childcare_annual_price_by_state` | center and homeBased × infant, toddler, fourYearOld, beforeAfterSchool | Child Care Aware of America 2025 |
| spend.js | `ndcp2022_childcare_weekly_price_by_state`, `ndcp_childcare_weekly_price_fallback_older_years` | the cells CCAoA lacks | DOL Women's Bureau NDCP 2022 |
| balances.js | `scf2025_median_value_if_held`, `scf2025_mean_value_if_held` | items retirementAccounts, transactionAccounts, pooledInvestmentFunds, stocksDirectlyHeld, vehicles, primaryResidence, mortgageOnPrimaryResidence, vehicleLoans, creditCardBalances, educationLoans, otherInstallmentLoans; groupBy all, age, incomePercentile | Federal Reserve SCF 2025 |
| balances.js | `scf2025_family_income` (age, all: median), `scf2025_pct_families_holding` (same items), `scf2025_actual_income_percentile_cutoffs_derived` (derived) | | SCF 2025; research-derived cut-offs |
| balances.js | `vanguard_has2026_401k_balance_by_age` (all, age, income; median and average) | | Vanguard How America Saves 2026 (industry) |
| pay.js | `acs_median_earnings_by_state` (full-time both sexes, all earners), `cps_ftyr_income_by_age5` (median, mean), `cps_median_earnings_by_age` | | Census ACS 2025; CPS ASEC 2026 |
| pay.js | `vanguard_has2026_headline`, `_deferral_by_income_age`, `_participation_by_income_age`, `_top_match_formulas`, `_deferral_distribution` | | Vanguard 2026 (industry) |
| debts.js | `cc_apr_fed_g19` (latest "accounts assessed interest"), `auto_personal_rate_fed_g19` (latest new car 72-month, personal 24-month) | | Federal Reserve G.19, Aug 2026 |
| debts.js | `mortgage_outstanding_fhfa_by_state_2026q2` (rate, loan-to-value, payment incl. escrow, UPB, loans), `mortgage_outstanding_fhfa_national` (2026Q2 rate by loan count), `mortgage_new_purchase_fhfa_by_state_2025` (rate, LTV, term), `mortgage_rate_pmms_weekly_2026` (latest 30-year) | | FHFA NMDB 2026Q2, 2025; Freddie Mac PMMS |
| debts.js | `student_loan_rates_federal`, `card_minimum_payment_rule_cfpb`, `auto_loan_terms_experian_q2_2026`, `auto_rate_by_credit_tier_experian_q2_2026` | | Education; CFPB; Experian Q2 2026 (industry) |
| home.js | `acs2025_median_home_value_by_state_and_mortgage_status`, `acs2025_median_home_value_by_state`, `acs2025_effective_property_tax_rate_by_state` (median method), `acs2025_hoa_condo_fee_by_state`, `acs2025_year_moved_in_by_age_us`, `acs2025_median_year_moved_in_by_state`, `acs2025_homeownership_by_age_us` | | Census ACS 2025 |
| home.js | `fhfa_hpi_at_state_annual` (years 1990-2025) | | FHFA HPI |
| home.js | `ahs2023_routine_maintenance_spending` (aggregate ratio by year built, mean) | derived from the AHS 2023 public-use file by the research step | Census/HUD AHS 2023 |
| health.js | `kff_ehbs2026_premiums` (worker contribution single and family, all firms), `kff_aca_benchmark_premium_40yo`, `cms_aca_age_rating_curve`, `cms_medicare_2026_parts_ab` (Part B standard), `cms_medicare_part_d_parameters` (base premium), `kff_medigap_average_premium_2025` (Plan G) | | KFF 2026 (industry); CMS 2026 |
| retire.js | `ssa_snapshot_2026_09_average_benefit`, `ssa_retired_worker_benefit_by_age_sex_2025` | | SSA |

**Never bundled:**
- every entry on any file's `unverified` list;
- `usda_food_plans_*` (a recommended diet, not spending);
- Fannie Mae's maintenance rule (it stays advice on Home);
- the LIMRA, ACLI and NCS life/disability tables (no estimator uses them yet).

**Size:** about 30 tables and 4,500 numbers, roughly 45 KB of JS (about 11 KB gzipped).

### 6.5 Derived constants (`DERIVED`, recomputed in tests from `T`)

| constant | what | value / from | test |
|---|---|---|---|
| `contractShare` | renters' contract rent as a share of rent plus utilities (without phones), `ce2025_spend_by_housingTenure` renter | 17,495 / (17,495 + 3,174 − 1,165) = 0.897 | recompute |
| `taxRatio2023` | after-tax / before-tax income per fifth, 2023 | 0.997, 0.937, 0.896, 0.798 | recompute |
| `energyShare` | electricity + natural gas + fuel oil, as a share of CE utilities (all) | 0.523 | recompute |
| `vehicleInsShare` | vehicleInsurance, as a share of the transport row (all) | 0.269 | recompute |
| `perLoanByState` | FHFA unpaid balance per loan = UPB × 1e9 / (loans × 1e3) | Ohio $156,814; Arizona $250,538; Texas $223,570 | recompute |
| `upkeepRatio` | AHS aggregate maintenance / aggregate value (all owners and by year built) | 0.293% (all) | equals the published cell |
| `scfMortgageMedianToMean` | 185,000 / 241,300 | 0.767 | recompute |
| `deferralMedianToMean` | Vanguard median / average deferral | 6.6 / 7.6 = 0.868 | recompute |

### 6.6 `tools/build-guess-data.mjs`

1. Read `vendor/guess-data/*.json`. Exit 1 with a list when any SELECT table is missing, or lacks `source.publisher`,
   `source.url`, `source.vintage` or a read date.
2. Refuse any table id on that file's `unverified` list, and any id in the never-bundled list above.
3. Keep only the SELECT rows and fields. Drop `notes` and every field not listed. Keep `url` only when it starts with
   `https://`.
4. Write `data/*.js` columnar, with the header comment, plus `DERIVED`.
5. Run `tools/leak-guard.mjs` on the written files. Exit 1 when it objects.
6. Print one line per table: rows kept, bytes.

### 6.7 Prices: aging old dollars

**How flows are brought to today:**
- A flow published in year `y` dollars (NAIC 2023, AHS 2023, NDCP 2022) is brought to the newest year of the published
  CPI: `× Π (1 + inflation_t)` for t = y+1 ... last year in `modules/retirement/historical/data/returns.js`
  (Damodaran/BLS CPI, 1928-2025). From 2023: ×1.057.
- It is never aged beyond that year, and never with `assumptions.inflation`. The README says "in 2025 prices".
- **Survey shares (CE) are ratios to income** and need no aging: the plan's own income is today's.
- **Balances are not aged.** The README says "end of 2025".

### 6.8 Refreshing

- Each file's header names the next release ("CE 2026: September 2027").
- A yearly data commit rebuilds them. Settle then moves untouched guesses at the person's next change, and the `d`
  guard keeps older apps from putting old figures back.
- A test fails when any `readOn` is later than the test's fixed today.
- `system/diagnostics` shows "guess tables to refresh" when the newest `readOn` is more than 400 days old.

### 6.9 The coverage file

```js
// modules/overview/guesses/coverage.js -- every input the 2026-11-02 inventory marked "a layperson does not know this"
export const COVERAGE = [
  { page: "overview/setup", path: "accounts[setup-have-retire-*].balance", label: "Saved so far", how: "guess:account.retire.balance" },
  { page: "taxes/state", path: "taxes.state.rate", label: "Or your rate", how: "other-builder" },
  { page: "property/home", path: "property[].maintenance", label: "Upkeep", how: "fallback:1% of value a year (Fannie Mae's rule of thumb), said in the help line" },
  { page: "goals/travel", path: "events[].flightPerPerson", label: "Flights per person", how: "example" },
  // ... 188 rows, generated once from est/inventory-a.json + inventory-b.json (page, path, label only) and then hand-kept
];
// how: "guess:<key>" | "compute:<where the blank is worked out>" | "fallback:<what blank counts>" | "example" | "ask" | "other-builder" | "later:C<n>"
```

`npm run check` fails when:
- a `guess:` key is not in the merged registry;
- a row has no `how`;
- a row is still `later:` after its commit's tag. Each commit removes its own `later:` rows.

It prints the count of rows handled.

---

## 7. The estimator catalogue

**How to read it.** Each entry gives:
- the key and the field path;
- the tier and the weight;
- the formula and the tables;
- the conditioning order (the first known item wins; each unknown drops to the next);
- the why-line, after "Our guess: ";
- the sharpers;
- worked examples (S, J, N).

**Shared names:**
- `a`: the household's after-income-tax income a year (7.0);
- `sQ_r(a)`: the share curve of row r, from the income fifths;
- `r_hh`, `r_reg`, `r_ten`: income-adjusted ratios for household type, region and tenure, in share space;
- `cpi(y)`: 6.7.

### 7.0 Take-home for spending (`a`)

- **Pay:** `grossPay` = the sum of the adults' salary and business income lines. Use typed pay, else the T1 guess,
  with its σ carried.
- **`a` = grossPay − federal income tax − state income tax.**
  - Federal: `core/math/tax.js federalTax` with the plan's filing status, children under 17, and typed pre-tax
    contributions only. Refundable credits included.
  - State, flat-rate (`FLAT` from taxes/state): its rule.
  - State with no wage tax (`NO_WAGE_TAX`): 0.
  - State with a graduated tax: `taxes.state.rate × grossPay` when that rate was typed. Otherwise
    `a = grossPay × taxRatio2023(grossPay)` (the survey's average combined income tax, interpolated), labelled.
- **Business income:** income tax only (self-employment tax is an outlay like FICA and is not in the envelope).
- **Examples:** S $44,420 (federal $3,580, Texas $0); J $57,813 (federal −$1,075 with refundable credits, Ohio flat
  2.75% above $26,050: $791); N $112,040.

### 7.A Spending (T3): the biggest wrong figure today

**The share model for flexible rows r** (utilities, groceries, car and transit, insurance and health, eating out,
shopping):
- `share_r = sQ_r(a) × r_hh,r × r_reg,r`, then `guess_r = k × share_r × a / 12`.
- k is the R10 envelope factor.
- `sQ_r(a)` is the log-log interpolation of `items_r(fifth) / A(fifth)` over the second to fifth fifths, held flat
  outside. The lowest fifth is left out (retirees spending savings).
- `A(cell) = incomeBeforeTaxesMean_2025(cell) × after/before_2023(cell)`. Cells with no 2023 after-tax column use
  `taxRatio2023` interpolated at their before-tax income.
- **Ratios:** `r_d(cell) = [share_r(cell)/share_r(all)] / [sQ_r(A(cell))/sQ_r(A(all))]`.
- **Unknowns:** an unknown income uses the household-type table's own share at that type's income (integrating income
  out). An unknown household type or region gives ratio 1.

**Bias, stated in the README and tested (14.3).**
- The survey's lower-income and one-parent cells report spending above their after-tax income (the second fifth
  spends $51,405 on $46,080 of pre-tax income; one-parent outlays are 103% of after-tax income).
- So spending guesses lean high for households under about $60,000 after tax. Left-over guesses lean low.
- The envelope and the waiting verdict (section 8) contain it. Nothing hides it.

**R12, the person's own bank files.**
- When `transactions` hold at least two full calendar months between the first and last import day
  (`imports[].from/to`), each row becomes the monthly average of its outflows over those months.
  - Categories map to rows through each setup row's `covers`, with the Expenses `CATEGORIES`.
  - Transfers and categories `debt` and `savings` are excluded.
  - Uncategorised outflows go to "Shopping and everything else".
- `sigma` is declared as 0.15. The why-line is "your bank files, last N months". The population envelope is not
  applied to these rows.

#### E01 `spend.housing`: rent, or home costs besides the mortgage

- **Path:** `expenses[setup-x-housing].amount` (month). Weight: big.
- **Renters:** `ACS median gross rent(state) × contractShare (0.897) × rentRatio`.
  - `rentRatio = [interp(rentShare, a) × a] / rentPerRenter(all) × r_hh,rent`.
  - The rent share uses rent per renter: `rentedDwellings / pctRenter`. There is no region ratio, because the state
    anchor is local.
  - Tables: `acs2025_median_gross_rent_by_state`, `ce2025_spend_by_housingTenure`, `ce2025_spend_by_incomeQuintile`,
    `ce2025_profile_by_incomeQuintile`, `ce2025_spend_by_householdComposition`.
  - Conditioning: state, then pay, then household. With no state: the U.S. median ($1,557).
  - Why: "typical rent before utilities for one person in Texas on your pay".
  - Sharper: your state, your pay.
  - **S:** 1,515 × 0.897 × 0.867 × 1.038 = **$1,200**.
- **Owners:** `HOA (hurdle) + upkeep + (property tax E23 + home insurance E24 only when there is no mortgage, or the
  escrow tap is No)`.
  - **HOA:** p = the state's share paying. Under 35%: skip. Between 35 and 65%: tap. Above 65%: the state median fee
    (with or without a mortgage).
  - **Upkeep:** `home value × upkeepRatio (by year built when known, else all owners 0.293%) × cpi(2023) / 12`. This
    is a mean, because it adds up over years (1.4). With no home value: the AHS mean $1,363 × cpi(2023) / 12.
  - Tables: `acs2025_hoa_condo_fee_by_state`, `ahs2023_routine_maintenance_spending`, plus E23 and E24.
  - Why: "upkeep owners usually spend on a home like yours" (Ohio adds "; few Ohio owners pay an HOA fee").
  - **J:** HOA skipped (17.8%); 210,000 × 0.293% × 1.057 / 12 = **$50**.
  - **N:** Arizona 48.8% means the tap "Do you pay an HOA or condo fee?" (Not sure = No, since 48.8% is under 50%);
    upkeep **$120**.

#### E02 `spend.utilities`

- **Path:** `expenses[setup-x-utilities].amount`.
- **Formula:** `sQ × r_hh × r_ten × (1 + energyShare × (EIA state electric+gas / U.S. − 1)) × a / 12 × k`. The state
  energy term replaces the region ratio.
- **Tables:** `ce2025_spend_by_*` utilities, `eia2025_residential_electric_bill_by_state`,
  `eia2024_residential_natural_gas_bill_by_state_DERIVED`.
- **Why:** "power, water, internet and phones for a renter living alone in Texas".
- **Values:** S $227 raw → **$170** (k 0.764); J **$460**; N **$560**.

#### E03 `spend.groceries`

- **Path:** `expenses[setup-x-groceries].amount`. Items: foodAtHome and housekeepingSupplies.
- **Why:** "what a household like yours usually spends on food and supplies" (or the screen's basis line).
- **Values:** S **$240**; J **$550**; N **$780**.

#### E04 `spend.transport`

- **Path:** `expenses[setup-x-transport].amount`.
- **Items:** gasoline, maintenance and repairs, rental/leases/licences, vehicle insurance, public transport. Purchases
  and loan interest are left out: loans are on What you owe.
- **Insurance:** the insurance part (vehicleInsShare 0.269) is scaled by NAIC state average expenditure / U.S.
  (Texas $1,428.94, Ohio $947.22, Arizona $1,344.24, U.S. countrywide $1,281).
- **Why:** "gas, repairs, insurance and fares for a household like yours in Texas".
- **Values:** S **$300**; J **$470**; N **$960**.

#### E05 `spend.insurance`: insurance and health

- **Path:** `expenses[setup-x-insurance].amount`. Weight: big.
- **Hurdle tap** `health-cover`, asked once on Q6: "How do you get health cover?" Through work / On my own or the
  Marketplace / Medicaid or Medicare / Not sure.
- **The row by answer:**

| answer | the row is |
|---|---|
| Through work | KFF worker contribution (single $139 a month when one adult is covered, else family $623) + the out-of-pocket share (medicalServices, drugs, medicalSupplies) × r_hh × r_reg |
| Medicare (65+) | per person 65+: Part B standard $202.90 + Part D base $38.99 + the state's Medigap Plan G average + out-of-pocket |
| Medicaid | out-of-pocket only |
| On my own, Not sure, or unasked | the CE share for healthcare + life insurance × r_hh × r_reg (it averages every kind of cover). The README says the Marketplace price before help is not used, because the help depends on income (retirement/healthcare works that out) |

- **Why:** "health cover and medicine, typical for a household like yours".
- **Values (Not sure):** S **$260**; J **$340**; N **$910**. Through work: S = $139 + $90 = **$230**; J = $623 + $120 =
  **$740** (this is the tap that decides Jordan's month, 8.2).

#### E06 `spend.childcare`

- **Path:** `expenses[setup-x-childcare].amount`. Shown only with children under 13.
- **Hurdle:** always asked (no published share paying): "Do you pay for childcare or after-school care?" Yes / No /
  Not sure. No and Not sure write nothing.
- **Formula, on Yes:** `Σ children of CCAoA(state, center, bucket) / 12`.
  - Buckets: under 1 infant; 1-2 toddler; 3-5 "fourYearOld"; 6-12 beforeAfterSchool; 13+ none.
  - Pricing 3- and 5-year-olds with the four-year-old figure is a declared assumption (Child Care Aware defines no
    ages).
  - Missing states fall back to NDCP 2022 × cpi(2022).
  - These prices are 2025 prices and are not aged.
- **Why:** "full-time center care in Ohio for a 3-year-old, after school for a 7".
- **J:** typed $900, so no guess. Blank with Yes: (10,552 + 6,162) / 12 = **$1,390**. Her typed $900 passes the typo
  check.

#### E07 `spend.dining`

- **Items:** foodAwayFromHome, entertainment, alcoholicBeverages.
- **Values:** S **$230**; J **$470**; N **$1,000**.

#### E08 `spend.shopping`

- **Items:** apparel, personal care, furnishings, reading, tobacco, miscellaneous, other household expenses (education
  and gifts to charity are left out: they have goal pages).
- **Values:** S **$290**; J **$660**; N **$930**.

#### E09 The total

There is no estimator for the total. The "One rough total" tile's grey figure is the sum of the rounded rows
(S $2,690, J $3,000 + typed $900, N $5,260). Left blank, it saves the rows as guesses, not a total.

#### E10 `spend.missing` (11.6)

Not a field. It flags a typed spending list that sits far below the household's guessed total.

### 7.B Retirement saving and balances (T2, T4)

#### E12 `account.retire.balance`

- **Path:** `accounts[setup-have-retire-<pid>].balance`. Weight: big.
- **Formula:** `median_all × [vgInc(pay)/median_all] × [(vgAge(band)/median_all) / (vgInc(cpsFT(age))/median_all)]`.
  `vgInc` is interpolated over the Vanguard pay bands. σ comes from the age band's average and median.
- **Tables:** `vanguard_has2026_401k_balance_by_age`, `cps_ftyr_income_by_age5`.
- **Why:** "typical in a work plan at 41 on your pay".
- **Values:** S **$3,100** (middle half $1,100-$8,600); J **$26,000** ($10,000-$65,000); Lee **$29,000**.

#### E12s `account.retire.split`: a couple's joint figure

- **Trigger:** a couple, one partner's box typed and the other's blank.
- **The tap:** "Is the $500,000 Pat's alone, or both of yours?" Pat's alone / Both of ours.
- **Both of ours:** the total is split by pay (R7) and both are marked with this key. The total goes in
  `taps["retire-joint"]`.
- **N:** 500,000 × 85/125 = **Pat $340,000**, **Lee $160,000**.

#### E13 `contrib.amount` (T4)

- **Path:** `retirement.contributions[setup-contrib-<pid>].amount` (month).
- **Participation:** `logitCombine(83%, [p_income(pay), p_age(band) income-adjusted])` from
  `vanguard_has2026_participation_by_income_age` ("all plans").
  - Under 0.5: "Not putting money in yet", and the box shows an empty grey 0 with why "about half of people your age on
    your pay don't yet".
  - At 0.5 or more: `deferral(age, pay by R2) × 0.868 (median/average) × pay / 12`.
- **Typo check:** `pct-of-pay`.
- **Why:** "people your age on your pay usually put in about 5%".
- **Values:** S p = 0.54, 5.0% → **$200**. J 5.5% → **$270**; her typed "5" asks "Did you mean 5% of your pay, about
  $240 a month?". Pat 8.4% → **$600**; Lee 6.3% → **$210**.

#### E14 `contrib.match` (T4)

- **Path:** `retirement.contributions[...].employerMatch` (yearly).
- **Formula:** `4% × min(1, deferral/6%) × pay`. The 4% is the median promised match value and 6% the median deferral
  needed for all of it (`vanguard_has2026_headline`). In words: the mode, "50% of the first 6%".
- **Why:** "most work plans add about 4% of pay when you put in 6%".
- **Values:** S **$130** a month; J **$180**; Pat **$280**; Lee **$130**.

#### E15 `account.ira.balance` and E16 `account.invest.balance`

- **Formula:** SCF median among holders, by income percentile × age ratio (income-adjusted), with the residual
  clamped at ×0.5 to ×2. Split by pay for couples.
- **Tables:** `scf2025_median_value_if_held`, `scf2025_mean_value_if_held`, `scf2025_family_income`,
  `scf2025_actual_income_percentile_cutoffs_derived`.
- **Why:** "typical for households your age and pay who have one".

#### E17 `account.cash`

- **Path:** `accounts[setup-have-checking|savings].balance`.
- **Formula:** SCF transaction accounts by R2.
  - When only one of checking and savings was picked, it gets all of it.
  - When both are picked and both are blank, it is split evenly. The split is declared: no page counts them
    differently.
  - When one is typed, the other gets `max(0, guess − typed)` if that is $100 or more, else nothing.
  - There is no "a month of pay" rule (unsourced).
- **Why:** "typical bank balance at 41 on your pay".
- **J:** $2,700, split $1,350 / $1,350.

#### E40 `account.car.value`

- **Formula:** SCF vehicles median by R2, divided by the household's vehicles (CE profile).
- **Why:** "what a car is usually worth for people your age and pay".
- **S:** **$12,000**.

### 7.C The home (T2)

#### E18 `home.value`

- **Path:** `accounts[setup-have-home].balance`. Weight: big.
- **Price and year known:** `price × HPI(state, 2025) / HPI(state, year bought)`, a close estimate.
- **Otherwise:** `ACS median value(state, mortgage status) × r_inc (SCF primaryResidence) × r_age (income-adjusted)`.
- **Why:** "typical for an Ohio home with a mortgage, on your pay".
- **J:** 270,800 × 0.742 × 1.047 = **$210,000** (middle half $122,000-$362,000). Bought for $150,000 in 2018:
  × 674.68/402.30 = **$252,000**.

#### E19 Year bought

A K3 preview only, on Home `purchaseDate`: the ACS year moved in by age, shifted by the state's median. J **2016**.
It is never used as the mortgage's age.

#### E23 `home.propertyTax`

- **Path:** `property[<id>].propertyTax` on Home. Also used inside E01, E21 and E22.
- **Formula:** `value × ACS effective rate(state)` (median taxes / median value).
- **Why:** "Ohio homes pay about 1.2% of their value a year".
- **Values:** J **$210** a month; N **$170**.

#### E24 `home.insurance`

- **Path:** `property[<id>].insurance`.
- **Formula:** `NAIC HO-3 average(state) × cpi(2023) / 12`.
- **Why:** "the average Ohio homeowner policy, in 2025 prices".
- **Values:** J **$100**; N **$110**.

### 7.D Loans and cards (T2): debts are never dropped

#### E20 `debt.mortgage.rate`

- **Path:** `debts[setup-debt-mortgage].rate`.
- **Formula:**
  - **Default:** the state's average contract rate on mortgages people already have (FHFA NMDB 2026Q2). U.S.: 4.4%
    (by loan count).
  - **Tap `mortgage-start` = 2022 on:** the state's 2025 new purchase rate (FHFA).
  - No table of rates by year of origin exists, so no other year is claimed.
- **Why:** "the average on Ohio mortgages people already have".
- **Values:** J **4.6%** (was 7.24%); N **4.3%**.

#### E21 `debt.mortgage.owed`

- **Path:** `accounts[setup-owe-mortgage].balance`. Weight: big. The record is never dropped.
- **Payment identity, when the payment is known:**
  - `P&I = payment − escrow`. Escrow is E23 + E24 unless the escrow tap is No; Not sure counts as included.
  - The upper bound is `B_max = pv(rate/12, 360, P&I)`.
  - With the start tap answered: `owed = pv(rate/12, 360 − months since the window's middle, P&I)`, σ 0.15.
    - Middles: pre2010 → 2007-07; 2010s → 2015-07; 2020-21 → 2021-01; 2022on → 2024-01.
- **Priors:**
  - (a) Home value typed: `value × FHFA state average loan-to-value`.
  - (b) Otherwise: `FHFA perLoan(state) × scfMortgageMedianToMean × SCF income ratio × SCF age ratio
    (income-adjusted)`. σ 0.73 (SCF mean/median).
- **Result:** with no tap, `owed = min(prior, B_max)` when a payment is known, else the prior. While σ > 0.5 the VOI
  tap is offered: "When did you take out this mortgage, or last refinance it?" Before 2010 / 2010-2019 / 2020-2021 /
  2022 or later / Not sure.
- **Tables:** `mortgage_outstanding_fhfa_by_state_2026q2`, `mortgage_new_purchase_fhfa_by_state_2025`, `scf2025_*`
  mortgageOnPrimaryResidence, plus E23 and E24.
- **Why:** "worked back from your $1,100 payment at Ohio's usual rate" or "typical for an Ohio mortgage at your age
  and pay".
- **J:**
  - P&I = 1,100 − 214 − 98 = $788; B_max $153,700.
  - Prior (b): 156,814 × 0.767 × (126,445/185,000) × (215,000/185,000)/(159,075/185,000) = **$111,000**, rough.
  - Tap 2010-2019: **$116,000**. Tap 2020-2021: **$138,000**.
- **N:**
  - P&I = 1,600 − 166 − 105 = $1,329; B_max $268,600.
  - Prior (a): 450,000 × 47.6% = **$214,000**, rough.
  - Tap 2010-2019: **$201,000**. Tap 2020-2021: **$240,000**. Tap before 2010: **$136,000**.
  - These supersede design-stats' $170,000, which used year moved in.

#### E22 `debt.mortgage.payment`

- **Path:** `debts[...].minPayment`.
- **Formula:** `pmt(rate/12, monthsLeft, owed) + escrow`. monthsLeft comes from the tap, else 360. Today's 30-year
  level payment on today's balance stays only for plans that have no tap.
- **Why:** "a loan of about $111,000 at 4.6%, plus Ohio's usual tax and insurance".

#### E25 `debt.car-loan.owed`

- **Class:** new or used, whichever class's average payment is nearer in log terms (Experian: new $765, used $542).
- **Formula:** `pv(rate/12, term/2, payment)` (Experian rate and term), σ 0.70. Combined (R4) with SCF vehicle loans
  for age and pay, σ 0.78.
- **VOI tap** `car-loan-start`.
- **Why:** "worked back from your $420 payment, about halfway through a usual loan".
- **S:** **$12,500** (middle half $6,600-$17,000).

#### E26 `debt.car-loan.rate`

- **Values:** used 11.2% (Experian, industry); new 7.17% (G.19). Class as in E25, or from the balance against the
  average amounts financed.
- **Why:** "the average rate on a used-car loan".
- **S:** **11.2%**.

#### E27 `debt.car-loan.payment`

`pmt(rate/12, term/2, owed)`.

#### E28 `debt.credit.rate`

22.36% (G.19, accounts assessed interest, August 2026). Shown as **22.4%**.

#### E29 `debt.credit.payment`

- **Formula:** `max($40, 1% × owed + owed × rate/12)`, never more than the balance (CFPB).
- **S:** 30 + 55.90 = **$86**.

#### E30 `debt.credit.owed`

SCF credit-card balances among holders, by R2. Rough.

#### E31-E32 `debt.student.*`

- **Owed:** SCF education loans by R2.
- **Rate:** the federal undergraduate rate for 2026-27, 6.52%. Earlier years are not in the tables, and the README
  says so.
- **Payment:** the 10-year standard plan (`typicalPayment`).

#### `debt.loan.*`

- **Rate:** personal 24-month 11.9% (G.19).
- **Owed:** SCF otherInstallmentLoans.
- **Payment:** 36 months.

### 7.E Pay (T1)

#### E33 `pay.gross`

- **Path:** `income[setup-pay-<pid>].amount` (period annual). Weight: big.
- **Formula:** `ACS full-time median(state) × CPS full-time median(5-year band) / CPS(all)`. Part-time uses the
  all-earners rows. Self-employed: the same, rough.
- **Why:** "typical full-time pay at 24 in Texas".
- **Sharper:** "your pay" ("Your real pay matters most, so type it if you can.").
- **S, if left blank:** **$35,000** (middle half $23,000-$52,000).
- **Decision for the owner (17):** a blank pay box follows the one rule, so it is counted and marked. To keep pay
  unguessed instead (a preview only), set `PAY_GUESS_STORED = false` in `estimators/pay.js`.

#### E34 `pay.fromTakeHome`

- **Formula:** solve `takeHome(gross) = typed` by bisection, using core/math/tax.js, FICA, the state's flat rule and
  the typed 401(k) share (else 6.6% when a work plan is picked). A close estimate. It is marked, so it follows when the
  401(k) changes.
- **Why:** "worked out from the $1,485 every two weeks that reaches your bank".
- **S:** **about $48,000**.

### 7.F Retirement and goals (T4), the setup's own keys

These are in `modules/overview/setup/compute.js` `estimators`, so they keep their formulas there.

- **`overview/setup:ss`:** `estimateSocialSecurity` (unchanged). Settle now refreshes it when pay or the stop age
  changes, but only for ledger entries; legacy ones wait for the upgrade card.
- **`overview/setup:retireSpend`:**
  - **Under 50:** `retireDefault` (today's rows without childcare, plus loans still running), shown as one line on Q6
    and written.
  - **From 50:** `Σ everyday rows × CE(65-74)/CE(55-64)` for that row (utilities 0.880, groceries 0.953, transport
    0.792, eating out 0.876, shopping 0.859), + home costs that continue (upkeep + E23 + E24) + `loansAfterWork`.
  - Health is never included: health before and after 65 belongs to the retirement projection (in-progress work
    R5-4), so nothing counts twice.
  - **N:** 3,700 + 400 = **$4,100**, plus the $1,600 mortgage while it lasts.
- **`overview/setup:cushionTarget` / `:cushionFunds`:** unchanged formulas (`cushion`). They now see the guessed
  spending.
- **`goals/education:target`:** the Education page's own cost for each child's start year (`COSTS`, `COST_YEAR`). It
  is exported from goals/education's compute, in my lane.
- **`goal.home.target`:** NAR median down payment share × the state's median home value. The why says "the down
  payment only; add closing costs if you know them", because no closing-cost table is bundled.

### 7.G Not built (see also 16)

- G35, raises by age: it changes the projection engine, and the 7.2% is measured only on people who stayed employed.
- G36, a guessed stop age: the default stays 65; only a sentence and a chip are added.
- G38, health after work: R5-4 owns it.
- G39, plan-to 99/97: a planning choice, not a most-likely figure.
- G11 written without being shown.
- The state tax rate.
- The ACA benchmark, Part D and career/benefits defaults (all golden-covered).
- Childcare without the tap.
- G17's month-of-pay rule.

### 7.H Persona answer keys (these become tests; within rounding)

| figure | S | J | N |
|---|---|---|---|
| `a` after income tax | $44,420 | $57,813 | $112,040 |
| household envelope a month | $3,221 | $4,986 | $7,763 |
| envelope factor k | 0.764 | 0.918 | 1.00 |
| housing row | rent $1,200 | home costs $50 | home costs $120 |
| utilities | $170 | $460 | $560 |
| groceries | $240 | $550 | $780 |
| car, gas, transit | $300 | $470 | $960 |
| insurance and health (Not sure) | $260 | $340 | $910 |
| eating out and fun | $230 | $470 | $1,000 |
| shopping and the rest | $290 | $660 | $930 |
| guessed spending total | $2,690 | $3,000 (+ $900 typed) | $5,260 |
| left over, by our guesses (NBA, ±$100) | about $20 spare | about $780 short | about $990 spare |
| verdict | waits | waits | waits |
| mortgage rate / owed | n/a | 4.6% / $111,000 (tap 2010s $116,000) | 4.3% / $214,000 (tap 2010s $201,000) |
| car loan owed / rate | $12,500 / 11.2% | n/a | n/a |
| card rate / payment | 22.4% / $86 | n/a | n/a |
| 401(k) balance | $3,100 | $26,000 | Lee $29,000; joint split Pat $340,000 / Lee $160,000 |
| you put in / match a month | $200 / $130 | $270 / $180 (typed 5 → "5% of pay, about $240?") | Pat $600 / $280; Lee $210 / $130 |
| home value / tax / insurance | n/a | $210,000 / $210 / $100 | typed / $170 / $110 |
| car value | $12,000 | n/a | n/a |
| pay if blank | $35,000 | n/a | Lee $68,000 |
| retirement spending | line only (under 50) | line only | $4,100 + mortgage while it lasts |

The figures were worked out by `spec-tools/proto3.mjs` (spending), `proto2.mjs` (mortgage, insurance, prices) and
design-stats' `tools/proto.mjs` (balances, contributions, car loan, home value). Each test writes its arithmetic in a
comment.

---

## 8. Verdicts that wait

### 8.1 Stage 1 (ships with the guesses that cause it: net worth in C2, spending in C3)

A headline rests on guesses when its compute's additive key says so:
- **Expenses:** `guessedMonthly` and `guessedShare` (the guessed share of spending a month).
- **Next best action:** `spare.guessedShare`, `spare.waits`.
- **Net worth:** `guessedAssets`, `guessedLiabilities`.
- **Liquidity:** `waits`.

`waits = guessedShare ≥ 0.5`, or (stage 2) the range crosses the line.

| tile or headline | when it waits | what it shows |
|---|---|---|
| Left over each month (done screen, Dashboard, NBA) | `spare.waits` | stat value "Depends on your spending". Sub: "With our spending guesses: about $780 short. Type yours ›" (link to the decisive row or the spend screen). Status line "● Our guesses for now", muted (class `calm`). No green or amber. |
| Safety cushion | the must-pay bills are mostly guessed, or (stage 2) the range crosses the target | "About 0.6 months, by our guesses", calm |
| What you own minus what you owe | a guessed liability or asset is 50% or more of either side | the figure, sub "Partly our guesses", status "● Our guesses for now" in place of "A solid base" |
| Retirement | spending or a balance it uses is mostly guessed | the verdict word, sub "Partly our guesses. Type your 401(k) ›". It is never "Short at 65" in amber on guesses alone. |
| Done-screen headline | `spare.waits` | "Your real spending decides whether your month works, so it's the best figure to type next." |
| Next best action dated steps ("Use $1,630 a month") | `spare.waits` | the step stays, but its monthly figure reads "once your spending is in" |

### 8.2 Stage 2 (C8)

**The range.** `rangeOf` runs in the page's own compute behind `params.ranges` (no new math in views), memoised by
`plan.meta.rev` in the view:
- guessed spending rows move together, ×exp(∓0.674 × 0.25);
- each guessed balance or debt moves to its middle-half ends.

**`decisive`** is the move with the largest swing. Its label goes in the sub-line: "Your rent decides it" or "How you
get health cover decides it", with the box or tap.

**Printing.** A range is printed only when every move in it has `measured: true`, for example the cushion with a
guessed bank balance: "Between 0.3 and 2 months, depending on your bank balance (our guess)". Spending-driven ranges
are never printed (judge 1).

### 8.3 Words

Calm and grey. "By our guesses" or "with our spending guesses", never "estimated" pills or "approximately" on every
number.

### 8.4 Estimates made at compute time

Hidden defaults computed at run time, such as federal withholding estimated or retirement spending taken from today's
expenses:
- They gain an additive `estimates: [{ key, what, why }]` in their compute output.
- The view adds "(our estimate)" to that headline only, for example "Owe about $4,020 in April (our estimate: tax held
  back is worked out from your pay)".
- Pages in my lane do it in C8. Claude-a is invited (12.3).

---

## 9. The UI kit (`core/ui/dom.js`, `core/ui/base.css`: the designer's lane; claim in TEAM.md "Now editing")

### 9.1 The one global CSS line (deliberate, minimal, a shared pattern every box needs)

```css
input::placeholder, textarea::placeholder { color: var(--muted); opacity: 1; }   /* grey = counted; contrast 4.8:1 light, 5.5:1 dark */
```

Nothing else is global. The "%" sign in a percent box uses the `.money-in` wrapper and `.money-sign` span with inline
style (`left: auto; right: 12px`; the input gets `paddingRight`), the same way `moneyBox` sets `paddingLeft` inline.

### 9.2 States of a box

| state | the box shows | the line under it | Save does |
|---|---|---|---|
| empty, with a guess | grey figure, formatted like typed text ("1,200"; "4.6" with the %) | "Our guess: <why>." (+ " Type 0 if you have none." when `zeroOk`) | marks the guess (`saveField`, `guessed: true`) |
| empty, with no guess | nothing | what blank means ("Leave it empty if none.") or "For example, 4,000." | saves nothing (null) |
| typed | the typed figure | the field's own help | saves it and removes any mark |
| typed, then cleared | the grey guess again | "Our guess: ..." | marks it; notice "Cleared: we'll use our guess, about $1,200, until you type yours." |
| reopened, still the guess | empty, grey (the page passes `null` when `isGuess`) | "Our guess: ..." | unchanged unless typed |
| typed far outside (R9) | the figure | one inline question with two buttons | holds the form once (`onSubmit` returns `false`) |

Focus clears or selects nothing. Typing the same number as the guess still counts as typed.

### 9.3 The API

```js
/** The help line for a guess. */
export function guessLine(est, { zeroOk = false } = {})   // -> "Our guess: typical rent before utilities for one person in Texas." (+ " Type 0 if you have none.")
/** A percent box: the "%" inside the box on the right (inline style), number pad, stores a fraction. Returns { box, input }. */
export function pctBox({ name, value, min, max, placeholder, label } = {})
/** The value of a percent box as a fraction, or null. */
export const pctValue = (el) => /* "6" -> 0.06, "" -> null, "6%" -> 0.06 */;
/** One muted, tappable row saying a page rests on guesses (a .page-list row: 44 px, chevron, no new CSS). */
export function guessNote(names, { href = "#/overview/guesses" } = {})   // -> <ul class="page-list"><li><a class="muted">Some of this uses our guesses: your spending and your 401(k). ›</a></li></ul>
```

**`ui.form` field schema** gains `guess?: Estimate | null` and `zeroOk?: boolean`.

- **With a `guess` on a money, percent or number field:**
  - the placeholder is the formatted `guess.value` (percent ×100 to one decimal);
  - `required` is ignored;
  - the help is `guessLine(guess)` followed by the field's help;
  - the input's `aria-label` ends ", blank uses our guess of about <value>".
- **`onSubmit(values, meta)`:** `meta = { guessed: Set<key>, guess: { [key]: Estimate } }`. A blank box with a guess
  gives `values[key] = null` and `meta.guessed.has(key) === true`. Pages that ignore `meta` behave exactly as today
  (they save null).
- **Percent fields without a guess:**
  - no placeholder;
  - the box is drawn with `pctBox` (the "%" sign inside);
  - the old `"e.g. 7 for 7%"` placeholder is removed in C6.

The other "e.g." placeholders in my lane's views move to help lines in C6 and C10. Claude-a's go in the WORKBOARD
message.

### 9.4 Records

A record whose figure is a guess gets one muted line in its details, never a pill per number:
- a debt: "Rate and payment are our guesses for now." (with the existing Edit button);
- an account: "Our guess for now: typical for your age and pay.";
- an expense row: "Our guess for now.".

The edit form opens with those boxes empty and grey.

### 9.5 The page note

`ui.guessNote` is drawn by the shell for manifests with `restsOn` (4.7):
- it names the two biggest guesses in plain labels, then "and N more";
- one per page;
- never on Get started or the guesses page;
- never amber, never a notice.

**First pages to opt in (my lane), in C6:**
- overview/dashboard (`restsOn: ["expenses", "accounts", "debts", "income"]`);
- overview/next-best-action;
- balance/liquidity;
- balance/net-worth;
- balance/liabilities;
- cashflow/expenses;
- retirement/projection;
- overview/benchmarks;
- overview/health-score;
- overview/timeline;
- cashflow/forecast.

### 9.6 Wording patterns

| place | words |
|---|---|
| screen line (amount screens) | "Round numbers are fine. Leave a box empty and we'll use the grey figure: what's typical for someone like you." |
| skip on the three amount screens | "Skip: use our guesses" |
| Got it | "Got it: about $2,690 a month. 7 of these are our guesses for now." |
| notice after a save | "Saved. 2 of our guesses moved with it." |
| That's about right | outlined button; notice "Kept: groceries about $550 is now your figure." |
| typed over on the guesses page | "Saved: groceries $420 a month is now your figure." |
| error | "That isn't an amount. Type it in numbers, like 450." |

---

## 10. Get started, question by question (`modules/overview/setup/`: mine)

**General changes:**
- `moneyIn` loses its default `placeholder: "0"` and takes `{ guess }`. The placeholder is the guess, and blank
  returns `{ value: null, guessed: true }`.
- Fixed placeholders go: 65,000, 3,500, 300,000, 60,000, 4,000, 10,000, "e.g. 24.9", "e.g. 6.5", "e.g. A new kitchen".
  The last becomes help: "For example, a new kitchen".
- Each view computes a box's grey figure with `ctx.guess(key, { path, args })`, where `args` holds the screen's unsaved
  answers, and re-runs it on input to the boxes it reads.
- **Apply functions:** `applyHaveAmounts`, `applyOweAmounts`, `applySpend`, `applyAges` and `applyMoney` take a
  4th argument, `{ guess }`.
  - **Without it** (every existing test) they behave exactly as today.
  - **With it** (the view passes `ctx.guess`) a blank box with a guess is written through `markGuess`, and a picked kind
    is never dropped.

**Screen by screen:**

| screen | change | blank / "Not sure" does |
|---|---|---|
| Q1 Who is this plan for? | Adds "Year you were born" next to each adult's name, and "How old?" (a number) for each child when children > 0. The state list ends with "I live outside the U.S." | A blank year: nothing; every age-based guess drops to the all-ages row and lists "your age" as a sharper. A blank child age: no childcare price for that child. "Outside the U.S.": no guesses anywhere (4.8). |
| Q2 What comes in | The pay box shows E33 grey. A two-way switch, "Before tax" / "What reaches my bank", shows the other figure live ("about $4,000 before tax", E34). The under-$15,000 check becomes R9 `pay-low` with its words. | Blank after "I work": E33 is written and marked (owner switch 17). Take-home typed: E34 is written and marked as worked out. |
| Q3 Ages, stopping work, Social Security | The birth year is shown from Q1 ("Born 1985 · Change"); the month stays optional. When the stop age is before full retirement age: "Social Security pays in full from 67. From 65 to 67 the plan pays your costs from savings." plus a chip "67 (full Social Security)". The SS estimate is marked (`overview/setup:ss`), so it follows pay. | As today. |
| Q4 What do you have | Unchanged | |
| Q4b About how much | The screen line from 9.6. Every box shows its guess: E12, E15, E16, E17, E18 home (asked here only), E40 car. "Where" gets "Not sure", counted as Through work. "You put in" becomes chips "None · 3% · 5% · 6% · 10% · Other · Not sure", with the dollars live under them ("6% of pay is $290 a month"); "$ a month instead" opens a money box (stored as `amount` monthly; the chip kept in `guide.setup` for Back). "Your employer adds" becomes chips "Not sure (about 4%) · No match · I know it" (I know it opens a money box). The couple tap (E12s). The typo check. | A picked retirement tile always makes the account. Blank balance, contribution and match: E12, E13, E14 are marked. "None" writes 0, typed. "No match" writes 0, typed. |
| Q5 What do you owe | Unchanged | |
| Q5b Each debt | Order: Paid a month ("It's on your bank statement"), then Still owed, then Interest rate a year. Screen line: "Start with what you pay a month. Leave the rest empty and we'll work it out." The rate box's grey figure is the guess (E20, E26, E28). The mortgage shows the home value from 4b as a line ("Your home: about $210,000, from question 4 · Change"); the "What would your home sell for" box stays only when 4b did not ask it (`askHomeWithMortgage`), with E18 grey. One VOI tap at most: the mortgage start tap, else the car-loan start tap. | A picked debt is never dropped. Blank owed: E21, E25, E30, E31 or loan, worked back from the payment when it is typed. Blank rate and payment: guesses, marked, with the old flags mirrored. |
| Q6 Spending | Rows show their grey guesses. One basis line (5.6). Group sums and "In all, about a month" include them with parts ("$900 you typed + $3,000 our guesses"). "Type your rent first: it decides most of the total" when housing is guessed. Taps: health cover (E05) and childcare (E06); HOA (E01) only in the ask band. "One rough total" stays as the second tile, its grey figure the sum. The retirement box: from age 50, a box with the grey figure (`retireSpend`); under 50, one muted line: "We'll plan on about $1,900 a month once you stop working: today's costs without childcare and loans that end by then. Change it on Will the money last?" The line is written and marked (the person saw it). | Blank rows: each guess is marked. Blank total in total mode: the rows are written as guesses. "Skip: use our guesses": the rows are written. |
| Q7 Goals | Unchanged | |
| Q7b Goal details | The home goal: `goal.home.target` grey. Education: `goals/education:target` per child. Trip and "Something else": empty box, help "For example, 4,000". Cushion months start from Emergency fund's `suggestedMonths`. | Home and education blank: marked. Trip and other blank: target 0 as today, and the goal says "Add an amount" (not "on track"). |
| Done | Section 11.1 | |

**The Arizona reveal fix (C5).** `standing().later` drops the state item when `FLAT[state]` exists or
`NO_WAGE_TAX[state]`. Only graduated states with no typed rate keep "type its rate on the State page".

---

## 11. The done screen, the guesses page, the Dashboard, existing plans

### 11.1 The done screen ("Here is your money on one page"), top to bottom

1. **The headline and four tiles.**
   - Tiles follow section 8.
   - A "Not yet" tile names only what is really missing. Its reason comes from the compute: the new
     `standing().tileWhy = { netWorth, spare, cushion, retire }`, built from `retirementGap(plan).what` and the missing
     income or accounts. This replaces the fixed string `"Social Security and birth dates"` in `drawDone`.
2. **"Your first moves"**, unchanged. Two debt moves that say the same thing merge into one.
3. **"Our guesses for now"** (new). The top 3 by impact, as row links: "Spending: about $3,000 a month ›",
   "Mortgage still owed: about $111,000 ›", "401(k): about $26,000 ›". Then "All 9 guesses ›". The line under the
   heading: "Typical figures for a household like yours. Good enough to start; type the real ones when you have them."
4. **"Not counted yet"**: only what is truly missing (a graduated state's rate, two returns for an unmarried couple).
   Hidden when empty. The debt guesses leave this list.
5. **The market card**, renamed "What the plan assumes about prices and markets". It is folded last, with the same
   buttons ("These sound fine", "Change them ›").

### 11.2 "Our guesses for you" (`modules/overview/guesses/view.js`, a new page)

```
Our guesses for you
We filled in what you skipped with figures typical for a household like yours. They're good enough to start.
The first few change your answers the most. A guess follows your new answers until you type over it.

[card: Fill in what you skipped]     (11.4, only when there are offers)
[card: Better guesses are ready]      (11.5, only when there are offers)

[card] Matters most
  Spending on groceries                           about $550 a month
  Our guess: typical for a parent of two in Ohio on your pay.
  If it's off, what's left each month could change by about $150.
  Sharper if you tell us: your bank files ›
  [$ ______ grey 550 ]  [Save]           (That's about right)
  ─────────
  ...
[details.card.fold.fold-card] Matters less                       6 guesses ›
[details.card.fold.fold-card] Where our guesses come from        14 sources ›   (publisher, table, vintage, read date)
[details.card.fold.fold-card] What the plan assumes about prices and markets   ✓ Looked over | Worth a look ›
```

- **Layout:**
  - Records, not a table.
  - The box and a filled Save are the primary action of each row; "That's about right" is outlined.
- **Saving:**
  - Save and blur commit through `saveField`, with the notices from 9.6, kept in a module-level `pending`.
  - A frozen entry (S6) leads, with "Type the real figure; we can't update this one any more."
  - "These look fine" (outlined, at the end) sets `guide.guessesLookedAt`.
- **Empty state:** "Every figure in your plan is one you typed. Nothing to look over here." plus an outlined "Back to
  the Dashboard".
- **Ranking**, in `compute(plan, { ranges: true })`, heavy:
  - Up to 25 entries in use. Only the top 8 by static weight go through the expensive pass.
  - For each, the plan is copied with the guess at its middle-half ends: spending rows together, with the declared 0.25.
  - Then next-best-action `spare.monthly`, liquidity `runwayMonths` and, when `retirementKnown`, the projection's
    affordable spending and verdict are recomputed.
  - Tier 1: a verdict differs. Tier 2: it moves left over or retirement by $100 a month, or the cushion by a month.
    Tier 3: the rest.
  - The words: "If it's off, what's left each month could change by about $150." The figure is rounded to $10 under
    $100, else to $50.
  - The view memoises by `meta.rev`. Before C8, rows sort by static weight.

### 11.3 The Dashboard (compute: mine; view: the designer's lane, claimed)

- **The setup checklist step** `assumptions` becomes "Look over our guesses" (`go: ["overview", "guesses"]`). It is
  done when `guide.guessesLookedAt` is set or no big guess is in use. `assumptions.reviewedAt` keeps meaning "market
  assumptions looked at". `overview/guide/journeys.js` gets the same rename.
- **The cards.**
  - The offer cards (11.4, 11.5) come first under "What to do now", while they have offers.
  - Then "Make our guesses yours" ("3 figures we guessed change your answers the most. ›"), while a tier-1 or big
    guess is in use.
  - Both drop away when they no longer apply.
- **"What is coming" is not touched** (DESIGN_LOG 2026-09-15 Dashboard round 1: "Do not re-propose").

### 11.4 Existing plans: "Fill in what you skipped"

`compute().offers.fill` lists blanks it can see, each with its proposed guess:

| case | offer |
|---|---|
| a debt kind picked on setup with no record | the account, owed, rate and payment (E21-E32) |
| income on file but no expenses and no transactions | the spending rows (7.A) |
| a retirement tile picked but no account for an adult | balance, contribution, match |
| a setup goal with target 0 (education, home) | its target |
| a setup contribution with amount 0 and match 0 | not written. It becomes a question: "Do you put money into it from your pay?" (None / Not sure / a % chip) |

- The card lists the figures with "our guess" lines.
- "Use these guesses" (filled) writes them all with `markGuess`. "Not now" (outlined) sets
  `guide.fillSkipped = { at, choice: "later" }`, and the card returns after 30 days.
- Nothing is written before the tap.

### 11.5 Existing plans: "Better guesses are ready" (legacy)

- `offers.upgrade` lists every legacy entry whose new estimate differs, as old → new: "Mortgage rate: 7.24% → 4.6%
  (the average on Ohio mortgages people already have)" and "Mortgage payment: $2,044 → $1,640".
- "Use the new guesses" calls `markGuess` for each entry (the ledger plus the mirrored flag), then settle takes over.
- "Keep the old ones" sets `guide.guessUpgrade = { at, choice: "kept" }`, and the card never returns.
- CHANGELOG: "- [builder] Existing plans: guesses made by Get started before 2026-11-xx stay as they were until you tap
  'Use the new guesses' on the Dashboard (old mortgage guesses used today's new-loan rate)."

### 11.6 Partly typed spending: "Is something missing?"

`spend.missing` fires outside setup when all of these hold:
- spending is typed (no guessed rows);
- `typedMonthly < guessedHouseholdTotal × exp(−2.33 × 0.25) = 0.56 ×` the total;
- no bank files cover two or more months.

It shows one question on Expenses (designer view) and as a Dashboard card: "Households like yours usually spend about
$5,300 a month; you've listed $2,400. Is something missing?" with the buttons "Add our guesses for the rest" (writes
guessed rows only for the setup rows whose categories have no typed bill) and "That's everything" (stores
`guide.spendComplete = today`, which ends the question).

---

## 12. Pages outside setup, and the other builder's pages

### 12.1 My lane (C6, C9)

The adoption recipe for a page:

```js
const path = pathOf("debts", d.id, "rate");
const g = ctx.guess(`debt.${kind}.rate`, { path });
const fields = [{ key: "rate", label: "Interest rate a year", type: "percent", guess: g }];
ui.form(fields, { rate: isGuess(ctx.plan, path) ? null : d.rate }, (values, meta) => {
  pending = [{ kind: "ok", text: "Saved." }];
  ctx.store.update((draft) => saveField(draft, path, { value: values.rate, guessed: meta.guessed.has("rate") }, g, ctx.fmt.today()));
});
```

| page | what changes | files (lane) |
|---|---|---|
| balance/liabilities | rate and payment not `required`; guessed boxes (E20-E32); the record line; "Required payment each month" → "Payment a month" | view.js (designer, claim), compute.js `rows[].guessed` (b) |
| balance/net-worth | balance guess by type (E12, E15-E18, E40) and, for a debt account, owed | view.js (designer), compute.js `guessedAssets/guessedLiabilities` (b) |
| retirement/contributions | % accepted ("6%" or a % chip); E13, E14 boxes | view.js (designer) |
| cashflow/expenses | guessed rows' record line; the add form's amount box with E01-E08 by category; "Is something missing?" | view.js (designer), compute.js `guessedMonthly`, `guessedShare` (b) |
| property/home | property tax (E23), insurance (E24), HOA (hurdle), purchase-year preview (E19); upkeep stays the existing 1% fallback, said in the help ("Blank: 1% of the value a year, Fannie Mae's rule of thumb") | view.js (designer) |
| goals/house, goals/education | K3 previews (grey figures; nothing saved until typed) | view.js (designer) |
| property/rent-vs-buy | K3 previews: price (E18 for the state), rent (E01), tax rate (E23), insurance (E24), new-loan rate (PMMS latest) | view.js (designer) |
| career/benefits | K3 preview of the match (E14 formula in words) | view.js (designer) |

### 12.2 What claude-a's pages get without anyone editing their files

The pages: goals/emergency-fund, goals/vehicle, goals/travel, goals/charitable, debt/student-loans, debt/consolidation,
taxes/state, taxes/self-employment, taxes/filing-status, taxes/documents, balance/projection, balance/statement,
cashflow/statement.

1. **From C2-C4:** their computes read guessed numbers instead of zeros and dropped records. Emergency fund counts
   guessed spending; Consolidation sees guessed card rates; Projection grows guessed balances; the statements include
   guessed debts. Their output keys do not change.
2. **The guesses page** lists and edits every guess, whatever page made it.
3. **The grey note:** none until they add `restsOn` to their own manifests (opt-in; 9.5).

### 12.3 The WORKBOARD message to claude-a (post in C6 and again in C9)

> **claude-b → claude-a, guesses API.** Blank boxes can now show a grey "our guess" figure that is counted, through
> `core/estimate` (docs/CONVENTIONS.md "Guesses"). Nothing in your files changed. To adopt, in your files only:
> (1) add `guess: ctx.guess("<key>", { path })` to a `ui.form` field and call
> `saveField(draft, path, { value, guessed: meta.guessed.has(key) }, guess, today)` in your `store.update`;
> (2) add `restsOn: [sections]` to your manifest for the grey "Some of this uses our guesses" row;
> (3) to add a guess of your own, export `estimators` from your `compute.js` with keys `"<group>/<id>:<name>"`, list it
> in your manifest, and keep the tables in your `data/` with source and read date.
> Keys ready for your inputs:
> - balance/projection `whatIfs.netWorth.homeGrowth`: a `balance/projection:homeGrowth` estimator could use
>   `fhfa_hpi_po_state_change_2026q2` (10-year change by state). The table is in `modules/overview/guesses/data/home.js`;
>   import the data, not our compute.
> - debt/consolidation `loanRate`: `debt.loan.rate` (G.19 personal 24-month, 11.9%).
> - debt/consolidation `btApr`: `debt.credit.rate` (22.4%).
> - goals/vehicle `rate` and `termMonths`: `debt.car-loan.rate`, with the term from Experian (new and used averages
>   in `data/debts.js`).
>
> There is no sourced table, so keep a labelled example in the help line (never in the box), for: vehicleLoss,
> loanFee, btFee/btMonths, helocRate/helocMonths, salesTax, travel prices, bunchYears, gainShare.
>
> Worked out from the plan: taxes/state priorTax/priorAgi/withheld and debt/student-loans agi.
>
> The plain-words items for your pages are in FEEDBACK (13.2). Your percent boxes lose the grey "e.g. 7 for 7%" with
> the kit change; any "e.g." placeholder in your views now contradicts "grey = counted": please move them to help
> lines. `FLAT`, `NO_WAGE_TAX` and `flatTax` from taxes/state are imported read-only by overview/guesses; tell me
> before you change their shape.

---

## 13. The plain-words pass

### 13.1 In my lane (C10; designer-lane views claimed first)

| page | on screen today | say instead | file (lane) |
|---|---|---|---|
| Next best action | "Roth money grows tax-free for good, and a traditional IRA can cut this year's tax. Either way the room is lost for any year you skip." | "A retirement account you open yourself (an IRA). The Roth kind: no tax break now, no tax when you take it out. You can put in up to $7,500 a year; a year you skip can't be made up. What's this? ›" | overview/next-best-action/compute.js (b) |
| Next best action, HSA/IRA steps | "$X of room left this year (limit $Y, ...)" | "You can still put in $X this year." | next-best-action/compute.js (b) |
| Net worth types | "Brokerage (taxable)" | "Investments outside retirement" | balance/net-worth/compute.js ACCOUNT_TYPES (b) |
| Net worth types | "Traditional IRA" / "Roth IRA / 401(k)" | "IRA that cuts this year's tax" / "Roth (tax-free later)" | ACCOUNT_TYPES (b) |
| Net worth types | "529 plan" | "College savings (529)" | ACCOUNT_TYPES (b) |
| Net worth types | "HSA" | "Health savings account (HSA)" | ACCOUNT_TYPES (b) |
| Net worth types | "Life insurance cash value" | "Savings inside a life insurance policy" | ACCOUNT_TYPES (b) |
| Net worth types | "Real estate" / "Other liability" / "Personal / auto loan" | "A home or land" / "Something else I owe" / "Car or personal loan" | ACCOUNT_TYPES (b) |
| Net worth form | "Institution" | "Bank or company" | balance/net-worth/view.js (d) |
| Net worth form | "Joint or shared" (and shown with one adult) | "Both of us" (hidden with one adult) | balance/net-worth/view.js (d) |
| Debts form | "Interest rate per year" / "Required payment each month" / "Loan length in months" / "Secured by" | "Interest rate a year" / "Payment a month" / "Months left to pay" (not shown for cards) / "Backed by (a car, a home)" | balance/liabilities/view.js (d) |
| Debts, warnings | "${name} costs about $56 a month in interest" ("Credit cards costs") | "Your credit cards cost about $56 a month in interest" when the name is plural (the setup's "Credit cards") | balance/liabilities/compute.js line 66 (b) |
| Needs attention | "${name} is expensive debt" ("Credit cards is ...") | "Your credit cards are expensive debt" (same rule) | overview/alerts/compute.js line 140 (b) |
| How am I doing | "The lenders' front-end ratio (28%)" | "Rent is 31% of your pay before tax; most people aim for under 30%" | overview/benchmarks/compute.js line 97 (b) |
| How am I doing | "Fannie Mae's limit for loans checked by hand (36%; up to 45 to 50% ...)" | the sentence is dropped; "Loan and card payments: 13% of pay; under 36% is comfortable" | benchmarks/compute.js line 100 (b) |
| How am I doing | "gross income" | "pay before tax" | benchmarks/compute.js (b) |
| Emergency fund | "Sellable within a week" + "brokerage, crypto: sell, then wait for settlement" | "Investments you could sell" | balance/liquidity/compute.js TIERS (b) |
| Emergency fund | "Locked up or costly to tap" + its list | "Money you can't easily touch: retirement, college and health accounts, your home and car" | liquidity/compute.js (b) |
| Will the money last? | "Guaranteed income" (0%) | "Social Security and pensions" (the monthly figure from 67) | retirement/projection/view.js lines 42, 55 (d) |
| Will the money last? | "Starting withdrawal rate" | "Share taken out the first year" | retirement/projection/view.js line 76 (d) |
| Will the money last? | "$0 taxable, $0 pre-tax, $0 tax-free" | "$0 you can use any time, $0 in work and IRA accounts (taxed when taken out), $0 in Roth accounts (never taxed)" | retirement/projection/view.js (d) |
| Will the money last? | "required withdrawals from 75" | "from 75 the law makes you take some out each year" | retirement/projection view (d) |
| Will the money last? | the "Monte Carlo" and "History" links | "More ways to test it: the chance it lasts, and if history repeated" | retirement/projection/view.js (d) |
| Assumptions, alerts | "Ten numbers drive every projection..." | "What the plan assumes about prices and markets" (lede) / "Look over what the plan assumes" (alert) | system/assumptions/view.js (d), overview/alerts/compute.js line 84 (b) |
| Assumptions | "How much stocks swing (a typical year)" | "How bumpy stocks are, in a typical year" | system/assumptions/compute.js (b) |
| Mortgage | "One lump sum (for a recast)" | "Pay a lump sum to lower the monthly payment" | debt/mortgage/view.js (d) |
| Mortgage | "a new appraisal" | "a new valuation of the home" | debt/mortgage/compute.js, view.js (b, d) |
| Credit cards | "Balance transfer offer" / "Promotional 0% months" / "Transfer fee, percent" | "Move it to a 0% card?" / "Months with no interest" / "One-time fee to move it", with the line "You usually need good credit to get one." | debt/credit-cards/view.js (d) |
| Federal estimate | "effective rate -1.2%" | "You get back more than you pay: the child credit covers it" | taxes/federal/view.js (d) |
| Federal estimate | "the 12% bracket, $33,660 of room left" | "the next $33,660 you earn is taxed at 12%" | taxes/federal/view.js (d) |
| Social Security | bend points, ssa.tools, "Earnings record: paste" on screen | into the "How it's worked out" fold; on screen: "We estimated this from your pay. For the exact figure, sign in at ssa.gov and type the monthly amount it shows at 67." | retirement/social-security/view.js (d) |
| Next best action | "Goal seek" | "What it takes" | next-best-action/compute.js (b); the scenarios/goal-seek title (d, manifest title) |
| Get started done | "Not counted yet" listing guesses; "How the plan makes its guesses" | 11.1 | overview/setup (b) |
| Children | "Child 1 / Child 2" in sentences | "your two children" when unnamed (Q1 keeps the optional names) | overview/setup compute words (b) |

Glossary "What's this?" links for the names that must stay (401(k), Roth, HSA, IRA) point to
`ai/glossary/data/terms.js` entries. Searching for a glossary term lists its entry first (`core/search.js`: b).

### 13.2 For claude-a (WORKBOARD + a FEEDBACK item "for: builder (claude-a)"; never edited by me)

| page | today | suggested |
|---|---|---|
| debt/consolidation | "Balance transfer fee", "APR", "HELOC" | "One-time fee to move it", "interest rate a year", "home-equity line" |
| taxes/state | "Adjusted gross income on last year's federal return", "Deductions and exemptions" | "Income after a few deductions (line 11 of your federal return)", "Amounts taken off before the rate" |
| debt/student-loans | "Income to use (adjusted gross income)", "PSLF" | "Income after a few deductions (line 11)", "Public Service Loan Forgiveness" |
| any of the 13 | grey "e.g." placeholders | move to the help line ("For example, ...") |

---

## 14. Tests (`npm test` runs them all)

### 14.1 Plumbing (hand-worked, no tables)

**`tests/estimate-paths.test.mjs`:**
- `getAt` on `accounts[a1].balance`, on `retirement.socialSecurity.p1.monthlyAtFRA`, and on a missing id (→ undefined).
- `setAt` on a missing record → false, nothing created.
- `parsePath` throws on `accounts[a.b].balance`.
- `canonical`: `debts[acct-9]` → `debts[d-3]`.

**`tests/estimate-ledger.test.mjs`:**
- Per-unit `same`:
  - a typed 22% over a guessed 22.36% is not the same;
  - 4.9% over 4.6% is not the same;
  - $450.004 over $450 is the same.
- `markGuess` is idempotent (`at` kept).
- `isGuess` is true while equal and false after a change.
- Legacy `rateGuessed: 0.2236` reads as `debts[<id>].rate`, `k: "debt.credit.rate"`, `legacy: true`.
- `saveField`:
  - typed 450 over a guess of 450 → the entry is gone;
  - blank with a guess → marked;
  - blank with no guess → null, no entry.
- The last `clearGuess` deletes `plan.guesses`, and the JSON equals the plan before the first mark.

**`tests/estimate-settle.test.mjs`** (stub estimators):
- Follow: a mark of 10 → `meta.n` changes → 14, `changed[0] = { from: 10, to: 14 }`.
- Typed over → dropped, never returns.
- Tier 3 sees tier 1's new value in the same pass.
- A removed record → `gone`.
- Idempotent.
- `d` guard: an entry with `d: "2027-11-01"` and a fresh estimate dated `2026-11-02` → untouched.
- Unknown `k` → untouched and still `isGuess`.
- **Legacy frozen:** a plan with `rateGuessed` equal to its rate and a stub `debt.mortgage.rate` returning 0.046 → no
  change.
- A throwing estimator → `settle` throws and `store.update` keeps the mutator's change.
- `checkEstimators` reports a read of a later tier, a duplicate key, a missing label.
- **Fuzz:** 500 random sequences; invariant: every field last typed holds its typed value.

**`tests/store-settle.test.mjs`** (the store-sync harness):
- runs once per `update`;
- `load`, `adopt`, `replace`, `resolve` and another tab's save never call it;
- a throw keeps the change;
- every existing store test passes with and without a settle registered.

**`tests/estimate-perf.test.mjs`:**
- settle on the largest qa plan with 40 marks and 6 months of transactions, ×200, under 600 ms;
- the no-guess early exit ×10,000 under 50 ms.

### 14.2 Invariance and the owner's plan

**`tests/guesses-invariance.test.mjs`.** For every `qa/fixtures/*-plan.mjs`, every plan built from
`qa/households/lib/catalog.mjs` (the 14 archetypes and their packs), and every golden suite plan:
- settle returns no change and the JSON is identical;
- `migrate()` adds no `guesses` key;
- every module's `compute()` is deep-equal with and without the hook.

**`tests/guesses-legacy.test.mjs`.** Use a plan made by today's setup with `rateGuessed: 0.0724` and
`paymentGuessed: 2044` on a mortgage, `ssWrote`, and `retireAuto: true`:
- an unrelated `store.update` (renaming a goal) changes no figure;
- `offers.upgrade` lists the mortgage rate 7.24% → the state rate and the payment old → new;
- "Use the new guesses" writes ledger entries and mirrors the flags;
- "Keep the old ones" changes no figure and the card never returns.

**All `tests/golden-*.test.mjs` suites run unchanged.**

### 14.3 The estimators (`modules/overview/guesses/module.test.mjs`)

**Data:**
- every table has publisher, https url, vintage and readOn;
- every row's length equals `cols`;
- spot values match: CE all-households spending $81,905; Vanguard 35-44 median $46,919; FHFA Ohio 4.6%, Arizona 4.3%;
  ACS Ohio home value $254,100; ACS Texas median gross rent $1,515; NAIC Ohio HO-3 $1,116; CCAoA Ohio four-year-old
  center $10,552;
- `DERIVED` recomputed from `T` matches (6.5);
- no table on an `unverified` list and no never-bundled id is present.

**Contract:**
- every estimator returns null or an Estimate whose `tables` resolve, with `why.length <= 70`, `dataAsOf` set and
  `low <= value <= high` when measured;
- `checkEstimators(ALL)` is empty;
- the import graph is acyclic (6.2).

**Gate:** the EUR household and `outsideUS` → every key null. A blank state with USD → national figures, with
"your state" in `sharperWith`.

**Answer keys:** every cell of 7.H, built with the setup's apply functions, in the style of
`modules/overview/setup/module.test.mjs`, with the arithmetic in comments.

**Bias and envelope:**
- the guessed rows + typed rows + loan payments ≤ the envelope + $10 whenever k > 0.5;
- S's living share of `a` is between 0.70 and 0.85;
- J's flexible rows are scaled (k < 1) and housing is not;
- with income above $250,000 the shares stay flat (no extrapolation).

**Monotone:**
- a higher typed pay never lowers a balance guess (Vanguard, SCF);
- typing pay never widens a spending row's spread;
- a $1 change of pay at a bucket edge moves any guess under 0.1%.

**Hurdles:**
- Ohio HOA → skip, Arizona → ask;
- Sam's participation p is between 0.4 and 0.6;
- childcare always asks.

**Typo:** J's "5" → the `pct-of-pay` slip with $240. A $15,000 rent → `year-as-month`.

**Bank (R12):** two full months of categorised outflows replace the rows; one month does not; transfers are excluded.

**Coverage:** every `guess:` key exists, and the 188 rows have a `how`.

### 14.4 The setup (`modules/overview/setup/module.test.mjs`)

**Unchanged:** every existing test (the apply functions without `guess`).

**New, with `guess` injected:**
- a picked debt with only a payment is kept (owed and rate marked; the flags mirrored);
- a picked retirement tile with blank boxes makes the account with three marks;
- blank spending rows are saved as marked rows, and the "Got it" line counts them;
- "Skip: use our guesses" writes them;
- the mortgage rate is the state's (the 7.24% case stays only in the old test, which passes no `guess`);
- the joint split tap;
- under-50 line written, over-50 box marked;
- `standing().tileWhy` names only what is missing (Sam: no "Needs your pay");
- the Arizona flat-rate item is gone.

**Preview equals written:** for every screen and every box with a guess, the placeholder from `valuesFor` + the
screen's args equals the value the apply function writes when the box is blank, and it stays equal after the settle
that follows.

**Walk replays:** the three walks' answers, applied through the functions, give left-over values within ±$100 of 7.H
and `waits === true`; Pat and Lee owe more than $100,000; Jordan's match step is open.

### 14.5 The kit (`tests/ui-form-guess.test.mjs`, DOM-free `readForm` + `meta`)

- blank with a guess → `values.rate === null`, `meta.guessed.has("rate")`;
- typed equal to the guess → typed, not guessed;
- a percent box with no guess has no placeholder;
- `pctValue("6%") === 0.06`.

### 14.6 The tester's lane (filed as FEEDBACK "for: tester"; not in `npm test`)

1. **`qa/smoke-all.mjs` extension:**
   - no input on any usable page has a placeholder that starts with "e.g." or is a bare example figure;
   - on every Get started screen, each grey figure equals what is saved after Continue with blanks.
2. **A labelled backtest smoke check** on the qa households: blank each typed field, guess it, and report the
   median |log error|. This is not a gate: the households are invented.

---

## 15. Rollout: ten commits, in order of impact

Every commit:
- tests green (`npm test && npm run check && node tools/leak-guard.mjs --worktree`);
- the touched pages screenshotted at 390 px with `node tools/shot.mjs <group>/<id>` and the PNG read (`--dark` too for
  new UI);
- one `- [builder] ...` CHANGELOG line;
- the docs it changes, in the same commit;
- `Prompt: <id>` in the message when it carries out a prompt from `prompts/`;
- `git pull --rebase` first (WORKBOARD rules).

**Lane marks:**
- (b) mine;
- (d) the designer's lane: claim it in TEAM.md "Now editing" before the commit, as the round-3 claims did, and release
  it after;
- (a) claude-a's: never edited; message them.

| # | commit | files | the person sees | fixes |
|---|---|---|---|---|
| C1 | **Plumbing, data, the guesses page** (nothing moves) | (b) `core/estimate/{paths,ledger,engine,index}.js`, `core/math/estimate.js`, `core/store.js` hook, `core/app.js` (merge, register, `ctx.guess`, notice), `tools/check.mjs`, `tools/build-guess-data.mjs`, `modules/overview/guesses/*` (data, estimators, coverage, page listing the legacy guesses as frozen), setup `estimators` export + `module.js` re-export, `docs/CONVENTIONS.md` "Guesses" section (rule 2.3, paths, API 4.2-4.4, recipe 12.1, never-create, typed-wins; `module.js` gains `estimators`, `restsOn`; "Input schemas" gains `guess`, `zeroOk`, `onSubmit(values, meta)`; ctx gains `guess`; "Where things go" gains the population-table row), `docs/DATA_MODEL.md` (3.6), `docs/PLAN.md` decision-log row, `docs/MODULE_CATALOG.md` row, `vendor/sources.json`; tests 14.1, 14.2, the data and contract parts of 14.3 | A new page "Our guesses for you" listing today's typical debt rates and payments, Social Security from pay, retirement spending, the cushion | nothing yet; the base everything else needs |
| C2 | **Debts are never dropped** + the stage-1 net-worth state | (b) setup compute (`applyOweAmounts` with `guess`, `valuesFor`), setup view Q5b (order, grey guesses, one VOI tap), `estimators/debts.js`, `home.js` (E18, E20-E32, E23, E24), `balance/net-worth/compute.js` additive keys, setup done tile words; offers.upgrade + the card on the guesses page | "Still owed: about $111,000" grey; the mortgage rate 4.6% for Ohio; Pat and Lee's mortgage counted (net worth no longer $978,000 "a solid base", Timeline no longer "Debt-free now"); "Partly our guesses" on net worth | near #1, #9; young #5; parent #1, #6 |
| C3 | **Spending is never $0** + the stage-1 waiting verdict | (b) setup Q6 apply/view (rows, taps, basis line, total = sum, under-50 line, skip), `estimators/spend.js` (7.A, R10, R12 off until C7), `cashflow/expenses/compute.js` (`guessedMonthly`, `guessedShare`), `overview/next-best-action/compute.js` (`spare.guessedShare`, `waits`), `balance/liquidity/compute.js` (`waits`), setup `standing()` + done tiles (8.1); (d) Dashboard tile words in `overview/dashboard/view.js`, Expenses record line in `cashflow/expenses/view.js` | Grey figures that add up; "Got it: about $3,900 a month, 7 are our guesses"; "Left over: depends on your spending; with our guesses about $780 short" in grey | young #1, #2, #8; near #2, #3; parent #3 |
| C4 | **Retirement saving is never $0** | (b) setup Q4b (chips, couple tap, typo check, the account always made), `estimators/saving.js` (E12-E17, E40), NBA match step words ("put in 6% ($290) to likely get about $190"); (d) `retirement/contributions/view.js` accepts "6%" | The 401(k) and match step stay; "Did you mean 5% of your pay?"; "both of ours" splits $500,000 | young #3, #4, #11; parent #2, #4, #10; near #6, #8 |
| C5 | **The questions and the reveal tell the truth** | (b) setup Q1 (birth years, children's ages, outside the U.S.), Q2 (pay guess, take-home switch, `estimators/pay.js`), Q3 (67 sentence and chip), Q7b (goal targets, `goal.home.target`, `goals/education:target` in `goals/education/compute.js`), `standing()` (`tileWhy`, "Our guesses for now", Arizona fix), done view (11.1), `overview/guide/journeys.js` (`detailed()` counts a guessed rate and payment as enough; step rename), `overview/dashboard/compute.js` step, `core/ai.js` `planSummary` tags | "Our guesses for now" (top 3); "Not counted yet" only for what is missing; no "Needs your pay" after pay was given; the market card folded last | young #7, #13, #14, #15; parent reveal, education goal at $0; near #7, #14 |
| C6 | **The form kit and the pages outside setup** | (d) `core/ui/dom.js` (`guessLine`, `pctBox`, `pctValue`, `guessNote`, `ui.form` `guess`/`zeroOk`/`meta`, no "e.g. 7 for 7%"), `core/ui/base.css` (the one placeholder line, 9.1); (b) `core/app.js` grey note for `restsOn`; `restsOn` in my manifests (9.5); (d) liabilities, net-worth, expenses, property/home views (12.1); (b) liabilities and net-worth compute keys; tests 14.5; WORKBOARD message 12.3; FEEDBACK for the tester (14.6) | Debts and Net worth save with blank boxes; every page resting on a big guess says so in one muted row; no grey examples in boxes | young #6, #10; near #8 |
| C7 | **Existing plans and bank files** | (b) guesses compute `offers.fill`, the cards (guesses page; Dashboard compute; (d) Dashboard view), R12 on, `spend.missing` (11.6) + (d) the Expenses question; the CHANGELOG line of 11.5 and a WORKBOARD note that the owner's plan changes only on a tap | "Fill in what you skipped"; "Better guesses are ready"; "Is something missing?"; spending from bank files after two months | near #3; judges' "existing plans", "bank files", "partly typed lists" |
| C8 | **Verdicts that wait, stage 2, and estimates at compute time** | (b) `rangeOf` in NBA, liquidity and projection computes behind `params.ranges`; the guesses page ranking (heavy, top 8, memo); "Make our guesses yours" card; `estimates[]` in `taxes/federal`, `taxes/withholding`, `retirement/projection` computes; `modules/reports/report-kit.js` "(our guess)" marks; (d) the views that show `decisive` and "(our estimate)" | "Your rent decides it: type your rent"; ranges only from measured spreads; reports mark guesses | young top #1, #8; judges' compute-time estimates, reports |
| C9 | **Calculator previews and coverage** | (d) goals/house, goals/education, property/rent-vs-buy, career/benefits views (K3); (b) `coverage.js` down to its last `later:`; the second WORKBOARD message with the keys (12.3) | Grey figures in calculators, saved only when typed | parent education; judges' calculator mapping |
| C10 | **Plain words** | 13.1 rows ((b) compute strings; (d) views, claimed); FEEDBACK item for claude-a (13.2) | No "front-end ratio", "Institution", "Guaranteed income 0%"; "your credit cards cost" | young words list; near #10, #13 |

**Order.**
- C2, C3 and C4 can swap after C1, but C2 goes first: a dropped mortgage is the largest single wrong figure (about
  $200,000 of net worth for Pat and Lee) and touches the fewest files.
- C3 must include the stage-1 waiting state; it may not land without it.
- C6 depends on the designer-lane claim. If the claim cannot be made, C6's kit patch goes to the designer as one
  FEEDBACK item with the exact API in 9.3, and the pages wait.

---

## 16. What NOT to build

- **A read-time overlay of the whole plan** (`withGuesses(plan)`). It would mean 271 entry points to remember.
- **`guesses` in `emptyPlan()`, a `migrate()` change, a `SCHEMA_VERSION` bump.** The v2 fold of the legacy flags
  waits until no reader uses them.
- **Settle on load, adopt, replace, resolve, the server, or scenario copies. Settle that creates entries.**
  Re-estimating legacy flags without the card.
- **A spending cap at take-home, or a "typical saving rate" deduction.** Separate total estimates.
- **USDA food plans as a guess.** Gross rent plus a utilities row. A "1-bedroom" assumption.
- **The geometric mean of one-way cells.** Invented ±25% / ±2-point / ×0.5-2 bands.
- **Dollar ranges printed from declared spreads.** Strength words, publishers or years on screen. A pill on every
  guessed number. Amber or red caused by our uncertainty.
- **Childcare without the existence tap.** Guesses for things the person did not pick.
- **The state income tax rate as a guess** (claude-a's field; the reveal reads FLAT instead).
- **G35 raises, a guessed stop age, plan-to 99/97, health after work inside retirement spending, the ACA benchmark /
  Part D / career/benefits match rewiring.** Golden-covered defaults changed without the owner.
- **G17 "checking holds a month of pay".** Any figure with no table behind it shown as "our guess"; it is "For
  example, ..." in the help line instead.
- **Tables in `core/`.** `core/` importing `modules/`. The guesses compute importing an `overview/*` compute.
- **The backtest on invented households as a pass/fail gate.** Long-term care, term vs permanent and travel prices
  (no sourced tables: labelled examples).
- **Edits to claude-a's 13 pages.** The grey note on pages that did not opt in.
- **Removing "What is coming" from the Dashboard** (DESIGN_LOG: "Do not re-propose"). Removing Net worth's Edit/Delete
  buttons (owner chose B).
- **The fixes not caused by blanks**, filed instead as FEEDBACK "for: builder":
  - the healthcare-before-65 Medicaid message from near-zero modelled income (retirement/healthcare);
  - the pension form shown before "I don't have a pension" (retirement/pensions view, designer).

---

## 17. For the owner (defaults chosen so the build can proceed)

1. **A blank pay box after "I work"** is guessed and counted, following the one rule (E33). To switch it off:
   `PAY_GUESS_STORED = false`, and pay becomes a preview only.
2. **The default stop age stays 65.** Only the "67 is full Social Security" sentence and chip are added. Starting new
   people at their full retirement age is your call.
3. **Home upkeep stays at 1% of value a year** (Fannie Mae's rule of thumb, which the golden tests cover). Switching
   it to what owners actually spend (AHS, about 0.3% of value) is your call.
4. **The one-time card for older guesses:** "Keep the old ones" is the safe default if you do nothing. The card waits
   on the Dashboard.
5. **Later, not in this work:**
   - calibration against public microdata (SCF extract, CE public-use files, ACS PUMS);
   - health after work inside retirement (R5-4);
   - guessed raises by age;
   - a per-household plan-to age.
