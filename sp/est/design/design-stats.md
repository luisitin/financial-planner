# Smart guesses: the estimator design (statistics angle)

Read on 2026-11-02. Inputs: `inventory-a.json` + `inventory-b.json` (670 inputs, 146 hidden defaults, 63 existing
guesses), `walk-young.json` (Sam), `walk-parent.json` (Jordan), the `walk-near/` screenshots (Pat and Lee; the JSON
arrived while this was written and is folded in), and the six sourced table files in `est/data/` (148 tables). Every figure below was computed
by the prototype `est/design/tools/proto.mjs` from those tables (run it with the data folder as its argument); the
build recomputes them in tests, so treat the persona figures as the expected answers, to within rounding.

The owner's request, restated as a rule: **a box the person leaves blank holds the value most likely for someone like
them, given everything the plan already knows; each answer makes the next guesses sharper; with nothing known, the
national typical value.** A blank never becomes 0 unless 0 is the most likely value.

---

## 0. The decisions in one page

1. **What "most likely" means.** Money amounts are close to log-normal (a few people have far more), so the most likely
   value on the scale people think in (proportions) is the **median**, not the mean. Choices (a match formula, a car
   being new or used) take the **mode**. Rates (APRs, mortgage rates) are not skewed, so a published average is used as
   is. Means are used only where things must add up (spending categories into a monthly total), and then only inside
   narrow cells (one income level, one household type) where skew is small.
2. **Never invent existence.** A guess fills an amount for something the person said exists (a ticked box, a record).
   Whether something exists is guessed only through the *hurdle rule*: share of people like this who have it under
   35% → assume not (0, said so); 35-65% → **ask one yes/no tap** (a coin flip is not a guess); over 65% → assume yes.
3. **Worked out beats typical.** If typed facts determine a value by a formula (balance from payment and rate, gross
   pay from take-home, today's home value from price paid and the state's price index), that is the guess ("close").
   If the formula has a free part (how far into the loan), the formula and the population table are combined by
   **precision weighting in log terms** (prior times evidence).
4. **Combining tables that give one or two dimensions at a time:** an **anchor** (the most specific table that holds
   the strongest known predictors jointly, e.g. state x mortgage status) times **ratios** for the other dimensions
   (log-additive model). A ratio along a dimension that also moves income (age, household type, tenure) is
   **income-adjusted**: divide out the part the group's typical income explains (one step of backfitting). **One ratio
   per independent axis** (household type, place, tenure for housing items only): stacking correlated ratios made the
   fit worse in the validation below. An unknown predictor contributes the "all" row (ratio 1).
5. **Validated, not assumed.** Scaling a national age profile by a state ratio reproduces the published Census state x
   age household-income cells with a median error of **3.0%** (90th percentile 11.9%) across 51 states x 4 age bands,
   against 24% ignoring age and 10.6% ignoring the state. Household size x state: 4.3% (p90 12.8%). For spending, the
   income curve alone predicts the BLS household-type totals within 6.4% on average; adding household size 6.3%;
   adding age on top 7.8% (worse), so the design uses one household-type ratio, not several.
6. **Every guess carries its spread** (sigma on the log scale) from the table itself wherever the table publishes a
   mean and a median (log-normal: sigma = sqrt(2 ln(mean/median))): SCF, Vanguard, CPS, AHS. A guess made from a
   guessed input adds that input's spread times the guess's sensitivity to it. Plain strength words: **close**
   (sigma <= 0.15), **likely** (<= 0.5), **rough** (> 0.5, and the range is shown: "Most people like you: $6,600 to
   $17,000. We used $12,500.").
7. **A guess may feed the next one, but never as if it were typed.** Its spread is carried into the next guess
   (sigma adds in quadrature, scaled by how sensitive the next guess is to it), so a weak input makes an honestly weak
   output, labelled "your pay is our guess too". Using a guessed predictor is the same as conditioning on what that
   guess was made from (state and age for pay), which always beats ignoring it; what must never happen is the spread
   being dropped. Tiers fix the order, so no guess can feed itself.
8. **Headline figures inherit their inputs' uncertainty.** When the 50% range of "left over each month", "months of
   cushion" or the retirement check crosses its decision line, the page does not give a verdict from guesses: it shows
   the range and names **the one guess that decides it** (the largest share of the variance), with a box to type it.
9. **Guesses are written into the plan, marked in one ledger** (`plan.guesses[path]`), and **follow** while untouched:
   when an answer they depend on changes, every still-untouched guess is recomputed on the same save (a settle step in
   `store.update`). A typed figure always wins and is never overwritten. This is what makes "the more you tell it, the
   better it guesses" automatic, and it is why every other builder's page benefits without any edit: their computes
   read real numbers instead of zeros.
10. **One module owns it:** `modules/overview/guesses/` (estimators, tables, the "Our guesses for you" page), with the
    pure statistics in `core/math/estimate.js`. Core gains three small hooks (store settle, ctx.guess, the form's
    `guess` field). Other builders adopt it in their own files with a field property and, if they want new guesses,
    an `estimates` list in their own manifest.

---

## 1. What the walks and the inventory say (why this matters)

* 670 inputs: the person knows 272, knows roughly 180, **does not know 192**. 146 hidden defaults; only 63 places guess
  anything today, mostly in the setup (debt rates, debt payments, Social Security from pay, retirement spending from
  bills, cushion target, filing status).
* The worst failures are blanks read as zero, then carried as facts:
  * Sam left spending blank: "Got it: about $86 a month", then "Your month works, $1,640 left over"; really it
    is about $0 to $300 (walk-young top 1, 8; `16-after-spend-blank.png`).
  * A blank 401(k) balance drops the account, its contribution and the match step; blank contribution and match read
    0%, so "Runs out in 2067 (age 65)", "$0 at retirement" (top 3, 4).
  * A car loan with only its payment typed is dropped; Jordan's mortgage with only the payment typed is dropped with
    the home value (walk-parent wrongAfterBlank 1).
  * A blank mortgage rate becomes today's new-loan 7.24% on a loan from about 2016 (walk-parent wrongAfterBlank 6).
  * "5" typed as a contribution meant 5% of pay and saved as $5 a month (walk-parent); "6%" refused outright
    (walk-near).
  * Pat and Lee typed a $1,600 mortgage payment with the balance blank: the mortgage is dropped, "You own $978,000 and
    owe $0, a solid base", Timeline "Debt-free now"; with spending blank, "The money lasts" on $28,800 a year, and
    the health page says a couple with $500,000 may get Medicaid (walk-near top 1, 4, 5).
  * The education goal with a blank amount is "on track" at $0 (walk-parent); the cushion goal "$0 of $0" (walk-young).
* Placeholders are static and sometimes absurd for the person: "$ 3,500" a month on Sam's spending total (more than his
  take-home), "$ 300,000" for Jordan's Ohio house, "e.g. 6.5" next to a rate that will actually be saved as 7.2%.

---

## 2. What a guess is (the contract every estimator meets)

### 2.1 The shape

```js
/** @typedef Estimate
 *  key       "spend.groceries"            the estimator
 *  path      "expenses[setup-x-groceries].amount"   where it goes (absent for a preview)
 *  value     340                            rounded to its strength (2.4)
 *  unit      "month" | "year" | "total" | "rate" | "age" | "year-date"
 *  sigma     0.25                           spread on the log scale (here the declared one, 4.1; null = none)
 *  low, high null, null                     the middle half (25th-75th), present only when the table measures it
 *  strength  "close" | "likely" | "rough"
 *  shownRange  false                        say the range on screen (rough and measured)
 *  basis     "Typical for a one-person home in Texas earning $48,000 (U.S. spending survey, 2025)"
 *  uses      { income: "typed", householdType: "typed", state: "typed" }   what it was conditioned on, and how known
 *  tables    ["ce2025_spend_by_incomeQuintile", "ce2025_spend_by_householdComposition", "ce2025_spend_by_region"]
 *  decisive  false                          set by verdicts (section 4.6)
 *  dataAsOf  "2026-11-02"                   the tables' read date
 */
```

### 2.2 Which statistic

| kind of field | statistic used | why |
|---|---|---|
| a balance, a price, pay, a loan amount | median (if the table has it), conditional on the knowns | log-normal: the median is the mode of log value; robust; "half above, half below" |
| a monthly spending category | conditional **mean** of a narrow cell (CE publishes means only) | categories must add to the total (means add, medians do not); narrow cells keep skew small; the spread is declared, not measured (4.1) |
| a rate (APR, mortgage, raise) | the published average | rates are close to symmetric; that is what lenders and the Fed publish |
| a discrete choice (match formula, new or used, 2 cars) | the mode, or the class whose typical value is nearest in log terms to what was typed | maximum likelihood with equal priors |
| an age or a year (stop-work age, year bought) | the median of the published distribution, interpolated within its bins | |
| does it exist at all | hurdle rule (2.3) | never invent records |

### 2.3 The hurdle rule (existence)

`hurdle(pHas)`: `pHas < 0.35` -> `"skip"` (the most likely amount is 0; nothing is written; a hint may say "if you
pay one, typical is $98"); `0.35 <= pHas <= 0.65` -> `"ask"` (a one-tap yes/no replaces the guess); `pHas > 0.65` ->
`"assume"` (use the median among those who have it). Examples from the tables:

* HOA fee: Ohio owners 17.8% pay one -> skip; Arizona 48.8% -> ask (acs2025_hoa_condo_fee_by_state).
* Still paying a mortgage at 60-64: 54.1% of owners (acs2025_owners_with_mortgage_by_age_us) -> ask (unless ticked).
* Health cover through work for a full-time private worker: 58% participate (bls_ncs_medical_premiums_2026) -> ask.
* Puts money into the 401(k) once they have one: 83% (vanguard_has2026_headline, participant-weighted) -> assume.
* Employer adds money at all: 96% of plans (vanguard_has2026_headline) -> assume.
* Owns a home at under 25: 16.0% (acs2025_homeownership_by_age_us) -> assume renting, but only as the label on the
  housing row ("Rent"); the setup's "have" answer decides.

### 2.4 Order of evidence

1. **Typed** by the person (always wins, never touched).
2. **Worked out** from typed figures by an identity (`close`), e.g. `pv(rate, monthsLeft, payment)`.
3. **Worked out + prior**: an identity with a free part, combined with a population table by precision weighting.
4. **Like you**: population table conditioned on at least two typed predictors (`likely`, or `rough` when the table
   says the spread is wide).
5. **Typical**: national, or conditioned on one weak predictor (`rough`).

### 2.5 Dollars of today, and rounding

* Flows (spending, premiums, prices) are brought from the table's dollar year to today with the plan's own inflation
  assumption: `v * (1 + assumptions.inflation) ** (thisYear - dollarYear)`; the basis says "brought to today's prices".
  Balances are not aged (they move with markets, not prices) and say "end of 2025".
* Rounded to the strength so the number does not pretend: close -> 3 significant figures; likely -> 2 significant
  figures for balances, $10 for monthly amounts under $1,000 and $50 above; rough -> 2 significant figures. Rates to
  0.1 point.

---

## 3. Combining dimensions (the core math)

Notation: `m(T, cell)` is the value of table T in a cell; `all` is its all-households row; `I` is income.

### R1. Anchor and ratio (log-additive)

```
guess = m(anchor, cell of the knowns it holds jointly) x  PRODUCT over other known dims d of  r_d(level_d)
r_d(level) = m(T_d, level) / m(T_d, all)
```

The anchor is chosen in this order: a table holding two or more of the person's typed predictors jointly (ACS state x
age, ACS state x mortgage status, CCAoA state x child age x setting, ACS state x bedrooms); else the strongest single
predictor's table (income for spending and balances, age for health and retirement); else the national row.

Validation (prototype `validateStateAge`): ACS household income, predicted `m(state, all) x m(US, age)/m(US, all)`
against the published `m(state, age)`: median |log error| 0.030, p90 0.119, n = 204; state alone 0.243; age alone
0.106. The model is safe for place x age and place x household size; it is the rule for every state-level anchor.

### R2. Income-adjusted ratio (when the dimension also moves income)

Older households, couples and owners earn more, so the raw age ratio partly repeats the income ratio. One step of
backfitting removes the part income explains:

```
r_d(level) = [ m(T_d, level) / m(T_d, all) ]  /  [ g(I_d(level)) / g(I_d(all)) ]
```

where `g(I)` is the same item's income curve and `I_d(level)` the group's typical income from the same survey (CE
profile tables `ce2025_profile_by_*`, SCF `scf2025_family_income` medians by age, CPS `cps_ftyr_income_by_age5`).

* **CE income curve** `g(I) = exp(A + b ln I)`, fitted per item by least squares on the 2nd-5th income fifths
  (`ce2025_spend_by_incomeQuintile` with `ce2025_profile_by_incomeQuintile.incomeBeforeTaxesMean`; the lowest fifth
  is left out: it mixes retirees living on savings and negative business income). Fitted elasticities: living costs
  0.50; utilities 0.26; groceries 0.39; car running costs 0.58; out-of-pocket health 0.38; eating out and fun 0.75;
  shopping 0.63.
* **SCF and Vanguard balances** use `I_d` = the group's median family income (SCF) or the full-time median pay at
  that age (CPS), and the income ratio is interpolated continuously (R6).
* **Clamp** for SCF "among those who have it" tables: the residual is limited to x0.5 to x2. Those tables mix
  different populations per row (investment funds are held by 2.4% of the lowest fifth and 38.5% of the top tenth), so
  an extreme residual means the one-way tables disagree, not that age matters that much; beyond the clamp the guess is
  `rough`. Vanguard tables are participants only (no selection) and are not clamped: Lee's age residual of 2.3 is real
  (savings accumulate with years).

### R3. One ratio per independent axis

Axes: **household type** (CE `householdComposition`: couple only, couple with children by oldest child's age, one
parent, single and other; it carries size, children and partner at once), **place** (CE region; or a state anchor),
**tenure** (owner with mortgage / owner without / renter; only for rent, utilities and home costs). Age is used where
there is no household-type table for the item or where age is the thing that matters (health, retirement, balances).

Validation (`validateComposition`): predicting the six CE household-type totals of living costs from their own mean
income: income curve alone, mean |log error| 0.064; plus household size 0.063; plus size and age 0.078; plus size and
half of age 0.069. Stacked ratios double-count; one household-type ratio is the rule.

### R4. Unknown predictor = the all row

An unknown dimension contributes ratio 1: in a multiplicative model the "all" row is the population average of that
dimension's levels, which is the right marginal. When income is unknown, the anchor itself switches (spending from
`ce2025_spend_by_householdComposition` directly instead of the income curve), which is integrating income out.

### R5. Two guesses of the same thing: precision weighting

When an identity leaves one part free (how far into the loan), it gives a likelihood with its own spread; the
population table is the prior. Their product, on the log scale:

```
ln v = (ln v1 / s1^2 + ln v2 / s2^2) / (1/s1^2 + 1/s2^2),    s = 1 / sqrt(1/s1^2 + 1/s2^2)
```

`combineLog(a, b)` in `core/math/estimate.js`. Example (Sam's car loan, G25): payment-based $12,170 (s 0.70), SCF
vehicle loans for his age and pay $12,840 (s 0.78) -> **$12,500 (s 0.52)**. Two independent sources agreeing is itself
reassuring. **Value-of-information rule:** when the combined guess is still rough (sigma > 0.5) and one listed
one-tap question would at least halve its sigma (it fixes the free part), that question is asked instead of showing a
wide range (G21: "About when did you buy, or last refinance?"; G25: "About when did you get the car loan?").

### R6. No cliffs between bins

Bucketed tables are interpolated, never stepped: income buckets by log-linear interpolation between bucket middles
(Vanguard: <$15k at $10k, $15-30k at $21.2k (geometric middle), ..., $150k+ at $200k); SCF income groups by placing the
income on the SCF percentile scale (`scf2025_actual_income_percentile_cutoffs_derived`, log-linear between cut points)
and interpolating the group values between group middle percentiles (10, 30, 50, 70, 85, 95); age bands at their
middle ages; ACS year-moved-in bins by cumulative counts. A $1 change in pay never jumps a guess.

### R7. Household tables, person fields

SCF is per family; the setup asks retirement savings per adult. Rule: prefer a per-person table (Vanguard
participants, CPS earnings); when only a family figure exists, split it across adults in proportion to their pay, and
say "your household's typical ..., split by pay". One person's typed figure never moves the other's guess: no table
measures how partners' balances go together.

### R8. Additivity

Spending boxes add to the "one rough total"; the total is never estimated separately (a separate median total would
not equal the sum of the box medians, and the person would see two different answers). The rough-total screen shows
the sum of the category guesses.

### R9. A typed figure that the population says is very unlikely gets one question

`typoCheck(typed, est)`: if `|ln(typed / est.value)| / est.sigma > 2.33` (outside the middle 98%) and a common slip
explains it (a percent typed as dollars, a month typed as a year, a missing zero), ask once with one-tap answers. Jordan
typed 5 as "You put in a month": guess $265 (5.5% of $58,000), z = |ln(5/265)|/0.6 = 6.6 -> "Did you mean 5% of your
pay, about $240 a month?" (The deferral spread 0.6 is from vanguard_has2026_deferral_distribution.) The setup's
existing "under $15,000 a year" check becomes this rule.

---

## 4. Uncertainty: how sure, when to say a range, and how guesses chain

### 4.1 Where each spread comes from

| source | spread | how |
|---|---|---|
| SCF holdings (`scf2025_median_value_if_held` with `scf2025_mean_value_if_held`) | per item and group | `sigma = sqrt(2 ln(mean/median))`, the group of the anchor (e.g. retirement accounts 55-64: 1.44; vehicles under 35: 0.72; transaction accounts all: 2.02) |
| Vanguard balances (`vanguard_has2026_401k_balance_by_age`, median and average) | per age band | same formula (under 25: 1.54; 35-44: 1.38; 55-64: 1.45) |
| CPS full-time pay (`cps_ftyr_income_by_age5`, median and mean) | per age band | same formula (15-24: 0.61; 55-59: 0.87) |
| AHS upkeep (`ahs2023_routine_maintenance_spending`) | | median $511, mean $1,363: 1.40 |
| identities | from the free part's range | e.g. months left on a loan from a quarter to three quarters of a typical term |
| CE spending (means only) | **not measured** | declared `SPREAD_UNMEASURED = 0.25` in the module README, labelled as an assumption ("the survey publishes averages only"; CE medians are on the research's unverified list). Used only to decide when a verdict waits (4.6), never drawn as a "most people" range |
| rates (G.19, FHFA, Experian) | not published | no range; strength `likely` |

### 4.2 Propagation through a chain

```
sigma_total^2 = sigma_own^2 + SUM over guessed predictors i of (e_i * sigma_i)^2
e_i = [ ln f(x_i * e^0.1) - ln f(x_i * e^-0.1) ] / 0.2      (numerical elasticity, any estimator)
```

`propagate(sigmaOwn, [{ elasticity, sigma }])` and `elasticity(f, x)` in `core/math/estimate.js`. Example: groceries
from a guessed pay. Sam's pay guess if he had left it blank: $34,800 (s 0.61). Groceries' income elasticity 0.39, so
the pay guess adds 0.39 x 0.61 = 0.24 to the groceries spread: sqrt(0.25^2 + 0.24^2) = 0.35. Still "likely". A pay guess with
no state and no age (s 0.83, CPS 18+) would add 0.32 to groceries (0.41, likely), but eating out is far more sensitive
to pay (elasticity 0.75: 0.62 -> sqrt(0.25^2+0.62^2) = 0.67, rough), so that box says "rough: it depends most on your
pay" and the decisive-guess pointer (4.6) names the pay.

### 4.3 The chain rule

1. A guessed predictor is always passed on with its sigma (4.2), never as typed. `uses` records `"guess"` for it and
   the basis line says so: "Typical for your household (your pay is our guess too)".
2. Conditioning on a guess is conditioning on what it was made from, so it is never worse than ignoring it (the
   alternative, integrating income out, has the whole population's income spread: SCF family income sigma 1.07 against
   0.61 for a state-and-age pay guess). The estimator may do either; the result must be the same within rounding
   (tested on the personas).
3. A guess's sigma can only shrink when a predictor becomes typed (tested: typing pay never widens a spending range).
4. Depth is bounded by the tiers (T0 -> T4): at most four steps, and no estimator reads a later one.

### 4.4 Strength and the range on screen

```
strengthOf(sigma, { identity }) = identity && sigma <= 0.15 ? "close" : sigma === null || sigma <= 0.5 ? "likely" : "rough"
shownRange = strength === "rough" && sigma is measured
low, high  = value * exp(-0.674 sigma), value * exp(+0.674 sigma)      (the middle half)
```

Plain words: "our guess" tag always; "close guess" / "fair guess" / "rough guess" in the basis line; a rough guess
with a measured spread says "Most people like you have between $10,000 and $64,000. We used $26,000."

### 4.5 The tiers (a guess may use only earlier tiers)

| tier | what | examples |
|---|---|---|
| T0 facts | ages, state, household, children, tenure, work status, who pays, what is owned and owed (ticks) | never guessed except child ages (chips) |
| T1 pay | gross pay, pay from take-home, raise | G33-G35 |
| T2 money owned and owed | balances, home value, year bought, loan rates, balances, payments | G12, G15-G32, G40 |
| T3 spending | categories and total, home costs | G01-G10 |
| T4 saving and retirement | contributions, match, stop age, Social Security, retirement spending, health after work, plan-to age | G11, G13, G14, G36-G39 |

`settle` runs tiers in order, so a spending guess always sees the newest pay guess. Inside a tier the order is fixed
and listed in `ESTIMATORS` (T2: home value G18, year bought G19, mortgage rate G20, property tax G23, home insurance
G24, then mortgage owed G21 and payment G22; loans; balances). A test asserts no estimator reads a later one.

### 4.6 Verdicts that wait, and the guess that decides

A headline figure computed from a plan with guesses gets the same treatment, done by the page's own compute (no new
math in views):

```
rangeOf(fn, plan, guessedPaths) -> { low, mid, high, decisive: path }
```

`fn` is the page's own compute of the figure (left over, cushion months). Each guessed input is moved to its 25th and
75th value (guessed spending categories together, as one household spends high or low across the board: the
conservative, fully correlated case); the figure's range is the result, and `decisive` is the input whose swing moves it
most. If the range crosses the verdict's line, the tile says, for Sam:

> **Left over each month: somewhere between $670 short and $300 spare.** Most of your spending is our guess. Your
> rent decides it: **type your rent** (box).

Sam's numbers: take-home about $3,220 a month (pay $48,000, our 5% 401(k) guess, no Texas income tax); spending
guesses $2,860 + card $86 + car loan $420 = $3,370; middle -$150; with the guessed categories at their 25th/75th
(x0.85 / x1.18) the range is -$670 to +$300, crossing 0; rent is 37% of the guessed spending, the largest swing. Next
best action's dates and Pay off debts' "Use $1,630 a month" do not appear until the range clears 0.

### 4.7 Calibration (is a "middle half" really the middle half?)

`tools/guess-backtest.mjs`: for every invented household in `qa/`, blank each typed field in turn, guess it from the
rest, and report per estimator the median |log error| and the share of true values inside the shown middle half
(target 50%; 35-65% passes; outside fails the test and the estimator's sigma is wrong). Run in `npm test` on the
bundled households; the README table of each estimator shows its last result.

---

## 5. How guesses live in the plan and follow the knowns

### 5.1 The ledger

`plan.guesses` (new optional section; read as `plan.guesses ?? {}`; no version bump):

```js
guesses: {
  "expenses[setup-x-groceries].amount": { k: "spend.groceries", v: 340, s: 0.25, at: "2026-11-02", d: "2026-11-02" },
  "debts[setup-debt-car-loan].rate":    { k: "debt.carRate",    v: 0.112, s: null, at: "2026-11-02", d: "2026-11-02" },
}
```

`k` estimator key, `v` the value written (rounded), `s` its sigma, `at` when written, `d` the tables' read date.
Path grammar: `section[id].field`, `section.sub[id].field` or a plain dotted path (`retirement.spendingMonthly`,
`whatIfs.vehicle.price`); `[id]` matches the list item with that `id`, and for `debts` also `accountId` (so the debt
of account X is `debts[X].rate`). `readPath` / `writePath` in the guesses compute.

### 5.2 Rules

1. **Created only by a screen** where the person saw the placeholder and left the box blank (`markGuess`). Settle never
   creates a guess, so nothing appears that the person did not see.
2. **A guess is a guess only while the field still equals `v`** (generalises `rateGuessed` / `paymentGuessed`). If it
   differs, the person typed it: the entry is dropped and never comes back.
3. **Follow while untouched:** on every `store.update`, `settle(draft, { today })` recomputes each entry in tier order;
   if the new rounded value differs, it writes it and updates `v`. The save's notice adds "and 2 guesses updated from
   your answer" (the view reads the returned `changed`).
4. **"That's right"** on the Our guesses page (`confirmGuess`) drops the entry: the figure is now the person's.
5. **Record removed** -> entry removed.
6. Existing `debts[].rateGuessed` / `paymentGuessed` stay (journeys and Where you stand read them); `markGuess` on a
   debt rate or payment also writes them, and settle keeps them equal. Later they can be read from the ledger.
7. Idempotent: settling twice changes nothing (tested).

### 5.3 Settle in code

```js
// modules/overview/guesses/compute.js
export function settle(draft, { today, extra = [] } = {}) {
  const led = draft.guesses ?? {};
  const changed = [], dropped = [];
  for (const [path, e] of byTier(Object.entries(led), extra)) {
    const cur = readPath(draft, path);
    if (cur === undefined) { delete led[path]; dropped.push(path); continue; }      // the record is gone
    if (!same(cur, e.v)) { delete led[path]; dropped.push(path); continue; }        // the person typed over it
    const est = estimate(draft, e.k, { today, path, extra });
    if (!est || same(est.value, e.v)) continue;
    writePath(draft, path, est.value);
    led[path] = { ...e, v: est.value, s: est.sigma, at: today, d: est.dataAsOf };
    mirrorDebtFlags(draft, path, est.value);
    changed.push({ path, from: e.v, to: est.value });
  }
  if (Object.keys(led).length) draft.guesses = led; else delete draft.guesses;
  return { changed, dropped };
}
```

---

## 6. The catalogue: the 40 most valuable guesses

Ranked by (how often blank or unknown in the inventory and walks) x (how much the headline figures move) x (how good
the table is). Each entry: **field** (where asked; plan path) / **formula** / **tables** / **conditioning order**
(first known wins; each step drops to the next when unknown) / **basis line** (on screen) / **worked examples**: S =
Sam (24, single, Texas, $48,000 salary, rents, car loan $420 a month, card $3,000, 401(k) through work, everything
else blank); J = Jordan (41, single parent of two aged 7 and 3, Ohio, $58,000 salary, owns, mortgage payment $1,100
typed, daycare $900 typed, rest blank); N = Pat (61, $85,000) and Lee (59, $40,000), married, Arizona, no children,
home $450,000, $500,000 typed in Pat's 401(k) box (they meant both of theirs), cash $28,000, mortgage payment
$1,600 typed with the balance and rate blank, Lee's 401(k), contributions, match and spending blank.

Shared names: `g_item(I)` the CE income curve; `rComp`, `rRegion`, `rTenure` the income-adjusted ratios (R2) from
`ce2025_spend_by_householdComposition`, `_by_region`, `_by_housingTenure`; `today$(v, y)` brings a flow to today (2.5);
`/12` makes a month.

### A. Spending (tier T3): the biggest error today, every household has them

**G01 Rent** (setup Q6 "Rent"; Expenses housing; `expenses[setup-x-housing].amount`, renters)
Formula: `today$(ACS gross rent median(state), 2025) x contractShare x rentRatio`, where
`contractShare = rented / (rented + renter utilities without phone)` from `ce2025_spend_by_housingTenure` (renter):
17,495 / (17,495 + 2,011) = 0.897 (gross rent includes utilities, which have their own box), and
`rentRatio = g_rentPerRenter(I) x rComp / g_rentPerRenter(I_all)` with rent per renter = `rentedDwellings / pctRenter`
per CE cell.
Tables: acs2025_median_gross_rent_by_bedrooms_by_state (bedrooms "all"), ce2025_spend_by_housingTenure,
ce2025_spend_by_incomeQuintile, ce2025_profile_by_incomeQuintile, ce2025_spend_by_householdComposition.
Conditioning: state -> income (typed) -> household type -> (none: US median $1,557).
Basis: "Typical rent before utilities for a one-person home in Texas earning $48,000 (Census and U.S. spending survey,
2025)."
S: 1,515 x 1.03 x 0.897 x 0.753 = **about $1,050** (likely). J, N: owners, see G02.

**G02 Home costs besides the mortgage** (setup Q6 owners; `expenses[setup-x-housing].amount`)
Formula: if a mortgage payment is typed or guessed with escrow (the setup's help says to include tax and insurance),
`HOA + upkeep`; if no mortgage, `property tax (G23) + home insurance (G24) + HOA + upkeep`. HOA by the hurdle rule:
skip under 35% of owners, ask 35-65% ("Do you pay an HOA or condo fee?", with the state's median fee as the
placeholder), assume over 65%. Upkeep: `today$(AHS median routine maintenance $511, 2023)/12` (what owners actually
spend; Fannie Mae's 1-4% of value is a reserve recommendation and is shown as advice on Home, not as the guess).
Tables: acs2025_hoa_condo_fee_by_state, ahs2023_routine_maintenance_spending, plus G23/G24.
Conditioning: mortgage (yes/no, escrow) -> state -> home value.
Basis: "Upkeep most owners spend in a year, about $560 (Census housing survey, 2023); most Ohio owners pay no HOA fee."
S: n/a. J: HOA skip (17.8%), upkeep **about $50** (escrow in the $1,100). N: Arizona 48.8% -> ask the HOA question
(typical $98 a month); upkeep $50; tax and insurance in the mortgage payment if they pay one (they ticked a mortgage).

**G03 Utilities and phone** (setup Q6; `expenses[setup-x-utilities].amount`)
Formula: `today$(g_utilities(I) x rComp x rRegion x rTenure, 2025)/12 x stateEnergy`, `stateEnergy` = (EIA state
electric bill + gas bill) / (US electric + gas), applied to the energy share of the category.
Tables: ce2025_spend_by_incomeQuintile (utilities), _by_householdComposition, _by_region, _by_housingTenure,
eia2025_residential_electric_bill_by_state, eia2024_residential_natural_gas_bill_by_state_DERIVED.
Conditioning: income -> household type -> tenure -> region/state.
Basis: "Power, water, gas, internet and phones for a renter living alone in Texas (U.S. spending survey 2025, energy
prices EIA 2025)."
S: **about $240** (renters often have some utilities in the rent: tenure ratio 0.71). J: **about $420**. N: **about
$510**.

**G04 Groceries** (setup Q6; `expenses[setup-x-groceries].amount`)
Formula: `today$(g_food(I) x rComp x rRegion, 2025)/12` over food at home + housekeeping supplies (the row's help
says "food and household things"). Context only, not a floor: USDA Thrifty plan cost for the household's ages
(sexes averaged) x size adjustment, shown when the guess is below it ("A low-cost healthy diet for your family costs
about $700 (USDA, September 2026)").
Tables: ce2025_spend_by_incomeQuintile (foodAtHome, housekeepingSupplies), _by_householdComposition, _by_region;
usda_food_plans_sep2026, usda_food_plan_household_size_adjustment.
Conditioning: income -> household type -> region.
Basis: "What a single parent with two children earning $58,000 in the Midwest typically spends on groceries (U.S.
spending survey, 2025)."
S: **about $340** (USDA Thrifty for one adult: $344). J: **about $600** (USDA Thrifty for her family $700: shown as
context). N: **about $810**.

**G05 Car, gas and transit** (setup Q6; `expenses[setup-x-transport].amount`)
Formula: running costs `today$(g_run(I) x rComp x rRegion, 2025)/12` over gasoline, maintenance and repairs, vehicle
rental/leases/licences and public transport (not purchases or loan interest: loans are on What you owe) **plus**
insurance `today$(NAIC average expenditure(state), 2023)/12 x cars`, cars = vehicle accounts, and for a couple whose
setup has a single "A car" box, the rounded CE average for their household type (married couples without children:
2.3 -> 2; the car's value still counts once, as ticked).
Tables: ce2025_spend_by_incomeQuintile, _by_householdComposition, _by_region, naic2023_auto_insurance_by_state,
ce2025_profile_by_householdComposition (vehicles).
Conditioning: cars (ticked) -> income -> household type -> state.
Basis: "Gas, repairs and insurance for one car in Texas (U.S. spending survey 2025; insurance NAIC 2023, brought to
today's prices)." The basis adds "insurance has risen faster than prices since 2023" because NAIC is the newest table.
S: $260 + $130 = **about $390**. J: $420 + $90 = **about $500**. N: $730 + 2 x $120 = **about $970**.

**G06 Insurance and health** (setup Q6; `expenses[setup-x-insurance].amount`)
Formula: premium + out-of-pocket. Premium: if working for an employer, the hurdle question "Health cover through work?"
(58% take part: ask); yes -> KFF worker contribution (single or family by household); no or not working before 65 ->
the state's benchmark plan for the age (KFF 40-year-old x CMS age curve), before help with the cost; Medicaid/CHIP ->
0. Out-of-pocket: `today$(g_oop(I) x rComp, 2025)/12` over medical services, drugs and supplies.
Tables: kff_ehbs2026_premiums, bls_ncs_medical_premiums_2026, kff_aca_benchmark_premium_40yo, cms_aca_age_rating_curve,
ce2025_spend_by_* (medicalServices, drugs, medicalSupplies).
Conditioning: cover answer -> work status -> household (single/family) -> age -> state.
Basis: "What workers pay for single cover through work, plus typical doctor and medicine costs (KFF 2026, U.S.
spending survey 2025)."
S: through work $139 + $100 = **about $240** (if no: Texas benchmark at 24 is $577 before help). J: family cover $623 +
$120 = **about $750**; the cover question matters here (Medicaid/CHIP for the children would make it about $120), so
it is the decisive guess for her month (4.6). N: one family plan $623 + $290 = **about $910**.

**G07 Childcare and school** (setup Q6, only with children; `expenses[setup-x-childcare].amount`)
Formula: `SUM over children of today$(CCAoA(state, setting, ageBucket), 2025)/12`; buckets infant (<1), toddler (1-2),
four-year-old (3-5), before/after school (6-12), none at 13+; setting center (the published default; a chip offers
"family home" with its own price).
Tables: ccaoa2025_childcare_annual_price_by_state (NDCP 2022 as fallback for missing states:
ndcp2022_childcare_weekly_price_by_state, ndcp_childcare_weekly_price_fallback_older_years, aged by the plan's
inflation).
Conditioning: child ages -> state -> setting.
Basis: "Full-time center care in Ohio for a 3-year-old, and before and after school for a 7-year-old (Child Care Aware,
2025)."
J typed $900 (the guess would be $10,552 + $6,162 = **about $1,430**; the typo check passes: within range).

**G08 Eating out and fun** (setup Q6; `expenses[setup-x-dining].amount`)
Formula: `today$(g_fun(I) x rComp x rRegion, 2025)/12` over food away from home, entertainment, alcoholic beverages.
Tables: ce2025_spend_by_incomeQuintile, _by_householdComposition, _by_region.
Conditioning: income -> household type -> region.
Basis: "Restaurants, outings and hobbies for someone living alone in the South earning $48,000 (U.S. spending survey,
2025)."
S: **about $310**. J: **about $500**. N: **about $1,030** (elasticity 0.75: this one grows most with income).

**G09 Shopping and everything else** (setup Q6; `expenses[setup-x-shopping].amount`)
Formula: as G08 over apparel, personal care, furnishings, miscellaneous, reading, tobacco (education and gifts to
charity are left out: they have their own goal pages).
Basis: "Clothes, personal care, things for the home and subscriptions, typical for your household (U.S. spending
survey, 2025)."
S: **about $300**. J: **about $620**. N: **about $780**.

**G10 One rough total** (setup Q6 "If you're not sure"; `expenses[setup-x-total].amount`)
Formula: the sum of G01-G09 for the rows that apply (R8). Never a separate estimate.
Basis: "The sum of what households like yours typically spend, row by row: open the rows to see each."
S: **about $2,860** (the static "$ 3,500" placeholder goes). J: **about $3,450** besides the $900 daycare and the
mortgage. N: **about $5,020**.

**G11 Spending once you stop working** (setup Q6 "Once you stop working"; `retirement.spendingMonthly`)
Formula: for anyone under 50, not asked (walk-young top 15): the existing `retireDefault` (bills without childcare
and loans that end) is written silently as a guess. From 50: `(G03 + G04 + G05 + G08 + G09) x 0.861 + home costs that
continue (G23 + G24 + G02 upkeep/HOA; the mortgage only if it outlasts work) + health after work (G38)`, where 0.861 =
CE 65-74 / 55-64 for those categories (`ce2025_spend_by_ageOfReferencePerson`; gas 0.76, clothes 0.67, eating out
0.84, entertainment 0.87).
Tables: ce2025_spend_by_ageOfReferencePerson, plus G23, G24, G38.
Conditioning: today's spending (typed rows first, then guesses) -> ages -> state.
Basis: "Households 65-74 spend about 14% less than at 55-64 on everyday things; home costs and health cover added
(U.S. spending survey 2025, CMS 2026)."
N: ($510 + $810 + $970 + $1,030 + $780) x 0.861 = $3,530 + home $330 + Medicare from 65 for two $880 + out-of-pocket
$290 = **about $5,000 a month** at 65; the two years on Marketplace cover before Medicare are G38 and are shown as
their own line, not averaged in.

### B. Retirement saving (tier T2/T4): the second biggest error

**G12 401(k) balance** (setup Q4b "Saved so far" through work; `accounts[setup-have-retire-<person>].balance`)
Formula (R2, per participant):
`median_all x [vgInc(pay) / median_all] x [ (vgAge(band) / median_all) / (vgInc(cpsFT(age)) / median_all) ]`,
`vgInc` interpolated log-linearly over the Vanguard income buckets, `cpsFT(age)` the full-time median pay at the
person's 5-year age band. Sigma from the age band's average/median.
Tables: vanguard_has2026_401k_balance_by_age (groupBy all, age, income), cps_ftyr_income_by_age5.
Conditioning: age -> pay -> (job tenure is in the table but not in the plan) -> national median $44,115.
Basis: "Most people 24 years old earning $48,000 have between $1,100 and $8,600 in a work plan (Vanguard, end of
2025). We used $3,100."
S: **$3,100, rough, $1,100-$8,600** (and the account is kept, so the contribution and match steps stay). J: **$26,000,
rough, $10,000-$65,000**. N (Lee, 59, $40,000): **$29,000, rough, $11,000-$76,000**. A couple's screen also offers
"For both of us, together" (the walk-near couple typed their joint "about half a million" in Pat's box); a joint figure
is split by pay (R7): $500,000 x 85/125 = **Pat $340,000, Lee $160,000**. When one partner's box holds a figure and the
other's is blank, one tap asks "Is the $500,000 Pat's alone, or both of yours?" before Lee's guess is written.

**G13 You put in a month** (Q4b; `retirement.contributions[setup-contrib-<person>].amount`)
Formula: deferral rate by R2 on `vanguard_has2026_deferral_by_income_age` (age and income), times the median/average
ratio of the whole table (6.6 / 7.6 = 0.868, `vanguard_has2026_headline`) to turn the published averages into a
median; times pay / 12. The box offers "% of pay" beside "$ a month" (walk-parent) and the typo check (R9) runs on it.
Tables: vanguard_has2026_deferral_by_income_age, vanguard_has2026_headline, vanguard_has2026_deferral_distribution.
Conditioning: has a work plan (ticked) -> age -> pay. Hurdle: 83% of those eligible take part -> assume.
Basis: "People your age on your pay usually put in about 5% (Vanguard 2026)."
S: 5.0% -> **about $200**. J: 5.5% -> **about $270** (her typed "5" triggers "Did you mean 5% of your pay, about $240?").
N: Pat 8.4% -> **about $600**; Lee 6.3% -> **about $210**.

**G14 Your employer adds a month** (Q4b; `...contributions[...].employerMatch`)
Formula: `MATCH_VALUE x min(1, deferral / MATCH_NEEDED) x pay / 12` with MATCH_VALUE 4% (median value of the promised
match) and MATCH_NEEDED 6% (median deferral needed for all of it), both `vanguard_has2026_headline`. The match
*formula* shown in words is the mode, "50% of the first 6% of pay" (12% of plans, the most common,
`vanguard_has2026_top_match_formulas`). Hurdle: 96% of plans add money -> assume. Next best action's match step uses
it ("put in 6% ($240 a month) to likely get about $160").
Tables: vanguard_has2026_headline, vanguard_has2026_top_match_formulas.
Basis: "Most work plans add about 4% of pay when you put in 6% (Vanguard 2026)."
S: 4% x 5.0/6 -> **about $130**. J: **about $180**. N: Pat **about $280**, Lee **about $130**.

**G15 Retirement savings on your own (IRA)** (Q4b "On my own"; `accounts[...].balance`, type ira)
Formula: SCF retirement accounts median among holders by R2 (income percentile, age), clamped residual, split by
pay for a couple (R7).
Tables: scf2025_median_value_if_held, scf2025_mean_value_if_held (retirementAccounts), scf2025_family_income,
scf2025_actual_income_percentile_cutoffs_derived.
Basis: "Households your age and pay who have retirement accounts typically hold ... (Federal Reserve, 2025)."
S (had he picked "On my own"): **$13,000, rough, $5,600-$32,000**.

**G16 Investments outside retirement** (Q4b; `accounts[setup-have-invest].balance`)
Formula: SCF pooled investment funds (and stocks held directly when "stocks" is said) median among holders by R2,
residual clamped (this is where the clamp bites: funds are held mostly by top earners).
Tables: scf2025_median_value_if_held (pooledInvestmentFunds, stocksDirectlyHeld), scf2025_pct_families_holding.
Basis: "Typical among households your age and pay who invest (Federal Reserve, 2025). A rough guess."
N (had they ticked it): income ratio $98,000, age residual clamped at x2 -> **$200,000, rough** (the clamp is reported
in the README test as the case it exists for).

**G17 Cash in the bank** (Q4b checking + savings; `accounts[setup-have-checking|savings].balance`)
Formula: SCF transaction accounts median by R2 (household); when both boxes are blank, checking holds one month of
take-home pay (a working balance worked out from the plan itself, labelled as such; T1, so no spending guess is
needed) and savings the rest; when one is typed, the other is `max(0, guess - typed)` only if that is above $100,
else nothing is written and the box stays empty.
Tables: scf2025_median_value_if_held, scf2025_mean_value_if_held (transactionAccounts).
Basis: "Households your age and pay typically keep between $860 and $8,300 in the bank (Federal Reserve, 2025)."
S typed $2,000 (guess $2,700). J: **$2,700, rough, $760-$9,800**. N typed $28,000 (guess $16,000).

### C. The home (tier T2): wrong rates and dropped mortgages

**G18 Home value** (Q4b and Q5b; `accounts[setup-have-home].balance`)
Formula: worked out when price and year are known: `price x HPI(state, now)/HPI(state, year bought)` (close).
Otherwise R1 + R2: `ACS median value(state, mortgage status) x rInc(SCF primaryResidence) x rAge(SCF, income-adjusted)`.
Tables: fhfa_hpi_at_state_annual, acs2025_median_home_value_by_state_and_mortgage_status, scf2025_median_value_if_held
(primaryResidence), scf2025_mean_value_if_held.
Conditioning: price + year (typed) -> state + mortgage status -> income -> age.
Basis: "Typical for an Ohio home with a mortgage, for a household earning $58,000 (Census and Federal Reserve, 2025)."
J: 270,800 x 0.742 x 1.047 = **$210,000, rough, $122,000-$362,000** (the static "$300,000" placeholder goes). With
Jordan's later "bought for $150,000 in June 2018": 150,000 x 674.68/402.30 = **$252,000, close**.

**G19 Year bought** (Home page, and the setup's one-tap follow-up when a mortgage guess is rough; `property[...].purchaseDate`)
Formula: owners' year-moved-in median for the person's age, interpolated between the ACS age groups at their middle
ages (15-34 at 25: 2022.1; 35-64 at 50: 2014.7; 65+ at 75: 2001.6), shifted by the state's owners' median minus the
national (Ohio -1, Arizona +2, Texas +1); never before age 22.
Tables: acs2025_year_moved_in_by_age_us, acs2025_median_year_moved_in_by_state.
Basis: "Owners your age in Ohio typically moved in around 2016 (Census, 2025)."
J: **2016**. N: **2011**.

**G20 Mortgage rate** (Q5b "Interest rate"; `debts[setup-debt-mortgage].rate`)
Formula: the state's average contract rate on mortgages people already have; bought in 2025 or later: the 2025 new
purchase-loan rate for the state (FHFA) or this week's Freddie Mac 30-year rate for a loan in the last few months.
Tables: mortgage_outstanding_fhfa_by_state_2026q2, mortgage_new_purchase_fhfa_by_state_2025,
mortgage_rate_pmms_weekly_2026.
Conditioning: year bought (typed or G19) -> state -> national 4.5%.
Basis: "The average rate on mortgages Ohio homeowners already have is 4.6% (FHFA, mid-2026)."
J: **4.6%** (was 7.24%: Jordan's interest, payoff date and "pay the mortgage down early (a sure 7.2%)" all change).
N: **4.3%**. S: n/a.

**G21 Mortgage still owed** (Q5b "Still owed"; `accounts[setup-owe-mortgage].balance`; the row is kept, never dropped)
Formula, in order: (a) payment typed: principal and interest = payment - escrow (G23 + G24, when the help's "including
tax and insurance" applies) -> `pv(rate/12, monthsLeft, P&I)`, monthsLeft = 360 - months since G19; its spread from
G19's middle half, combined with the SCF prior (R5). (b) nothing typed: amortise the typical purchase loan
(`price then = value x HPI(year)/HPI(now)`, x the state's 2025 first-lien loan-to-value) to today, combined with the
SCF mortgage median for age and income (R5); the amortised figure's spread comes from G19's middle half (for a
61-year-old in Arizona, bought 2008-2023). While the result is rough, the value-of-information question "About when did
you buy, or last refinance?" (chips: before 2010 / 2010-2019 / 2020 or later) is offered.
Tables: mortgage_outstanding_fhfa_by_state_2026q2, mortgage_new_purchase_fhfa_by_state_2025, fhfa_hpi_at_state_annual,
acs2025_effective_property_tax_rate_by_state, naic2023_homeowners_premium_by_state, scf2025_median_value_if_held
(mortgageOnPrimaryResidence), acs2025_year_moved_in_by_age_us.
Basis: "Worked out from your $1,100 payment at Ohio's typical 4.6%, about 10 years into a 30-year loan."
J: $1,100 - $214 - $102 = $784 P&I, 240 months left -> $122,900; with SCF prior ($171,000, s 0.74) -> **about
$127,000, likely** (the walk's own estimate was $125,000-$135,000). N: $1,600 - $166 - $109 = $1,325 P&I at 4.3%,
bought about 2011 so 169 months left -> $167,800 (bought 2008: $144,000; 2023: $249,000; s 0.41); with SCF for 55-64
earning $125,000 ($196,000, s 0.87) -> **about $170,000, likely** (today the whole mortgage is dropped: "owe $0",
"Debt-free now"). The year question stays on the Home page: a 2020-21 refinance, which the walk thought likely, would
make it about $240,000. With nothing typed at all (no payment): amortised $79,000 vs SCF $196,000 -> about $125,000,
rough, $83,000-$191,000, and the year question is asked (it halves the spread).

**G22 Mortgage payment** (Q5b "Paid a month"; `debts[setup-debt-mortgage].minPayment`)
Formula: `pmt(rate/12, monthsLeft, balance)` + escrow (G23 + G24). Replaces the 30-year level payment on today's
balance that the setup uses now (which overstates the term on an old loan).
Tables: as G20, G21, G23, G24.
Basis: "A loan of about $125,000 at 4.3% with about 14 years left, plus Arizona's typical tax and insurance."
N typed $1,600. Had they left it blank too: $991 + $166 + $109 = **about $1,270, rough** (it follows G21: once the
year is tapped, both sharpen).

**G23 Property tax** (Home; Q6 owners without escrow; `property[...].propertyTax`, `taxes.itemized.propertyTax`)
Formula: `value x ACS effective rate(state)` (median taxes / median value).
Tables: acs2025_effective_property_tax_rate_by_state.
Basis: "Ohio homes pay about 1.2% of their value a year (Census, 2025)."
J: 1.223% x $210,000 = **about $210 a month**. N: 0.443% x $450,000 = **about $170**.

**G24 Home insurance** (Home; `property[...].insurance`)
Formula: `today$(NAIC HO-3 average premium(state), 2023)/12`.
Tables: naic2023_homeowners_premium_by_state.
Basis: "The average Ohio homeowner policy, brought to today's prices (NAIC 2023; premiums have risen faster since)."
J: **about $100**. N: **about $110**.

### D. Loans and cards (tier T2)

**G25 Car loan still owed, from the payment** (Q5b; `accounts[setup-owe-car-loan].balance`; never dropped)
Formula: classify new or used by the typed payment (the class whose average payment is nearer in log terms:
Experian new $765, used $542); `pv(rate/12, term/2, payment)` with that class's average rate and term (half the term
left is the median for a loan of unknown age), its spread from a quarter to three quarters of the term; combined with
SCF vehicle loans for age and pay (R5).
Tables: auto_loan_terms_experian_q2_2026, scf2025_median_value_if_held (vehicleLoans), scf2025_mean_value_if_held.
Basis: "Worked out from your $420 payment: a typical used-car loan about halfway through (Experian 2026, Federal
Reserve 2025)."
S: used ($420 is nearer $542); 11.2%, 34 of 68 months left -> $12,170; SCF $12,840 -> **about $12,500, rough,
$6,600-$17,000** (one tap "When did you get it?" makes it close).

**G26 Car loan rate** (Q5b; `debts[setup-debt-car-loan].rate`)
Formula: new: Fed G.19 72-month bank rate (7.17%); used: Experian used average (11.19%); unknown: classify by
payment (G25) or by balance vs the average amounts financed (new $43,610, used $27,852), else the new-car rate with
"rough". Credit tier is never asked (no score in the plan).
Tables: auto_personal_rate_fed_g19, auto_loan_terms_experian_q2_2026, auto_rate_by_credit_tier_experian_q2_2026.
Basis: "Typical rate on a used-car loan (Experian, mid-2026)."
S: **11.2%** (the setup's 7.17% was the new-car rate).

**G27 Car loan payment, from the balance** (Q5b; `debts[...].minPayment`)
Formula: `pmt(rate/12, term/2, balance)` with G26's class.
Tables: as G25.
Example: a $20,000 balance typed, rate blank, classified new -> 7.17%, 35 months left -> **about $620**.

**G28 Card rate** (Q5b; `debts[setup-debt-credit].rate`)
Formula: G.19 "accounts assessed interest" (22.36%); paid in full each month: no interest.
Tables: cc_apr_fed_g19.
Basis: "The average rate on cards that charge interest (Federal Reserve, August 2026)."
S, J: **22.4%** (unchanged; now shown in the box as the placeholder instead of "e.g. 24.9").

**G29 Card payment** (Q5b; `debts[setup-debt-credit].minPayment`)
Formula: `max($40, balance x 1% + balance x rate / 12)`, never more than the balance (the most common formula and
floor, CFPB). Fixes the missing $40 floor in `typicalPayment`.
Tables: card_minimum_payment_rule_cfpb.
Basis: "The usual minimum: 1% of what you owe plus the month's interest, at least $40 (CFPB, 2025)."
S: 3,000 x 1% + 3,000 x 22.36%/12 = **$86**.

**G30 Card balance** (Q5b "Still owed" when cards are ticked; `accounts[setup-owe-credit].balance`)
Formula: SCF credit card balances median among holders, R2.
Tables: scf2025_median_value_if_held, scf2025_mean_value_if_held (creditCardBalances).
Basis: "Typical card balance for households your age and pay that carry one (Federal Reserve, 2025)."
J (had she ticked cards): **about $1,800, rough**.

**G31 Student loans still owed** (Q5b; `accounts[setup-owe-student].balance`)
Formula: SCF education loans median among holders, R2 (the curve is flat by age: $25,300-$27,600).
Tables: scf2025_median_value_if_held (educationLoans), student_loan_federal_portfolio_by_age (cross-check: average
per borrower 25-34 is $33,300).
Basis: "Typical student loan balance for borrowers your age (Federal Reserve, 2025)."
S (had he ticked it): **about $28,000, rough**.

**G32 Student loan rate and payment** (Q5b; `debts[setup-debt-student]`)
Formula: rate: the federal undergraduate rate for the award year the person was about 20 (only 2025-26 and 2026-27
are in the tables; earlier years fall back to 6.52% with "rough"); payment: the 10-year Standard plan (existing).
Tables: student_loan_rates_federal.

### E. Pay (tier T1)

**G33 Pay before tax** (Q2; `income[setup-pay-<person>].amount`)
Formula: `ACS full-time median(state) x CPS full-time median(5-year band) / CPS full-time median(15+)`; self-employed:
the same with "rough"; not full time: the "all people with earnings" rows.
Tables: acs_median_earnings_by_state, cps_ftyr_income_by_age5.
Conditioning: state -> age (ask ages first, section 8) -> national FT median $63,454.
Basis: "Typical full-time pay at 24 in Texas: most earn between $23,000 and $52,000 (Census, 2025)."
S (if blank): **$35,000, rough, $23,000-$52,000**. Lee (if blank): 61,239 x 78,470/70,970 = **$68,000, rough**.

**G34 Pay from take-home** (Q2 alternative "I know what lands in my account"; same path)
Formula: solve `takeHome(gross) = typed` by bisection with the plan's own tax engine (core/math/tax.js, FICA, the
state's flat rate where known); the 401(k) share is the typed one, else Vanguard's median deferral of 6.6% when a
work plan is ticked (not G13, which is a later tier). Close.
Example: Sam's $1,485 every two weeks -> **about $48,000 a year**.

**G35 Yearly raise** (Income growth; `income[...].growth`)
Formula: Atlanta Fed long-run median by age group (16-24 7.2%, 25-54 3.93%, 55+ 2.56%), stepping down as the person
crosses an age group in the projection.
Tables: atlfed_wage_growth_by_age_longrun_derived.
Basis: "Typical yearly pay rise at your age, 1997-2025 (Atlanta Fed)."
S: **7.2% to 25, then 3.9%**. J: **3.9%**. N: **2.6%**.

### F. Retirement (tier T4)

**G36 Age you stop working** (Q3 stepper; `household.people[...].retirementAge`)
Formula: the median expected age of workers (65); someone already older: the median of the expected ages above their
age (by the published bands); the basis also says what actually happens (half of retirees had stopped by 62; 46%
earlier than planned).
Tables: rcs2026_retirement_age.
Basis: "Most workers plan to stop at 65; many stop sooner (EBRI 2026)."
S, J: **65**. N typed 63 and 61.

**G37 Social Security without a pay figure** (Q3 "Estimate it for me" with no pay; `retirement.socialSecurity[...].monthlyAtFRA`)
Formula: with pay: the existing `estimateSocialSecurity` (worked out, close). Without: the average retired-worker
benefit (Sept 2026, $2,088.79), age-adjusted by the December 2025 averages by age band; a spouse with no work record:
the spouse average ($986.68).
Tables: ssa_snapshot_2026_09_average_benefit, ssa_retired_worker_benefit_by_age_sex_2025.
Basis: "The average check for retired workers today (Social Security, September 2026). Your statement at ssa.gov is
exact."

**G38 Health cover from stopping work to 65, and after** (Retirement health; `retirement.aca.benchmarkMonthly`, `retirement.medicare.*`)
Formula: before 65: `KFF benchmark(state, 40-year-old) x curve(age)/curve(40)`, before help with the cost (enhanced
help expired; `aca_premium_tax_credit_law_status`; the help itself is worked out by retirement/healthcare from income
with `irs_ptc_applicable_percentage`). From 65, each: Part B standard premium + Part D base premium + the state's average
Medigap Plan G premium.
Tables: kff_aca_benchmark_premium_40yo, cms_aca_age_rating_curve, cms_medicare_2026_parts_ab,
cms_medicare_part_d_parameters, kff_medigap_average_premium_2025.
Basis: "Marketplace cover in Arizona for a 61-year-old, before help (KFF 2027 prices); Medicare from 65 with a
supplement (CMS, KFF)."
N: Lee from 61: 609 x 2.810/1.278 = **about $1,340 a month** before help; Pat from 63: **about $1,410**; from 65 each
$202.90 + $38.99 + $196.74 = **about $440**. This is the line the walk said was missing from "Once you stop working".

**G39 How long to plan for** (Assumptions plan-to age; `assumptions.planEndAge`, per household)
Formula: the age at which the chance that anyone in the household is still alive falls to 10%, from the period life
table with men's and women's survivors averaged (sex is not in the plan; `retirement.longevity[..].sex` refines it
when given).
Tables: ssa_period_life_table_2023.
Basis: "There is about a 1-in-10 chance one of you lives past this age (Social Security life table)."
S, J: **95** (the current default is right for a single person). N: **Pat 99 / Lee 97** (a couple plans longer).

**G40 Car value** (Q4b "Your car"; `accounts[setup-have-car].balance`)
Formula: SCF vehicles median among families that have one, by R2 (income, age), divided by the household's vehicles
(CE vehicles for the age or household type), so it is one car's value; spread from SCF mean/median.
Tables: scf2025_median_value_if_held, scf2025_mean_value_if_held (vehicles), ce2025_profile_by_ageOfReferencePerson.
Conditioning: income -> age -> household type -> national $26,000 per family.
Basis: "What a car is typically worth for people your age and pay: most between $7,500 and $20,000 (Federal Reserve,
2025)."
S: $15,800 per family / 1.3 vehicles = **$12,000, rough, $7,500-$20,000** (the walk's "net worth -$21,000, behind"
came from the car being left out while its loan counted). N: $40,700 / 2.2 = **about $18,000 a car, rough**.

### The next ones (short list, same machinery)

HOA (in G02); upkeep (in G02); life cover through work (median 1x pay; 59% of private workers have access, 98% of them
take it: bls_ncs_life_insurance_access_2026, bls_ncs_life_insurance_benefit_2026); long-term disability through work
(bls_ncs_long_term_disability_2026); out-of-pocket medical for insurance/health "expected" (CMS NHE by age, 2020, aged);
charitable giving (CE cash contributions by income: goals/charitable); renters insurance (NAIC HO-4 by state, $201 a
year in Texas); other loan rate (G.19 personal 11.9%, existing); home growth for balance/projection (FHFA state
10-year change); children's birth years (no table: chips "under 5 / 5-12 / 13-17", their middle ages).

---

## 7. Hidden defaults: what happens to them

From the inventory's 146 hidden defaults: those with a table above become estimators (debt rates and payments, ACA
benchmark national -> state, Part D base, the 401(k) "assumed common match" in career/benefits -> G14, emergency
months stays an advice rule, home liability $100,000 stays an example). Property and car `DEFAULTS` prefilled as
values in property/* (claude-b's lane, now the builder's) should move to estimators where a table exists (property tax
G23, insurance G24, upkeep G02) and stay as labelled examples where none does (vehicle depreciation, selling costs).
No default without a source is ever shown as "our guess": it is "an example: change it" (CONVENTIONS rule).

---

## 8. The other two angles, briefly

### 8.1 The person's experience (plain, not too much)

* **In the box:** the guess is a grey placeholder "about 1,050", never typed text, so it reads as not theirs. Under the
  box, one plain basis line. A small "our guess" pill (existing `.pill`) on the label of a record whose figure is a
  guess, on every page that shows it.
* **Leaving it blank is accepting it.** The screen says once, at the top: "Not sure? Leave a box empty and we'll use
  the grey guess. You can change it any time." The save confirms: "Saved. 5 are our guesses for now."
* **Ask the strongest predictors first:** move birth years onto question 1 ("Who is this plan for?" already asks names,
  household and state), so every later placeholder is conditioned on age; pay is question 2.
* **Cheap questions instead of weak guesses:** coin flips become one tap ("Health cover through work?", "HOA fee?",
  "New or used car?", "About when did you buy?"), each shown only when it moves a figure.
* **Fewer questions:** spending once you stop working is not asked under 50; the 401(k) contribution takes "% of pay";
  the eight spending rows start collapsed to the total with the guesses shown ("$2,860: rent $1,050, groceries $340
  ... tap a row to change it").
* **Where you stand / Dashboard:** a figure resting on guesses says so and gives a range when the range matters
  (4.6), naming the one thing to type. "Not counted yet" becomes **"Our guesses for you"**: the three guesses that move
  your figures most, each with a box; "See all 12 ›" opens the new page.
* **Words:** no deferral, escrow, APR, PMI, FPL, benchmark on screen: "what you put in", "tax and insurance in the
  payment", "interest rate a year", "the usual Marketplace plan". Sources by plain name: Census, U.S. spending survey,
  Federal Reserve, Vanguard, Social Security, Medicare.

### 8.2 Architecture and adoption (no edits to other builders' files)

**New module `modules/overview/guesses/`** (folder = page; four files plus data):

| file | contents |
|---|---|
| `module.js` | id `guesses`, group `overview`, title "Our guesses for you", icon "💭", status `usable`, `needs: ["*"]`, `writes: ["guesses", guessed fields]`, exports `settle` and `guessFor` for the shell |
| `compute.js` | `profile(plan, { today })`, `ESTIMATORS`, `estimate(plan, key, opts)`, `guessFor(plan, path, opts)`, `markGuess(draft, path, est, { today })`, `confirmGuess(draft, path)`, `isGuess(plan, path)`, `settle(draft, opts)`, `rangeOf(fn, plan, paths)`, `guesses(plan, opts)`, `readPath`, `writePath`, `compute(plan, params)` -> `{ list, byPage, count, decisive }` |
| `estimators.js` | the 40 estimators as data + functions: `{ key, paths: [pattern], tier, uses: [predictor], unit, tables: [id], estimate(profile, t) }` |
| `data/{pay,spend,balances,debts,home,health}.js` | trimmed tables `{ id, title, source, vintage, readOn, unit, dollarsOf, rows }`, generated |
| `view.js` | the page: grouped by where they are used, each with value, strength, basis, "That's right", a box to type yours, "Where it's used ›"; empty state "Nothing is guessed: every figure is yours." |
| `README.md` | every formula above with its tables, the validation results, the backtest table |
| `module.test.mjs` | one test per estimator (the persona figures), plus properties below |

**Shared statistics** `core/math/estimate.js` (+ `tests/estimate.test.mjs`): `interpLog(points, x, { logX })`,
`sigmaFromMeanMedian(mean, median)`, `middleHalf(median, sigma)`, `combineLog(a, b)`, `propagate(sigmaOwn, parts)`,
`elasticity(f, x, h = 0.1)`, `strengthOf(sigma, { identity })`, `hurdle(pHas)`, `typoCheck(typed, est)`,
`roundByStrength(value, strength, unit)`. Pure, dependency-free.

**Core hooks (small, the builder's lane):**
* `core/store.js` `update(mutator)`: `mutator(next); for (const s of settlers) s(next);` before `touch`, and
  `store.settle(fn)` to register. Two lines; `tests/store-sync.test.mjs` must stay green.
* `core/app.js`: register `settle` from every enabled manifest that exports it, with `{ today: fmt.today(), extra:
  manifests' estimates }`; add `ctx.guess(path, opts)` and `ctx.markGuess(draft, path, est)`.
* `core/ui/dom.js` `form()`: a field may carry `guess: Estimate`; then the placeholder is `about <value>`, the help line
  is the basis, `required` is ignored, number and percent boxes take `placeholder` too, and `onSubmit(values, {
  guessed: [keys] })` reports which blanks took the guess (values already filled with it). No new CSS: `.pill` and
  `.help` exist.
* `core/schema/migrate.js`: `guesses: {}` in `emptyPlan()` (new optional section, back-filled; no version bump).
* Docs: DATA_MODEL `guesses` row; CONVENTIONS "Guesses" section; MODULE_CATALOG row; CHANGELOG.

**How another builder adopts it in their own files** (claude-a's goals/vehicle, debt/consolidation,
balance/projection, ...):
1. Nothing to do to benefit: guessed figures are real numbers in the plan, so their computes stop reading zeros.
2. Show guesses in their forms: `{ key: "rate", type: "percent", guess: ctx.guess("whatIfs.consolidation.loanRate") }`
   and in `onSubmit(values, { guessed })`: `ctx.store.update((d) => { ...; for (const k of guessed)
   ctx.markGuess(d, pathOf(k), fieldGuess(k)); })`.
3. New guesses for their own fields: an `estimates` list in **their own** `module.js`, same shape as `ESTIMATORS`
   (e.g. debt/consolidation `{ key: "consolidation.loanRate", paths: ["whatIfs.consolidation.loanRate"], tier: 2,
   estimate: (p, t) => t.rate("auto_personal_rate_fed_g19", "Personal loan, 24-month (commercial banks)") }`); the
   shell passes them to settle. A WORKBOARD message and a FEEDBACK item "for: builder (claude-a)" announce it.

**Tests (what `npm test` proves):** each estimator reproduces its persona figure; monotone in income where the table
is; an unknown predictor gives the all-row figure; a guessed predictor raises sigma; a rough predictor is not used;
settle is idempotent; a typed value is never overwritten; deleting a record removes its entry; tier order; every
estimator's tables have source, vintage and read date; no table from the research's unverified list is bundled; the
two validations above stay within their published errors; the backtest coverage is 35-65%.

**Data packaging:** `tools/build-guess-data.mjs` reads the research JSON (kept out of the repo), keeps only the rows
the estimators read, writes `data/*.js` with the source block, and refuses a table without `source`, `vintage` and a
read date. Size after trimming: well under the 3.4 MB the app already serves; content-hashed like every module file.
A table older than 400 days by its read date shows on system/diagnostics as "guess tables to refresh".

---

## 9. Risks and open points

* CE publishes means only: spending boxes are conditional means in narrow cells, and their spread is declared (0.25),
  not measured. The verdict rule (4.6) is what keeps this honest. If CE medians are found, they replace the means and
  the declared spread goes.
* Several tables are older than a year in what they describe (NAIC 2023, AHS 2023, NDCP 2022, CMS NHE 2020): each
  basis line names its year, and flows are aged with the plan's own inflation only.
* The guesses change when answers change: that is the request, and the notice says so, but it must never move a
  figure the person typed (rule 2) or a figure on a page the person is editing (settle runs on save, not on keystrokes).
* Partners: no table links one partner's balances to the other's, so they are guessed independently (R7).
* Credit score, education, occupation and sex are not in the plan and are not asked; rates and pay are therefore
  population averages, and the basis says "typical".
* overview/setup is claude-b's (the builder's) own page: its changes (placeholders, blanks to guesses, question order,
  the coin-flip taps) are in that lane; the other builders' pages adopt as in 8.2 in their own time.
