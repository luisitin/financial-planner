# Guesses that make the app easy: the person on the phone

Design for the owner's request: a layperson opens the app, does not know most numbers, and still gets a plan
that feels easy, honest and close to right. The angle here is **the person on the phone**: what a box shows, what
blank means, what typing does, how a guess explains itself, how a page admits it rests on guesses without alarm,
the one place to see and fix guesses, when to ask at all, what to cut, and plain words. The estimation engine and
the data/storage angles are covered briefly in section 11 so the design is complete.

Evidence: three walkthroughs on a 390 px phone from an empty plan (`walk-young.json`: Sam, 24, Texas, first job;
`walk-parent.json`: Jordan, 41, single parent, Ohio; `walk-near/` screenshots: Pat, 61, and a partner of 59,
near retirement; `walk-near.json` was not written when this was read, so Pat is cited from screenshots only), the
input inventories (`inventory-a.json` 221 inputs, `inventory-b.json` 449 inputs: 192 marked "a layperson does not
know this", 180 "roughly"), and the sourced tables in `est/data/*.json` (148 tables, read 2026-11-02).
Screenshot paths below are relative to `$SP/est/`.

---

## 0. The decisions, in one screen

1. **One rule for every box: the grey figure in an empty box is exactly what the plan counts if you leave it.**
   No more "$ 0" placeholders that count as nothing, no more "e.g. 24.9" examples that contradict the line under
   them, no more "$ 3,500" that counts as $0 (`walk-near/11-setup-spend-rough.png`: grey $3,500 in the box, "In all,
   about a month $0" under it; `walk-young/12-owe-amounts.png`: "e.g. 24.9" over "Blank: a typical 22.4%").
2. **Guesses are placeholders, not prefilled values.** Typing replaces them with no deleting (a phone keyboard
   cannot select-all easily); clearing a typed figure brings the guess back. A saved guess re-opens as the grey
   figure again, never as if you had typed it.
3. **Blank never means zero, and a blank box never drops a record.** A debt with only its payment typed, a
   401(k) with no balance, a spending row left empty: all are kept, with the blanks guessed and marked
   (`walk-young/13-owe-typed.png`, `walk-parent/15-q5b-owe-partial.png`, `walk-young/11-after-have.png`).
4. **"Our guess" is the only word.** In boxes, on records, on pages, in the list. One plain why-line per guess
   ("Our guess: typical 1-bedroom rent in Texas."), with sources in one fold, as the owner chose for Assumptions
   (DESIGN_LOG 2026-09-15 round 17) and the retirement methods (2026-09-16 pass 4).
5. **Not sure is the empty box.** Get started's money boxes need no "Not sure" button: the screen says "leave it and
   we'll use the grey figure". "Not sure" chips appear only on choices that block Continue (where the retirement
   plan is, how much you put in, whether your job matches).
6. **We guess amounts, never possessions or people.** We never assume you have a 401(k), a home, kids or a car.
   Everything you said exists gets its blanks guessed; spending is always guessed because everyone spends.
7. **A page that rests on guesses says so in one calm grey line** ("Some of this uses our guesses: your spending
   and your 401(k). Make them yours ›"). Never amber, never red: colour stays about the money, not about our
   confidence. Only when a guess could flip the answer does the headline add one sentence.
8. **One place: "Our guesses for you"** (`overview/guesses`, new page): every guess still in use, ranked by how
   much it can move what's left each month or what retirement can pay, each with a box to type the real figure and
   "That's about right" to keep it. Market assumptions move there, folded last, renamed "What the plan assumes about
   prices and markets" (`walk-young/47-plan-guesses-assumptions.png`, `walk-parent/27-how-guesses.png`).
9. **Ask less.** Drop the retirement-spending question under 50, ask the home's value once, ask debts payment
   first, ask saving at work as "% of pay". Guess silently what nobody knows (state tax rate, escrow, raises).
10. **A plain-words pass of 40 terms** (section 10), fixed where they are written, with glossary links for the few
    names people must learn (401(k), Roth, HSA).

Not proposed, on purpose: removing "What is coming" from the Dashboard (both personas asked; the owner chose
"leave as is for now, once built it won't exist", DESIGN_LOG 2026-09-15 Dashboard round 1, finding 3, "Do not
re-propose"). Net worth keeps Edit/Delete buttons (2026-09-15 round 4, owner chose B).

---

## 1. What the walkthroughs showed (the ten that drive this design)

| # | what happened | shot |
|---|---|---|
| 1 | Blank spending counted as $0: "Got it: about $86 a month", then "Your month works", $1,640 left over; every later date divides by it | walk-young/16-after-spend-blank.png, 49-dashboard-after-walk.png; walk-parent/26-setup-done-reveal.png ($1,208 "Money to put to work") |
| 2 | Eight "$ 0" boxes: nothing to react to; "One rough total, if you're not sure" still wants a number and its grey $3,500 counts as $0 | walk-parent/16-q6-spend.png; walk-young/15-spend-rough.png; walk-near/11-setup-spend-rough.png |
| 3 | An honest blank 401(k) balance dropped the account (no contribution, no match step); a wrong "0" kept it | walk-young/11-after-have.png vs 46-done-after-401k-zero.png |
| 4 | Contribution typed as "5" meaning 5% saved as $5 a month; "0% of your pay" | walk-parent/12-q4b-amounts-partial.png, 42-contributions.png |
| 5 | A loan with its payment typed and balance blank was dropped with its payment ($420, $1,100) | walk-young/13-owe-typed.png; walk-parent/15-q5b-owe-partial.png, 19-q6-spend-after-guess.png |
| 6 | Guessed figures look like facts later: Debts shows 22.4% and $86 with no mark | walk-young/22-debts-page.png |
| 7 | Outside setup there are no guesses: Debts refuses to save without a rate (browser bubble only), Sam types the placeholder example "7" | walk-young/33-debts-car-payment-only.png, 30-net-worth-loan-blank.png |
| 8 | "Not counted yet" lists things that ARE counted (as guesses) and leaves out what counted as $0 | walk-young/18-done.png; walk-parent/26-setup-done-reveal.png |
| 9 | "How the plan makes its guesses" opens market statistics, not the guesses about the person | walk-young/47-plan-guesses-assumptions.png; walk-parent/27-how-guesses.png |
| 10 | Tiles name the wrong thing as missing ("Needs your pay", "Needs Social Security and birth dates") after both were given | walk-young/19a-dashboard-top.png; walk-parent/46-skip-path-reveal.png; walk-near/15-dashboard-blank-spend.png |

---

## 2. The one rule

> **A grey figure in a box is what the plan uses if you leave the box empty. An empty box with no grey figure
> counts as nothing. Type over the grey figure to use yours.**

It is said once per screen, in words a person reads: "Leave a box empty and we'll use the grey figure: what's
typical for someone like you." Everything below follows from it:

- Grey = counted. So no example values in boxes ever. A labelled example (for an input with no sourced figure)
  goes in the help line: "For example, 4,000", never in the box.
- No grey = not counted. A box with no guess (a trip's cost, a nickname) is simply empty: no "0", no "e.g.".
- The plan, the box and the confirmation always agree: if the box shows grey 1,339, the total under it includes
  1,339, and the "Got it" line says "6 of these are our guesses".

---

## 3. The input box

### 3.1 States

| state | box shows | line under the box | what Save does |
|---|---|---|---|
| empty, a guess exists | grey figure, formatted like typed text ("1,339"; "22.4" with the % after) | "Our guess: typical 1-bedroom rent in Texas." (+ "Type 0 if you have none." where 0 is common) | saves the guess and marks it (`plan.guesses`) |
| empty, no guess | nothing | what blank means: "Leave it empty if none." | saves nothing (the field stays null) |
| typed | the typed figure, normal ink | the plain help, no "our guess" | saves it and removes any mark |
| typed, then cleared | the grey guess comes back | "Our guess: ..." again | saves the guess and marks it; the green notice says "Cleared: we'll use our guess, about $1,339, until you type yours." |
| re-opened, value is still the guess | empty with the grey figure (never shown as typed) | "Our guess: ..." | unchanged unless typed |
| re-opened, value was typed | the figure | plain help | as typed |
| typed far outside the guess's range | the figure | one inline question with two buttons (3.4) | holds the form once until answered |

The "our guess" line is the help line the box already has (`small.help` in `ui.form`, `.su-sub` in Get started),
so a screen reader reads it with the box (`aria-describedby`). The grey figure is also in the line ("Our guess:
about $1,339, typical ..."), because a screen reader may skip a placeholder.

### 3.2 Why a placeholder and not a grey prefilled value

- Typing over a placeholder needs no deleting. A prefilled "1,339" on an iPhone needs a long-press, Select All, then
  typing, or four backspaces; people give up and keep it, so a guess turns into a fake "typed" figure.
- A prefilled value cannot be told apart from what the person typed once saved; a placeholder can (the box is
  empty, the mark says so), which is what keeps the "follow new answers until typed over" rule honest.
- The current placeholders already teach people that grey means "what's here": Sam typed the grey example "7" to
  get past a required rate (`walk-young/33-debts-car-payment-only.png`); Jordan read "$ 0" as "it will count $0"
  (`walk-parent/11-q4b-have-amounts.png`). We make that reading true instead of fighting it.
- Risk: a placeholder can look too faint, or look like an example. Answer: (a) one base.css rule makes every
  placeholder `var(--muted)` at full opacity (4.8:1 on white, 5.5:1 in dark mode; iOS's default is near 2:1),
  (b) examples are gone from boxes, so grey only ever means "counted", (c) the line under says "Our guess".

**The only global CSS added** (deliberate, minimal, a shared pattern every box needs): in `core/ui/base.css`

```css
input::placeholder, textarea::placeholder { color: var(--muted); opacity: 1; }
```

Nothing else is global. Get started keeps its scoped `su-` styles; pages use `.help`, `.muted`, `.pill`,
`.records`, `.fold`, `.notice` as they are.

### 3.3 Typing over, leaving blank

- Focus does not clear or select anything; the grey figure stays visible until the first keystroke, so the person
  can type "1,1" while still seeing "1,339".
- Typing the same number as the guess still counts as typed (the box was not empty): the mark is removed, the
  figure stops following new answers. "That's about right" on the guesses page does the same without retyping.
- Blank with a guess always saves the guess, so every page counts it. Nothing downstream ever sees null where a
  guess exists.
- "0" is an answer ("I have none"). Rows where none is common say so in the line: childcare, car costs, eating out,
  the employer match, a second account.

### 3.4 The plausibility check (uses the guess's range)

Every guess carries `low`/`high` (section 11). A typed figure below `low / 10` or above `high x 10` asks once, inline,
with one-tap answers, instead of saving silently:

- Jordan's "5" in "You put in a month" (`walk-parent/12-q4b-amounts-partial.png`): "**$5 a month?** Most people on
  your pay put in about $340. Did you mean 5% of pay?" [Yes: 5% of pay, $242 a month] [No, $5 is right]
- A yearly amount typed as monthly rent ("15,000"): "**$15,000 a month?** Rent near you is usually about $1,339."
  [It's $1,500 a month] [Yes, $15,000]

This generalises the existing pay check in `modules/overview/setup/view.js` (`check`, under $15,000 a year).
The form's submit returns `false` while the question is open (the `ui.form` "kept" convention already exists).

### 3.5 Percent of pay

Saving at work is asked the way people know it (`walk-parent` stuck item 2): chips **3% · 5% · 6% · 10% · Other ·
Not sure**, the dollars shown live under them ("6% of pay is $290 a month"). "Other" opens a percent box; a
"$ a month instead" link opens a money box. Stored the way Retirement contributions already stores it (amount and
period), the chosen percent kept only in `guide.setup` for going Back.

### 3.6 API (core/ui/dom.js, the designer's lane; no framework, same style as `moneyBox`)

```js
/**
 * A box whose empty state is a guess (docs/CONVENTIONS.md "Guesses"). guess: Guess | null (core/estimate).
 * kind: "money" | "percent" | "number". value: the stored value, or null. A value equal to guess.value while
 * isGuess() is true is shown as the grey placeholder, not as typed text.
 * Returns { box, input, read() -> { value: number|null, guessed: boolean }, line: HTMLElement (the "Our guess" help) }.
 */
export function guessBox({ name, value, guess, kind = "money", label, min, max, zeroOk = false, onGuessLine } = {})

/** The help line for a guess: "Our guess: <why>." + (zeroOk ? " Type 0 if you have none." : ""). */
export function guessLine(guess, { zeroOk = false } = {}) -> string

/** One grey line saying a page rests on guesses (section 6). names: plain labels, most important first. */
export function guessNote(names, { href = "#/overview/guesses" } = {}) -> HTMLElement   // <p class="muted">...<a>Make them yours ›</a></p>
```

`ui.form` field schema gets two optional keys (CONVENTIONS "Input schemas"):

```js
{ key, label, type: "money" | "percent" | "number", guess?: Guess | null, zeroOk?: boolean, ... }
```

- With `guess`, the field is built with `guessBox`, `required` is dropped (blank is a valid answer), and the
  help shows `guessLine(guess)` before the field's own help.
- `onSubmit(values, meta)`: `values[key]` is the guess's value when the box was left empty (so a page that has
  not adopted marks still saves a number, never null), and `meta.guessed` is a `Set` of the keys left on their
  guess. Existing pages ignore the second argument and behave exactly as today.

`ctx` gets one field (core/app.js `makeCtx`):

```js
ctx.guess(key, opts)   // = estimate(ctx.plan, key, opts) from core/estimate, with module estimators merged in
```

---

## 4. The why-line

### 4.1 Template

`Our guess: <what it is typical of>, <for whom: the answers it used>.`

- At most about 70 characters after "Our guess:" (two lines at 390 px).
- Names the answers it used, in the person's words: "at 41 on your pay", "in Ohio", "for one adult", "worked back
  from your $420 payment". That is how the person sees that more answers make it sharper.
- Statistics words never appear: median → "typical", mean → "average", percentile → not shown.
- No publisher or year on the line. Sources live in "Where our guesses come from", folded on the guesses page,
  with publisher, table, year and the read date (the owner's choice for Assumptions, DESIGN_LOG 2026-09-15 round 17).
- When several boxes on one screen share a basis (all spending rows), the why is said **once for the screen**,
  not per box: "The grey figures are what a household like yours usually spends: one adult renting in Texas on
  $48,000 a year." Each box then needs no line of its own.

### 4.2 The why-lines for the guesses a layperson meets first

| box | why-line (examples for the personas) | table ids (est/data) |
|---|---|---|
| Rent | Our guess: typical 1-bedroom rent in Texas. (about $1,339) | acs2025_median_gross_rent_by_bedrooms_by_state |
| Utilities and phone | (screen-level line) | eia2025_residential_electric_bill_by_state, eia2024_residential_natural_gas_bill_by_state_DERIVED, ce2025_spend_by_* telephoneServices |
| Groceries | (screen-level line) | usda_food_plans_sep2026, usda_food_plan_household_size_adjustment |
| Car, gas and transit | (screen-level line) | naic2023_auto_insurance_by_state, ce2025_spend_by_* gasolineAndOtherFuels, vehicleMaintenanceRepairs |
| Insurance and health | (screen-level line) | kff_ehbs2026_premiums (worker share: single $1,672, family $7,471 a year), bls_ce_healthcare_spending_by_household_type_2025 |
| Childcare | Our guess: typical center care for a toddler in Ohio. Type 0 if you don't pay for childcare. (about $1,044) | ccaoa2025_childcare_annual_price_by_state, ndcp2022_childcare_weekly_price_by_state |
| Card rate | Our guess: the average rate on cards that charge interest. (22.4%) | cc_apr_fed_g19 |
| Card payment | Our guess: a usual minimum on $3,000, the interest plus 1%. (about $86) | card_minimum_payment_rule_cfpb |
| Car loan still owed | Our guess: worked back from your $420 payment, about halfway through a usual loan. (about $12,500) | auto_loan_terms_experian_q2_2026, auto_rate_by_credit_tier_experian_q2_2026 |
| Car loan rate | Our guess: the average used-car loan; new cars average 6.4%. (11.2%) | auto_rate_by_credit_tier_experian_q2_2026 |
| Mortgage rate | Our guess: the average on Ohio mortgages people already have. (4.6%; today's new loans are 7.2%) | mortgage_outstanding_fhfa_by_state_2026q2, mortgage_rate_pmms_weekly_2026 |
| Mortgage still owed | Our guess: worked back from your $1,100 payment, less Ohio's usual tax and insurance. (about $118,000) | acs2025_effective_property_tax_rate_by_state, naic2023_homeowners_premium_by_state, mortgage_outstanding_fhfa_by_state_2026q2 |
| Home value | Our guess: the typical home in Ohio. (about $254,000) | acs2025_median_home_value_by_state, acs2025_median_home_value_by_state_and_mortgage_status, fhfa_hpi_at_state_annual (once the purchase year is known) |
| 401(k) saved so far | Our guess: typical at 41 on your pay. (about $37,000) | vanguard_has2026_401k_balance_by_age (age, income, job tenure cells) |
| You put in (Not sure) | Our guess: 7% of pay, typical at your age and pay. ($338 a month) | vanguard_has2026_deferral_by_income_age |
| Employer adds (Not sure) | Our guess: 4% of pay, the typical match for people who put in 6% or more. ($193 a month) | vanguard_has2026_headline (median promised match 4%, deferral needed 6%), vanguard_has2026_top_match_formulas |
| Car value | Our guess: about what's still owed on it. / with no loan: typical for someone your age. | scf2025_median_value_if_held (vehicles) |
| Checking + savings | Our guess: typical bank balance at 24 on your pay. | scf2025_median_value_if_held (transactionAccounts) |
| Pay (I work, blank) | Our guess: typical full-time pay at 24 in Texas. Your real pay matters most, so type it if you can. | acs_median_earnings_by_state, cps_ftyr_income_by_age5 |
| Social Security | About $2,057 a month from 67, in today's money: our guess from your pay. Your statement at ssa.gov is exact. | (existing estimateSocialSecurity) |
| Education goal | Our guess: four years of public college in Ohio for Child 1, starting 2037. | goals/education COSTS (module estimator) |
| Home down payment goal | Our guess: a typical first-time buyer's down payment plus closing costs on an Ohio home. | home_buyer_down_payment_nar_2025, acs2025_median_home_value_by_state |

### 4.3 "Sharper with" (the owner's "the more info we have" made visible)

On the guesses page, the top rows add one line when an answer would sharpen the guess:
"Sharper if you tell us: your state ›" (rent, utilities, home value), "how long you've had this job ›" (401(k)),
"the year you bought it ›" (mortgage owed and rate, home value). The link opens the box for that answer. Each
estimator lists its missing inputs (`Guess.sharperWith`).

---

## 5. Get started, screen by screen

General changes (modules/overview/setup/view.js and compute.js):

- `moneyIn`'s default placeholder `"0"` goes; fixed placeholders "65,000", "3,500", "300,000", "60,000", "4,000",
  "10,000", "e.g. 24.9", "e.g. 6.5" go (view.js lines 393, 406, 510, 527-528, 697, 747, 809). Boxes get either a
  guess or nothing.
- "Skip this question" reads **"Skip: use our guesses"** on the three amount screens (have-amounts, owe-amounts,
  spend), where skipping now saves the guesses; it stays "Skip this question" on the pick screens, where skipping
  assumes nothing.
- Every "Got it" line counts its guesses: "Got it: about $2,870 a month. 6 of the 8 are our guesses for now."

| screen | change | evidence |
|---|---|---|
| Q2 What comes in | Pay box gets a guess from age and state; a two-way switch "Before tax / What reaches my bank" (the other figure shown live, "about $4,000 before tax", worked out by core/math/tax.js); the existing under-$15,000 check stays | inventory: "many know take-home pay, not gross" |
| Q3 Ages | When the stop age is before full retirement age, one sentence under the stepper: "Social Security pays in full from 67. From 65 to 67 the plan pays your costs from savings." plus a chip "67 (full Social Security)"; the plan's default age itself is the owner's call (section 15) | walk-young/07-ages-year.png, walk-parent/08-q3-ages-filled.png ("Short at 65" although Social Security covers twice the spending) |
| Q3 Children | "How old?" (a number) instead of a birth year; blank is not guessed | walk-parent/46-skip-path-reveal.png |
| Q4b Amounts | Screen line: "Round numbers are fine. Leave a box empty and we'll use the grey figure: what's typical for someone like you." Every box gets its guess. Retirement: "Where" gets "Not sure" (counted as a plan at work, the most common kind); "You put in" becomes the % chips (3.5); "Your employer adds" becomes chips **Not sure (about 4%) · No match · I know it**. A picked retirement tile always makes the account, even with every box empty. Home value is asked here only, never again on 5b | walk-parent/11-q4b-have-amounts.png, 12-q4b-amounts-partial.png; walk-young/10-have-amounts.png, 11-after-have.png |
| Q5b Each debt | Order: **Paid a month** first ("It's on your bank statement"), then Still owed, then Rate. Screen line: "Start with what you pay a month. Leave the rest empty and we'll work it out." A picked debt is never dropped: every blank is guessed (owed worked back from the payment; with no payment, the typical balance for your age). Mortgage rate guessed from mortgages people already have in your state, not today's new-loan rate. On the mortgage, the home value typed on 4b is shown as a line ("Your home: about $254,000, from question 4. Change ›") | walk-young/12-owe-amounts.png, 13-owe-typed.png; walk-parent/14-q5b-owe-amounts.png, 15-q5b-owe-partial.png, 20-owe-wild-guess-owed.png |
| Q6 Spending | Every row shows its guess; the screen line says the basis once (4.1); the group sums and "In all, about a month" include the guesses with parts "$1,250 you typed + $1,620 our guesses". "One rough total" stays as the second tile, its box's grey figure is the sum of the row guesses, and its line becomes "If you'd rather give one figure". The retirement box ("Once you stop working...") is asked only from age 50; younger, one muted line: "We'll plan on about $1,900 a month once you stop working: today's costs without loans and childcare. Change it on Will the money last?" | walk-parent/16-q6-spend.png, 22-q6-spend-partial.png; walk-young/14-after-owe.png, 15-spend-rough.png; walk-near/11-setup-spend-rough.png |
| Q7b Goal details | Home and education amounts get guesses (house: down payment + closing on the state's typical home; education: the Education page's own cost for each child's start year); the trip and "something else" have no sourced figure, so their box is empty with "For example, 4,000" in the help line. The cushion's months start from Emergency fund's `suggestedMonths` (3 with two steady earners, 6 with one, more for uneven pay) | walk-parent/25-q7b-goal-details.png, 33-education.png |
| Done | See 5.1 | walk-young/18-done.png; walk-parent/26-setup-done-reveal.png |

### 5.1 The done screen ("Here is your money on one page")

Order, top to bottom (wording exact):

1. Headline (unchanged logic) and the four tiles. A tile whose figure rests on a guess that could change it a lot
   (tier 1 or 2, section 7) gets the sub-line **"Partly our guesses."** in the tile's existing muted sub text, no
   colour change.
2. When the top guess could flip the left-over verdict (positive vs negative between its low and high), the
   headline gets one more sentence: **"Your real spending could change this, so it's the best figure to type next."**
   (the guess's plain name in place of "spending").
3. "Your first moves" (unchanged; the two debt moves that say the same thing merge into one,
   `walk-young/46-done-after-401k-zero.png`).
4. **"Our guesses for now"** (new, replaces the guess rows of "Not counted yet"): the top 3 by impact, each a row
   link: "Spending: about $2,870 a month ›", "401(k): about $37,000 ›", "Mortgage rate: 4.6% ›", then
   "All 9 guesses ›" to the guesses page. Line under the heading: "Typical figures for a household like yours.
   Good enough to start; type the real ones when you have them."
5. **"Not counted yet"**: only what is truly missing (the state's tax rate when no table has it, a second
   return for an unmarried couple). Hidden when empty.
6. The market card, renamed **"What the plan assumes about prices and markets"** (fold, last), same content and
   buttons ("These sound fine", "Change them ›").

### 5.2 The tiles' "Needs ..." reasons

A "Not yet" tile names only what is really missing (`walk-young/19a-dashboard-top.png`, `walk-parent/47-skip-path-dashboard.png`,
`walk-near/15-dashboard-blank-spend.png`: "Needs Social Security and birth dates" with both saved). With spending
always guessed, "Left over" and "Safety cushion" fill on every path that has pay; the retirement tile's fallback
string `st.retirementMissing ?? "Social Security and birth dates"` (setup view.js drawDone) is replaced by the
compute's own reason, or the tile shows the verdict.

---

## 6. Pages that rest on guesses

### 6.1 The note

One grey line directly under the page's hero or first figure, built by `ui.guessNote(names)`:

> Some of this uses our guesses: your spending and your 401(k). Make them yours ›

- Names: the two most important guesses this page reads (plain labels), then "and N more".
- Shown only when a guess with `weight: "big"` (section 11) touches what the page reads. Small guesses (a
  belonging's life, a raise) never put a line on a page; they live on the guesses page.
- `.muted` text, the link is a normal link to `#/overview/guesses`. Never a notice, never amber, never a pill.
- One per page. Not on Get started or on the guesses page itself.

**How every page gets it without editing pages:** the shell (core/app.js `show()`) draws the note above
`<div data-page>` (where the guide bar already goes) when the page's manifest `needs` includes a section that
holds a big guess in use. A page that draws its own note under its hero sets `guessNote: "own"` in module.js; a
page where it makes no sense sets `guessNote: false`. So the other builder's pages (goals/emergency-fund,
goals/vehicle, goals/travel, goals/charitable, debt/student-loans, debt/consolidation, taxes/state,
taxes/self-employment, taxes/filing-status, taxes/documents, balance/projection, balance/statement,
cashflow/statement) get the note the day this lands, and can move or switch it off in their own files later.

### 6.2 Records

A record whose figure is a guess gets one muted line in its details, never a tag per number:
"Rate and payment are our guesses for now. Edit ›" (Debts, `walk-young/22-debts-page.png`); "Our guess for now:
typical for your age and pay." (an account); "Our guess for now." (an expense row). The edit form then opens with
those boxes empty and grey (3.1), so typing replaces them.

### 6.3 Verdict wording

- A guess never changes a colour by itself. Green "Money to put to work" stays green when the figure is green.
- A verdict that could flip within the top guess's range says so once, in its headline only ("Your real spending
  could change this"). No other hedging anywhere: no "estimated" pills, no "approximately" on every number.

### 6.4 Dashboard

- "What to do now" gets a first card, only while a tier-1 or tier-2 guess is in use: **"Make our guesses yours"**,
  "3 figures we guessed change your answers the most." → the guesses page. It drops away when none does.
- The setup checklist step "Check the assumptions (inflation, returns, retirement age)" (dashboard/compute.js line
  12; `walk-young/20-dashboard-setup-list.png`) becomes **"Look over our guesses"**, short label "Look over our
  guesses", going to `overview/guesses`, done when no tier-1 guess is left or the page's "These look fine" was
  tapped (`plan.assumptions.reviewedAt` keeps meaning "market assumptions looked at"; the new step reads
  `plan.guide.guessesLookedAt`). Same rename in overview/guide/journeys.js `assumptions` step.

---

## 7. One place: "Our guesses for you" (`overview/guesses`, new page)

Catalog row: group overview, id `guesses`, title **"Our guesses for you"**, icon 🧮, purpose "The figures the plan
guessed for you, the ones that matter most first. Type the real ones when you have them.", status usable,
`heavy: true` (the ranking recomputes the headline answers), needs: all sections that hold guesses, writes: the
same plus `guesses`.

### 7.1 Layout on a 390 px phone

```
Our guesses for you
We filled in what you skipped with figures typical for a household like yours. They're good
enough to start. The first few change your answers the most. A guess follows your new answers
until you type over it.

[card] Matters most
  Spending on groceries            about $480 a month
  Our guess: typical for one adult in Texas on your pay.
  If it's off, what's left each month could change by about $150.
  [$ ________ grey 480 ]  [Save]      That's about right
  Change it on Expenses ›
  ---------------------------------------------------------------
  401(k) saved so far              about $5,100
  Our guess: typical at 24 on your pay.
  Could change what retirement can pay by about $60 a month.
  Sharper if you tell us: how long you've had this job ›
  [$ ________ grey 5,100 ]  [Save]    That's about right
  ...

[details.card.fold.fold-card] Matters less              6 guesses ›
  (same rows, shorter: label, figure, why, box)

[details.card.fold.fold-card] Where our guesses come from      12 sources ›
  Rent: U.S. Census Bureau, American Community Survey 2025, median gross rent by bedrooms. Read 2 November 2026.
  ...

[details.card.fold.fold-card] What the plan assumes about prices and markets   ✓ Looked over | Worth a look ›
  (the card moved from Get started's done screen, its buttons unchanged)
```

- Records, never a table (AGENTS design rules). Box + filled Save is the primary action per row; "That's about
  right" is outlined (secondary).
- Save commits on Save or blur (rule 4), confirms with `ui.notice("ok", "Saved: groceries $420 a month is now your
  figure.")` kept in a module-level `pending`; "That's about right" confirms "Kept: groceries about $480 is now your
  figure." Errors: `ui.notice("error", "That isn't an amount. Type it in numbers, like 450.")`.
- The "Matters most" card is open while it has rows; if every guess is small, it is replaced by one line "None of
  our guesses moves your answers much." and "Matters less" opens.
- Empty state (no guesses in use): "Every figure in your plan is one you typed. Nothing to look over here." +
  outlined "Back to the Dashboard".

### 7.2 Ranking (modules/overview/guesses/compute.js, pure)

```js
export function compute(plan, { today, maxPaths } = {}) -> {
  rows: [{ path, key, label, value, unit, why, href, sharperWith,
           impact: { tier: 1 | 2 | 3, on: "month" | "retirement" | "cushion", monthly, months, words } }],
  top: rows.slice(0, 3) of tier <= 2, count, sources: [{ table, publisher, title, year, readOn }] }
```

For each guess in use (`guessesInUse(plan)`, at most 25, biggest `weight` first):

1. Make two copies of the plan with the guess at its `low` and at its `high` (`setAt`, without refreshing other
   guesses).
2. Compute the headline answers on the plan and both copies with the pages' own computes (as setup's `standing`
   does): `spare` = next-best-action `spare.monthly`; `carry` = retirement/projection's spending it can carry a
   month (only when `retirementKnown`); `cushion` = balance/liquidity `runwayMonths`; the verdicts: left-over sign,
   cushion `status`, projection `verdict`.
3. `tier 1` if any verdict differs between low and high ("Could change whether your month works" / "Could change
   whether your cushion is enough" / "Could change whether retirement is on track"); else `monthly =
   max(|spare(x) - spare(v)|, |carry(x) - carry(v)|)` over x in {low, high}: `tier 2` when monthly >= $100, else
   `tier 3`. A balance that moves neither (cash) uses cushion months: tier 2 when it moves the cushion by 1 month
   or more ("Could change your cushion by about 1 month").
4. Sort: tier, then monthly, then the estimator's `weight`.
5. Words: "If it's off, what's left each month could change by about $150." / "Could change what retirement can pay
   by about $60 a month." Rounded to $10 under $100, else to $50.

The Dashboard card and the done screen call this page's compute (`ctx.computeRemote("overview/guesses")`) once
per render and use `top`; the shell's page note (6.1) does not, it uses the static `weight` so pages stay fast.

---

## 8. Ask, ask with a guess, or guess silently

**Policy**

- **Ask, no guess**: facts only the person has and that change the advice categorically. Who is in the household,
  the state, work or retired, which accounts and debts exist, the goals picked, whether the card is paid in full.
  We never guess that something exists.
- **Ask with a guess in the box**: amounts people know or roughly know (inventory `knows` = yes or roughly) whose
  guess is `weight: "big"`. They see a figure and correct only what they know.
- **Guess silently** (no question; the figure appears on its page with the record line of 6.2 and on the guesses
  page): inputs marked `knows = no` that the person cannot look up in a minute, inputs far in the future, and
  inputs that move headline answers by under $50 a month.
- **Never ask a question whose answer we cannot use**, and never ask the same thing twice (the home's value).

| input | knows | decision | today | evidence |
|---|---|---|---|---|
| Pay before tax | roughly | ask, guess in box, take-home switch | blank = no income line ("Needs your pay" everywhere), fixed placeholder 65,000 | inventory |
| Birth year / month | yes / roughly | ask year; month blank = July (exists) | same | |
| Children's ages | yes | ask "How old?" | birth year, skippable | walk-parent/46 |
| Stop-work age | roughly | ask (stepper) + the 67 sentence | stepper at 65 | walk-young/07, walk-parent/08 |
| Social Security | no | guess by default ("Estimate it for me", exists) | same | walk-near/05b |
| Which accounts, debts, goals | yes | ask, never guess | same | |
| Checking, savings | roughly | ask with guess | $ 0 | walk-parent/11 |
| 401(k) balance | no / roughly | ask with guess | $ 0, blank drops it | walk-young/11, walk-parent/11 |
| Saving at work | roughly as % | % chips + Not sure | $ a month only | walk-parent/12 |
| Employer match | no | chips: Not sure (about 4%) / No match / I know it | $ a month, blank = 0 | walk-parent/11, walk-young/50 |
| Home value | roughly | ask once with guess | asked twice, $300,000 example | walk-parent/14 |
| Car value | no | ask with guess (from the loan) | blank drops the car | walk-young/10 |
| Debt payment | yes | ask first | asked second | walk-young/13 |
| Debt balance | roughly | ask with guess worked back | blank drops the debt | walk-parent/15 |
| Debt rate | no | ask with guess (existing-loan rates) | typical new-loan rate | walk-parent/20 |
| Spending rows | roughly / no | ask with guesses | $ 0 | walk-parent/16 |
| Retirement spending | no | under 50: guess silently; 50+: ask with guess | always asked | walk-young/14 |
| Cushion months | no | guess silently (suggestedMonths) | 6 | inventory |
| Goal amounts | no | ask with guess where sourced, else empty + example in help | fixed examples, blank = $0 | walk-parent/25 |
| Yearly raise (Income) | no | guess silently (Atlanta Fed by age, `atlfed_wage_growth_by_age_longrun_derived`) | 0 | inventory |
| State income tax rate | no | guess silently (flat states from the State page's table; graduated states from an effective-rate table) | asked on "Not counted yet" | walk-parent/46 |
| Property tax, home insurance | no | guess silently on Home (state tables) | 0 | walk-parent/39 |
| Health premium you pay | roughly | ask with guess (spending row) | $ 0 | walk-parent/16 |
| Medicare supplement premium | no | guess silently from the state (kff_medigap_average_premium_2025) | 0 | inventory |
| Plan-to age, inflation, returns | no | guess silently; folded "prices and markets" | same | walk-young/47 |
| W-4 details, last year's tax and AGI | no | guess silently (computed), never in Get started | asked on tax pages | inventory |

---

## 9. Cut, fold, reword (screens the walkthroughs found too much)

Lanes per docs/TEAM.md: view.js of usable pages is the designer's; compute strings are the builder's.

| screen | change | shot | lane |
|---|---|---|---|
| Get started Q4b (7 boxes) | % chips for saving, match chips, home asked once; boxes show guesses | walk-parent/11-q4b-have-amounts.png | builder (setup is builder-built; view+compute) |
| Get started Q6 (8 boxes + retirement box) | guesses in rows, one basis line, retirement box only 50+ | walk-parent/16-q6-spend.png | builder |
| Debts, card edit (7 fields) | a card shows rate, payment (guessed boxes) and extra; "More details" fold holds started, backed by, credit limit; "Loan length" is not shown for cards; rate and payment not `required` (guessed) | walk-young/23-debt-edit.png, 33-debts-car-payment-only.png | designer (balance/liabilities view.js) |
| Expenses, empty (8-field form) | starts with Get started's eight rows as guessed records ("Rent, about $1,339: our guess. Is that close?" each with a box); the add form folds "goes up with prices", start and end dates under "More"; the loan payments it already counts show from the start | walk-young/25-expenses.png | designer (view) + builder (records) |
| Net worth, add an account | types grouped (Bank, Retirement, Investments, Things I own, Money I owe), "529 plan" no longer first; "Institution" → "Bank or company"; "Whose account" hidden with one adult; a debt's balance box guesses from the typical balance for your age | walk-young/29-net-worth-add-form.png | designer (view), builder (ACCOUNT_TYPES labels) |
| Will the money last? (24-year-old) | one sentence + the chart; "What goes into this" and the settings fold; "Guaranteed income 0%" → "Social Security and pensions: about $2,057 a month from 67" | walk-young/41-will-money-last.png; walk-parent/34-retirement-projection.png | designer |
| Next best action (8-9 steps + tax table) | the next step and the one after; "Later steps (6)" fold; the monthly table moves into "Where the $1,210 comes from" fold; steps that cannot apply (mortgage, 529 with no child) are not listed | walk-young/27-nba-after-rent.png; walk-parent/30-all-moves.png | designer (view), builder (step filter in compute) |
| How am I doing | each card: bar + one plain sentence; sources into "Where these come from" fold; mortgage-lender limits only for owners | walk-young/39-how-am-i-doing.png | designer (view), builder (benchmarks compute strings) |
| Budget 50/30/20 | the method paragraphs fold; "unlisted money counts as saved" goes once spending is guessed | walk-young/40-budget-50-30-20.png | designer |
| Debt guide step 2 | a guessed rate and payment count as enough to continue; the step says "We guessed the rate and payment. Type them when you have the statement." | walk-young/21-next-move-debt-guide.png | builder (overview/guide/journeys.js `detailed()`) |
| Mortgage (24 year rows) | one line "$1,100 a month, paid off in 2050"; "See every year" fold | walk-parent/38-mortgage.png | designer |
| Federal estimate | one sentence first ("No federal income tax this year; about $3,700 back"); the form steps and the sources fold | walk-parent/44-federal-tax.png | designer |
| Social Security | estimate at 62, 67, 70 + one "I have my statement figure" box (shown empty and grey when it holds our estimate, not prefilled as if typed); paste and formula fold | walk-parent/35-social-security.png | designer |
| Home (9-field form) | ask price paid and year; property tax and insurance guessed from the state (grey); the percent knobs fold | walk-parent/39-home.png | designer (view), builder (guess keys) |
| Emergency fund | the $0 "Sellable within a week" tile hidden at $0; "Change the months" inline | walk-young/36-emergency-fund.png | designer |
| Done screen | "Not counted yet" split (5.1); duplicate debt moves merged | walk-young/18-done.png, 46-done-after-401k-zero.png | builder |

---

## 10. Plain words: the 40 hardest terms on screen today

Found in the walkthroughs and by searching the pages' text (`grep` over modules/*/*/view.js and compute.js). Where
a name must stay (people see it on pay stubs and statements), it stays with a plain gloss and a "What's this?"
link to the Glossary entry (ai/glossary/data/terms.js already has most); search for the word lists the Glossary
entry first (`walk-young/43-search-roth.png`: "roth" lists pages, not the entry).

| # | on screen today | say instead | where (file) | shot |
|---|---|---|---|---|
| 1 | Roth money grows tax-free for good, and a traditional IRA can cut this year's tax | A retirement account you open yourself (an IRA). The Roth kind: no tax break now, no tax when you take it out. What's this? | overview/next-best-action/compute.js | walk-young/27 |
| 2 | Traditional IRA | IRA that cuts this year's tax (traditional) | balance/net-worth/compute.js ACCOUNT_TYPES | walk-young/29 |
| 3 | Roth IRA / 401(k) | Roth: tax-free later | ACCOUNT_TYPES | walk-young/29 |
| 4 | $7,500 of room left (limit $7,500) | You can still put in $7,500 this year | overview/next-best-action/compute.js, taxes/*, investments/limits | walk-young/27 |
| 5 | tax-sheltered accounts | retirement accounts that cut your tax | overview/next-best-action | walk-young/24 |
| 6 | Brokerage (taxable) | Investments outside retirement | ACCOUNT_TYPES, 9 pages | walk-young/29 |
| 7 | 529 plan / Education (529) | College savings (529) / page title "Saving for college" | ACCOUNT_TYPES, goals/education module.js | walk-parent/33 |
| 8 | HSA | Health savings account (HSA) | ACCOUNT_TYPES, taxes/hsa-fsa | walk-parent/29 |
| 9 | Life insurance cash value | Savings inside a life insurance policy | ACCOUNT_TYPES, insurance/* | walk-young/29 |
| 10 | Institution | Bank or company | balance/net-worth, accounts, liquidity | walk-young/29 |
| 11 | Joint or shared (default for one adult) | Both of us (hidden with one adult) | balance/net-worth view | walk-young/29 |
| 12 | Other liability | Something else I owe | ACCOUNT_TYPES | |
| 13 | Real estate | A home or land | ACCOUNT_TYPES | |
| 14 | $0 taxable, $0 pre-tax, $0 tax-free | $0 you can use any time, $0 in work and IRA accounts (taxed when taken out), $0 in Roth accounts (never taxed) | retirement/projection, taxes/projection, balance/net-worth (13 pages) | walk-young/41, walk-parent/34 |
| 15 | withdrawals taxable, then pre-tax, then roth | Money comes first from savings you can use any time, then from work accounts, then from Roth | retirement/projection | walk-young/41 |
| 16 | required withdrawals from 75 | from 75 the law makes you take some out each year | 20 files | walk-young/41 |
| 17 | The Monte Carlo and History pages | More ways to test it: the chance it lasts, and if history repeated | retirement/projection view | walk-young/41 |
| 18 | 0% Guaranteed income | Social Security and pensions: about $2,057 a month from 67 | retirement/projection, cash-flow, buckets | walk-parent/34 |
| 19 | Starting withdrawal rate | Share taken out the first year | retirement/projection, fire | walk-young/41 |
| 20 | The lenders' front-end ratio (28%) | Rent is 31% of your pay before tax; most people aim for under 30% | overview/benchmarks/compute.js | walk-young/39 |
| 21 | Fannie Mae's limit for loans checked by hand (36%; up to 45 to 50%...) | Loan and card payments: 13% of pay; under 36% is comfortable (sentence dropped) | overview/benchmarks/compute.js | walk-young/39 |
| 22 | 0.0x pay | Saved for retirement: none yet (aim: a year's pay by 30) | overview/benchmarks | walk-young/39 |
| 23 | gross income | pay before tax | 7 pages (health-score, estimated, state ...) | walk-young/39 |
| 24 | Adjusted gross income | income after a few deductions (line 11 of your tax return) | taxes/estimated, taxes/state, debt/student-loans | walk-parent/44 |
| 25 | effective rate -1.2% | You get back more than you pay: the child credit covers it | taxes/federal | walk-parent/44 |
| 26 | the 12% bracket, $33,660 of room left | the next $33,660 you earn is taxed at 12% | taxes/federal, brackets | walk-parent/44 |
| 27 | Form 1040 / no AMT / Revenue Procedures 2023-34 | into the "How it's worked out" fold; AMT → "a second tax check some high earners face" | taxes/federal | walk-parent/44 |
| 28 | Balance transfer offer / Promotional 0% months / Transfer fee, percent | Move it to a 0% card? / Months with no interest / One-time fee to move it. Line: "You usually need good credit to get one." | debt/credit-cards, debt/consolidation | walk-young/38 |
| 29 | Interest rate per year (required) / APR | Interest rate a year (our guess if empty) | balance/liabilities, 46 files say APR | walk-young/33 |
| 30 | Required payment each month | Payment a month | balance/liabilities, debt/* | walk-young/23 |
| 31 | Secured by | Backed by (a car, a home) | balance/liabilities | walk-young/23 |
| 32 | Loan length in months (on a card) | Months left to pay (not shown for cards) | balance/liabilities | walk-young/23 |
| 33 | One lump sum (for a recast) | Pay a lump sum to lower the monthly payment | debt/mortgage, 6 files | walk-parent/38 |
| 34 | a new appraisal | a new valuation of the home | debt/mortgage, refinance | walk-parent/38 |
| 35 | Mortgage insurance: you can ask to end it | If you pay a monthly insurance fee on the loan, you can ask to drop it | debt/mortgage | walk-parent/38 |
| 36 | Sellable within a week: brokerage, crypto: sell, then wait for settlement | Investments you could sell | balance/liquidity | walk-young/36 |
| 37 | Locked up or costly to tap: retirement accounts, HSA, 529, insurance cash value | Money you can't easily touch: retirement, college and health accounts | balance/liquidity | walk-parent/29 |
| 38 | earnings indexed to wages..., bend points, via ssa.tools, Earnings record: paste | into the "How it's worked out" fold; on screen: "We estimated this from your pay. For the exact figure, sign in at ssa.gov and type the monthly amount it shows at 67." | retirement/social-security | walk-parent/35 |
| 39 | Ten numbers drive every projection... change any that your advisor set differently / How much stocks swing | What the plan assumes about prices and markets / How bumpy stocks are, in a typical year | system/assumptions/compute.js (PLAIN table in view stays as the owner chose) | walk-young/47 |
| 40 | Invest in a brokerage account, a 529 for a child, Goal seek | Then it's your call: invest more, save for a home, retire earlier. "What it takes" (Goal seek's title) | overview/next-best-action, scenarios/goal-seek module.js | walk-young/27 |

Grammar fixes found on the way: "Credit cards costs about $56 a month", "the Credit cards is gone by",
"Credit cards is expensive debt" read the plural account name as a singular noun (`walk-young/22-debts-page.png`,
`walk-parent/31-needs-attention.png`): use "your credit cards cost", "your credit cards are paid off by" whenever
the name is the setup's "Credit cards". "Child 1 / Child 2" (`walk-parent/31-needs-attention.png`): ask the kids'
first names (optional) on Q1, else say "your two children".

---

## 11. The other two angles, briefly

### 11.1 The estimation engine (`core/estimate/`, pure, dependency-free, imports in Node)

```js
// core/estimate/index.js
export function estimate(plan, key, opts = {}) -> Guess | null      // null when no sourced figure exists
export const CORE_ESTIMATORS = { [key]: (plan, opts, lib) => Guess | null }
/** Guess */ { key, value, low, high, unit: "month" | "year" | "total" | "rate",
               why,            // "typical 1-bedroom rent in Texas" (the words after "Our guess: ")
               used: [..],     // plain words of the answers it used
               sharperWith: [{ label, href }],
               sources: [tableId], weight: "big" | "small", strength /* 0..1: share of its predictors known */ }
```

Keys (first set): `pay.yearly`, `spend.housing`, `spend.utilities`, `spend.groceries`, `spend.transport`,
`spend.insurance`, `spend.childcare`, `spend.dining`, `spend.shopping`, `spend.total`, `retire.spendingMonthly`,
`account.cash`, `account.retire.balance`, `contrib.rate`, `match.rate`, `home.value`, `car.value`,
`debt.<kind>.owed`, `debt.<kind>.rate`, `debt.<kind>.payment` (kinds: credit, car-loan, student, mortgage, loan),
`home.propertyTax`, `home.insurance`, `state.taxRate`, `income.raise`, `goal.home.target`, `retire.medigap`.
Modules add their own by exporting `estimators` in module.js (`"goals/education:target"`), so goals/education's
COSTS and taxes/state's tables are used without moving them into core.

How a guess gets stronger as answers arrive (the owner's request), the same ladder for every key:

1. **Worked out from the person's own figures first**: owed from payment (PV over half a usual term at the
   guessed rate), payment from owed (setup's `typicalPayment`), retirement spending from today's spending
   (`retireDefault`), escrow out of a mortgage payment, car value from its loan.
2. **Else the most specific table cell for what is known**, falling back one dimension at a time (state → region →
   US; age band + income band → age band → all). Where a table has one-way cells only (Vanguard by age, by income,
   by tenure; CE by quintile, size, age, composition), combine the known one-way cells by their geometric mean
   (`value = exp(mean(log cell_i))`): each cell's information counts, the overlap between them is not counted
   twice. Example: Jordan's 401(k), age 35-44 median $46,919 and pay $50-75k median $29,033 → about $36,900.
3. **Spending**: rows with a local source use it (rent, utilities, food plans, childcare, car insurance, health
   premium share); the rest take Consumer Expenditure shares for the household's composition and income quintile,
   scaled to the total; the total is capped at take-home pay minus the typical saving rate for the age band, so a
   guess never says the person spends more than lands in the account.
4. **Point estimate = the typical (median, most-common) value**, never the average, where the table has one;
   `low`/`high` = the table's 25th/75th percentile when it has a spread, else a documented band (spending ±25%,
   rates ±2 points, balances ×0.5 to ×2).
5. **Refresh**: a guess follows new answers until typed over: `store.update` calls `refreshGuesses(draft,
   estimate, today)` after the page's change; every mark still in use is re-estimated and rewritten if it moved.

### 11.2 Data and storage

- **Marks** (optional, no version bump; DATA_MODEL row added): `plan.guesses = { [path]: { key, value, at } }`,
  `path` = `section.field` or `section#<id>.field` (`"debts#setup-debt-credit.rate"`,
  `"retirement.contributions#setup-c-p1.amount"`, `"retirement.spendingMonthly"`). A guess is in use while the value
  at the path still equals `value` (the existing `rateIsGuess` rule, generalised). `migrate()` copies the existing
  `debts[].rateGuessed` / `paymentGuessed` into marks once (idempotent, like `ownersToIds`); readers accept both
  until every writer uses marks.

```js
// core/estimate/marks.js (pure)
export function getAt(plan, path) / setAt(draft, path, value)
export function isGuess(plan, path) -> boolean
export function markGuess(draft, path, guess, today)
export function clearGuess(draft, path)
export function saveField(draft, path, read /* { value, guessed } from guessBox / ui.form meta */, guess, today)
export function guessesInUse(plan) -> [{ path, key, value, at }]
export function refreshGuesses(draft, estimate, today)
```

- **Tables**: `tools/build-estimates.mjs` reads `est/data/*.json` (kept outside the repo or under the git-ignored
  `vendor/`) and writes only the cells the estimators read to `core/estimate/data/<topic>.js` (pay, spend, balances,
  debts, home, health), each export carrying `{ table, publisher, title, url, dollarsOf, readOn: "2026-11-02" }`.
  Tests assert every estimator's `sources` resolve to a table with a `readOn`; a key with no sourced figure
  returns null (the box is then empty, with at most a labelled example in its help).
- `docs/CONVENTIONS.md` "Where things go" gets a row: "a population figure that guesses a blank input |
  `core/estimate/data/<topic>.js`, with its source and read date; the estimator in `core/estimate/` or a module's
  manifest `estimators`".
- Setup's `TYPICAL_RATES` move to `core/estimate/data/debts.js` (setup re-exports them, so nothing that imports
  them breaks); the mortgage guess for an existing loan switches to FHFA's state averages.

---

## 12. How the other builder's pages adopt it, without anyone editing their files

1. **Free on day one**: their pages get the guess note from the shell (6.1) through their manifest `needs`, and the
   guesses page lists and edits every guess whatever page made it.
2. **To show guesses in their own boxes** (their files only): add `guess: ctx.guess("<key>")` to a field in their
   `ui.form` schema, and in `onSubmit(values, meta)` call `saveField(draft, path, { value: values[k], guessed:
   meta.guessed.has(k) }, guess, today)` inside their `store.update`.
3. **To add a guess of their own** (e.g. goals/vehicle's sales tax by state, taxes/state's rate): export
   `estimators: { "goals/vehicle:salesTax": fn }` from their module.js, reading their own data tables.
4. **To move or hide the note**: `guessNote: "own"` (and call `ui.guessNote` under their hero) or `guessNote: false`.

---

## 13. Files

| file | change | lane |
|---|---|---|
| core/ui/base.css | one placeholder rule (3.2) | designer |
| core/ui/dom.js | `guessBox`, `guessLine`, `guessNote`; `form()` field `guess`, `zeroOk`, `onSubmit(values, meta)` | designer |
| core/app.js | `ctx.guess`; shell guess note above the page (manifest `guessNote`, `needs`); merge manifest `estimators` | builder |
| core/store.js | call `refreshGuesses` inside `update()` before saving | builder |
| core/estimate/index.js, marks.js, data/*.js | new (11.1, 11.2) | builder |
| core/schema/migrate.js | copy rateGuessed/paymentGuessed into `plan.guesses` (no version bump) | builder |
| tools/build-estimates.mjs | new: reduce est/data tables to the cells used | builder |
| modules/overview/guesses/{module,compute,view}.js, README.md, module.test.mjs | new page (7) | builder |
| modules/overview/setup/compute.js, view.js | section 5 | builder |
| modules/overview/dashboard/compute.js, view.js | checklist step rename, "Make our guesses yours" card (6.4) | builder (compute), designer (view) |
| modules/overview/guide/journeys.js | step rename; guessed rate counts as detailed | builder |
| modules/balance/liabilities, cashflow/expenses, balance/net-worth, property/home, retirement/social-security view.js | adopt `guess` fields and record lines (6.2, 9) | designer |
| compute.js strings in section 10 | plain words | builder |
| docs/DATA_MODEL.md (`guesses` row), docs/CONVENTIONS.md ("Guesses" section, "Where things go" row), docs/MODULE_CATALOG.md (overview/guesses row), CHANGELOG.md | same change | builder |

---

## 14. Tests (each formula and rule gets one)

- `tests/estimate-marks.test.mjs`: isGuess follows value equality; saveField typed / guessed / empty; a typed
  figure equal to the guess clears the mark; refresh rewrites only marks in use; migrate copies legacy marks once.
- `tests/estimate.test.mjs`: every key returns null or a Guess whose sources resolve to a table with `readOn`;
  low <= value <= high; the persona answer keys: Sam's rent $1,339, Jordan's mortgage rate 4.6%, Jordan's 401(k)
  about $36,900, card rate 22.36%, used-car rate 11.19%, Ohio toddler center care $1,044 a month.
- `modules/overview/setup/module.test.mjs`: a picked debt with only a payment is kept with owed and rate marked;
  a picked retirement tile with blank boxes makes the account; blank spending rows save marked guesses and the
  "Got it" line counts them; no placeholder in any screen is an example figure.
- `modules/overview/guesses/module.test.mjs`: tier 1 when the left-over sign flips between low and high; tier
  ordering; the words' rounding; empty plan → no rows.
- `tests/ui-form-guess` (node DOM-free check of readForm): blank with guess → value = guess, meta.guessed has key.

---

## 15. For the owner to decide (not decided here)

1. The plan's default stop-work age: keep 65 (with the "67 is full Social Security" sentence and chip, as above),
   or start new people at their full retirement age (67 for anyone born from 1960).
2. Whether a blank pay box (after "I work") may be guessed, or keeps meaning "no income line yet" (pay is the
   strongest predictor of everything else; a guessed pay ranks first on the guesses page every time).
3. Whether the Dashboard's "Make our guesses yours" card replaces "Import a bank file" while it shows, or sits
   above the three cards as a fourth.
