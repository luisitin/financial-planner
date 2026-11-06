# overview/guesses: Our guesses for you

**Status:** usable (C1 to C3 of the smart-guesses build plan: plumbing, data, this page; C2: the home and every debt
Get started asks about, so a picked debt is never dropped, and the "Better guesses are ready" card; C3: a month's
spending, row by row, so spending is never $0, and the verdicts that wait while it is mostly ours).

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
  until the person types over them, keeps them, or takes the "Better guesses are ready" card (below). "That's about right" or a
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
Hero; one notice from the last save (kept in a module-level `pending`); "Is this the same loan?" (below) when there is
one; "Matters most" (the first four big guesses, or every frozen and stale one when there are more; when one is frozen,
or an older payment is stale (below), it leads and the card is titled "Type these first"); then a fold with the rest:
"More of our guesses" when big ones spill over, else "Matters less" (small ones). Four keep the top to about a phone
screen (a plan that skipped three debts has nine big ones; C8's measured ranking decides which matter most); "These look fine" (sets
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
**"Better guesses are ready"** (spec 11.5, C2), right under the hero when `offers.upgrade` has rows: "We now fill in
figures from where you live and what you told us. These N would change; nothing moves until you say so." Each row is the
label, then "From $1,261 a month to $1,300 a month", then "Our new guess: why."; "Use the new guesses" (filled) writes them (`useNewGuesses`, notice
"Saved: the N new guesses are in your plan. They follow your answers from now on.") and "Keep the old ones" (outlined)
writes nothing but the choice (`keepOldGuesses`, notice "Kept: your older figures stay as they are. We won't ask
again."). Either way `guide.guessUpgrade = { at, choice }` and the card does not come back. Its rows have no box, so
the lists below it are unchanged. An amount that changes by under 2% (the cushion's $12,000 to $12,100) is not listed
("Plus one small change of under 2%."): it is written with the rest; the card shows only when a row is worth listing.
The card never lowers spending once work stops (`overview/setup:retireSpend`): it falls only when a re-guessed loan
"ends" before work stops, and a guessed mortgage payment holds the state's tax and insurance, which the payoff counts
as loan (on the older plan, $1,300 "ends" in about 2044 where its $948 of loan runs to 2056: $4,100 would have become
$2,840). The older figure stays until the person types one (spec 17.4: keeping is the safe default).
**"Is this the same loan?"** ("Is this the same home?"; "Did you add any of these twice?" for more): "You added Home
loan, $205,000. We also have Mortgage, with our guess of about $210,000 still owed. If they're the same loan, it's
counted twice now." with "Yes, the same loan" (filled; notice "Done: Home loan counts once, and our guess for Mortgage
is gone.") and "No, two loans" (outlined; "Kept both: ... We won't ask again."). The grey figures in the boxes use `--muted` (scoped to `.gs-root`:
4.8:1 in light mode, about 6:1 in dark; Chrome's own grey is 3.7:1 on the dark panel).
Ranking in C1 is by static weight (estimator `weight`, or the legacy weights below); the measured ranking (spec 11.2,
`compute(plan, { ranges: true })`, the "If it's off ..." line) arrives in C8.

## compute(plan, { estimators, tables, today })
`{ rows, top, count, frozen, stale, big, small, applies, sources: { used, all, orgs }, offers: { fill: [], upgrade: [] },
lookedAt, planEmpty }`. `rows`: `guessesInUse(plan)` (ledger + legacy) as `{ path, k, label, record, value, unit, kind,
why, weight, legacy, frozen, stale, href, sources, basis, order }`, sorted frozen first, then stale, then big, then
small, then by tier and order. `applies`: core/estimate `applies(plan)`; when false no row cites a table. The view
passes the registry merged from every manifest; without it the module's own is used.
`offers.upgrade` (C2) = `upgradeOffers(plan, o)`: nothing once `guide.guessUpgrade` is set or the gate is closed; else
every older (legacy) guess whose key an estimator has, in tier and order, each estimated on a copy of the plan on which
the ones before it are already written (`markGuess`), so a payment is offered at the new rate. A row is offered only
when the new figure differs from the old one, also after the old one is rounded the new way (so $12,034 against a new
$12,000 is not offered). Rows: `{ path, k, label, kind, unit, from, to, why }`. `useNewGuesses(draft, o)` writes them
in the same order on the draft (the ledger entry; the older flag mirrored, so Liabilities and the debt guide read it
as before) and returns how many; from then on `settle` keeps them fresh. On `guessedPlan()` (Ohio): the mortgage rate
7.24% → 4.6%, its payment $1,261 → $1,300 (with Ohio's tax and insurance, E22) and the cushion $12,000 → $12,100
(listed as "one small change of under 2%"). Spending once work stops ($4,100 → $2,840) is not offered: the card never
lowers it (below). `offers.fill` (11.4) stays empty
until C7.

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
| `overview/setup:retireSpend` | Spending a month once work stops | today's bills without childcare, plus loans still running then (from 50, C3: everyday costs as people 65-74 spend them, home costs and loans then) | (your own answers) | big |
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

## Estimators (estimators/common.js, home.js, debts.js; spec 7.C, 7.D)
Tier 2 in this order: the home first (the mortgage reads it), then each debt's rate, what is owed and the payment.
Every why-line is the first of its candidates that fits in 70 characters (`fit`). "Sharper if you tell us" lists at
most two of: your state, your pay, your age, what you pay a month, when you took out the mortgage / got the car loan,
what the home cost and when.

**What they share (common.js).** `profileOf(plan, today)`: the adults, the reference age (the oldest adult with a birth
date: the Survey of Consumer Finances' "age of the family head" in a couple), the household's income a year (every
income line running today, any kind, as the survey's family income is all of it) and whether any of it is a guess, the
state, the tenure (a mortgage picked or held: owner with a mortgage; a home and no mortgage: owner without one; else a
renter) and Get started's picks and taps; memoised per pass (`lib.memo("profile")`). `cpiSince(year)`: the published
CPI (retirement/historical's `RETURNS`, Damodaran/BLS) for every year after `year` to 2025, so a 2023 premium is
×1.0570 (spec 6.7: never the plan's own inflation setting).
**R2 on the Survey of Consumer Finances** (`scfR2(item, { income, age })`, the 2025 SCF "median value if held", by
income and age): value = all-families median × `rInc` × `resid`, where
- `rInc` = the median at the family's income / all. The income's percentile comes from the survey's income cut-offs,
  straight lines on log income from ($1,000, 0.5); the medians are joined by straight lines on their logs between the
  income groups' middle percentiles (10, 30, 50, 70, 85, 95) and held flat beyond them;
- `resid` = the age group's ratio with its typical income taken out: (age-group median / all) / (median at the age
  group's median family income / all). No income: the age group's own ratio; no age: 1;
- the spread is the age group's (else all families') sqrt(2 ln(mean / median)).

| key | order, unit, weight | formula | tables | why (examples) |
|---|---|---|---|---|
| `home.value` (E18) | 1, total, big | Home's purchase price × FHFA all-transactions HPI (state, 2025) / HPI (state, the year bought), when the Home page has the price, a year from 1990 and a state is set; declared spread 0.15. Else the ACS 2025 median home value for owners with (or without) a mortgage, state (else U.S.), × `rInc` × `resid` on the SCF primary residence (R2), measured spread | `fhfa_hpi_at_state_annual`; `acs2025_median_home_value_by_state_and_mortgage_status` + the SCF tables | "what you paid in 2018, grown with Ohio home prices since"; "typical for an Ohio home with a mortgage, on your pay" |
| `home.propertyTax` (E23) | 2, year, big | the home's value (typed or on file, else E18) × ACS median taxes / median value (Ohio 1.223%, U.S. 0.901%) | `acs2025_effective_property_tax_rate_by_state` | "Ohio homes pay about 1.2% of their value a year" |
| `home.insurance` (E24) | 3, year, small | NAIC 2023 average HO-3 premium (Ohio $1,116, U.S. $1,737) × CPI 2024-2025 (1.0570) | `naic2023_homeowners_premium_by_state` | "the average Ohio homeowner policy, in 2025 prices" |
| `debt.mortgage.rate` (E20) | 4, rate, big | the state's average contract rate on mortgages outstanding (FHFA NMDB 2026 Q2); no state: the U.S. figure by loan count (4.4%); tap "2022 or later": the 2025 new home-purchase rate, the state's, else the U.S. one (6.3%) | `mortgage_outstanding_fhfa_by_state_2026q2`, `mortgage_outstanding_fhfa_national`, `mortgage_new_purchase_fhfa_by_state_2025`, `mortgage_new_loans_fhfa_national_2025` | "the average on Ohio mortgages people already have" (Ohio 4.6%, Arizona 4.3%) |
| `debt.mortgage.owed` (E21) | 5, total, big | with the payment typed and the tap answered: pv(r/12, 360 − months since the middle of the span, P&I), declared spread 0.15. Else a prior: (a) a typed home × the state's average loan-to-value (FHFA; Arizona 47.6%), declared spread; (b) FHFA unpaid balance per loan in the state (U.S.: by loan count) × the SCF median-to-mean 0.767 × `rInc` × `resid` on the SCF mortgage, measured spread (sqrt(2 ln(mean / median)) of the SCF mortgage balance, all families: sqrt(2 ln(241,300/185,000)) = 0.73, read from the two cells). With a payment typed: at most pv(r/12, 360, P&I); when that bound does not bind, the why-line says the payment covers it | the FHFA state and national tables + the SCF tables | "typical in Ohio at your age and pay; your payment covers it"; "48% of your home's value, usual in Arizona; your payment covers it"; "typical for an Ohio mortgage at your age and pay" (no payment); "worked back from your $1,100 payment and when you took it out" |
| `debt.mortgage.payment` (E22) | 6, month, big | pmt(r/12, months left, owed) + tax and insurance a month (E23 + E24 / 12, or the yearly figures typed on Home / 12), unless the escrow tap says "no". Months left come from the tap only for a balance the person typed; a guessed balance (already the typical one, midway through people's loans) is paid over 360 | as read | "a loan of about $110,000 at 4.6%, plus Ohio's usual tax and insurance" |
| `debt.car-loan.rate` (E26) | 7, rate, small | new or used: whichever Experian class's average payment is nearer the typed payment in log terms (else its average amount financed nearer the balance; else the SCF balance). Used: Experian's average rate (11.19%); new: the Fed's 72-month bank rate (7.17%) | `auto_loan_terms_experian_q2_2026`, `auto_personal_rate_fed_g19` | "the average rate on a used-car loan" |
| `debt.car-loan.owed` (E25) | 8, total, big | no payment: the SCF vehicle-loan balance (R2). A payment typed: pv(r/12, term/2, payment) with the spread ln(pv at three quarters / pv at a quarter)/1.349, combined in logs with the SCF figure (R4); with the tap, pv(r/12, months left, payment), spread 0.25. Asks the tap when the spread is over 0.5 | Experian + the SCF tables | "worked back from your $420 payment, about halfway through a usual loan" |
| `debt.car-loan.payment` (E27) | 9, month, big | pmt(r/12, term/2, owed); the tap's months left only for a balance the person typed (a tap never turns the typical balance into a steep payment) | Experian | "what pays off $12,000 at 11.2% in about 34 months" |
| `debt.credit.rate` (E28) | 10, rate, big | G.19 "accounts assessed interest", August 2026: 22.36% → 22.4% | `cc_apr_fed_g19` | "the average rate on cards that charge interest" |
| `debt.credit.owed` (E29) | 11, total, big | the SCF card balance (R2); with a payment typed, at most payment / (1% + r/12) (the usual minimum, CFPB) | the SCF tables, `card_minimum_payment_rule_cfpb` | "typical card balance at your age and pay"; "worked back from your $20 payment, if that's the minimum" |
| `debt.credit.payment` (E30) | 12, month, big | min(owed, max($40, 1% of owed + a month's interest)) (CFPB), rounded inside the estimator (R11's $10) and never above the balance after rounding ($35 owed: $35) | `card_minimum_payment_rule_cfpb` | "the month's interest plus 1% of what you owe, a usual minimum" |
| `debt.student.rate` (E31) | 13, rate, small | Direct Subsidized/Unsubsidized undergraduate, 2026-27: 6.52% → 6.5% | `student_loan_rates_federal` | "the federal rate on new undergraduate student loans" |
| `debt.student.owed` / `.payment` (E31) | 14 / 15 | the SCF education-loan balance (R2), at most pv(r/12, 120, payment) when a payment is typed; the payment pmt(r/12, 120, owed) | the SCF tables | "what pays off $26,000 at 6.5% over 10 years, the standard plan" |
| `debt.loan.rate` / `.owed` / `.payment` (E32) | 16 / 17 / 18, small | the Fed's 24-month personal loan rate (11.9%); the SCF other-installment balance, at most pv(r/12, 36, payment); pmt(r/12, 36, owed) | `auto_personal_rate_fed_g19` + the SCF tables | "what pays off $6,000 at 11.9% over 3 years" |

P&I is the payment less tax and insurance a month, not rounded (E23 + E24 / 12: 210,000 × 1.223% / 12 = 214.0 and
1,116 × 1.057 / 12 = 98.3), the same arithmetic as the spec, and never less than half the payment:
P&I = max(payment − tax and insurance, payment / 2). Without the floor a payment just above the usual tax and insurance
($313 in Ohio) worked back to almost nothing ($130 owed) while $312 gave $61,000; with it, a higher payment never owes
less (R3), and the 7.H keys are unchanged (Jordan's $788 and Pat and Lee's $1,329 are above half the payment). Tax and
insurance typed on Home (`property[].propertyTax`, `.insurance`, a year, above 0 and not a guess) win over the
state's figures, so the work-back and the payment follow them (settle). A typed figure always wins: each estimator reads the
screen's answers first (`args`: a key present is the box, a number or null when blank), else the plan's figure when it
is not a guess. A rate it works with is the typed one, else our guess for it (an earlier key), so a typed rate is
used for the payment and the work-back.

**The one tap per debt** (`ask`, Q5b shows the first): the mortgage's "When did you take out this mortgage, or last
refinance it?" (Before 2010 / 2010 to 2019 / 2020 or 2021 / 2022 or later / Not sure; the middle of each span:
2007-07, 2015-01, 2021-01, 2024-01; saved as `guide.setup.taps["mortgage-start"]`), asked only when the payment is
typed; the car loan's "When did you get this car loan?" (This year / 1 or 2 years ago / 3 or 4 / 5 or more / Not sure:
6, 24 or 48 months gone, or about 6 months left; `taps["car-loan-start"]`), asked when the work-back's spread is over
0.5. "Not sure" is no answer.

**7.H answer keys** (module.test.mjs, the arithmetic in comments; R11 rounding wins where a 7.H figure is unrounded):
Jordan (Ohio, $58,000, 41, a $1,100 payment): home $210,000, tax $2,550 a year ($210 a month), insurance $1,200 a
year ($100 a month), rate 4.6%, owed $110,000 (7.H's $111,000 is the unrounded $111,114), tap 2010s $116,000, a blank
payment $880. Pat and Lee (Arizona, $125,000, 61, a typed $450,000 home, $1,600): tax $2,000 a year ($170 a month),
insurance $1,250 a year (the unrounded $105.2 a month is 7.H's $110), rate 4.3%, owed $210,000 (7.H's $214,000 is the
unrounded $214,200), tap 2010s $201,000. Sam (Texas, $48,000, 24, a $420 car payment, $3,000 on cards): car rate
11.2%, owed $12,000 (7.H's $12,500 is the unrounded $12,464), card rate 22.4%, payment $90 (7.H's $86 unrounded).

**Where this differs from the spec, and why.**
- The 2010-2019 span's middle is January 2015 (the spec's text says July 2015; its own 7.H figures and the span's true
  middle use January).
- E23 and E24 are yearly figures (Home's property tax and insurance boxes are a year); 7.H's monthly figures are
  checked as a year / 12. Inside E21 and E22 the monthly tax and insurance are not rounded.
- E25 works back with the plan's rate (typed, else E26), and E29/E31/E32 take the smaller of the SCF figure and the
  payment's bound, so a small typed payment is never read as a large balance.
- The card payment's floor is $40 (the CFPB table's most common floor), never more than the balance.
- A plan the gate closes (not U.S. dollars, outside the U.S.) keeps Get started's older behaviour on Q5b (the typical
  rate, a blank balance saves nothing).
- E22 includes tax and insurance (people know their whole payment); Pay off debts and Timeline then count that whole
  payment against the balance, as they already did for a typed payment. Filed for the owner: escrow is not principal
  (est/c2/c2-fix.md, UX 1: a `debts[].escrowMonthly` the payoff math subtracts is the proposed fix; it touches
  core/math/payoff.js and every page that reads `minPayment`, claude-a's debt/consolidation and cashflow/statement among
  them).
- The 0.5 floor on P&I (above) is ours: the spec subtracts the tax and insurance in full.

**"Is this the same loan?"** (`guessTwins`, `sameLoan`, `twoLoans`; `offers.twins`, present only when there is one to
ask). Get started keeps every debt picked, with our guess of what is owed, and the home Q5b asked about. A person who
later adds the real loan or home on Net worth or Debts would have it counted twice (Pat and Lee: net worth $563,000
instead of $773,000, $3,200 a month of payments; Jordan with a $300,000 house added: $400,000 instead of $190,000). A
Get started debt (`setup-owe-<kind>`) or home (`setup-have-home`) whose balance is still our guess, beside an account
of the same type made elsewhere with a balance that is not a guess, is listed first on the page
(`{ kind: "loan" | "home", id, name, amount, twinId, twinName, twinAmount }`); a Home page entry on our home moves to
theirs on Yes. "Yes, the same loan" removes ours
(its account and the guess on it); when their loan has no row on Debts yet, our row moves onto it under the id
`debt-<their account id>` with its ledger entries, so our rate and payment guesses follow their balance and a payment
typed on Get started stays. "No, two loans" stores `guide.setup.twins[<our id>][<their id>] = today` and the question
is not asked again for that pair; a loan or home of the same kind added later is asked about (a HELOC answered "No",
then the real home loan added: asked, so it is not counted twice in silence).

## Spending (estimators/spend.js; spec 7.0, 7.A, R10, 7.F)
Tier 3, one key per row of Get started's spending screen (setup's `SPEND`, whose `covers` must equal `COVERS` here; a
test checks): `spend.housing`, `spend.utilities`, `spend.groceries`, `spend.transport`, `spend.insurance`,
`spend.childcare`, `spend.dining`, `spend.shopping`, each a guess at `expenses[setup-x-<row>].amount`, a month, declared
spread 0.25 (not measured), so R11 rounds to $10 under $1,000 and $50 above. `spendModel` works out every row at once
(memoised per pass) and is what keeps the screen and the plan in step:

- **What is typed** (`args` = the screen's `{ mode, rows: { [row]: number | null }, total, taps }`, setup's `spendArgs`;
  else the plan): a setup row whose amount is our guess is ours; every other bill is typed; a row typed as 0 is the
  person's 0 (`guide.setup.spendZero`). The model never reads a guessed row's own figure, so refreshing one row moves no
  other. A bill typed elsewhere (Expenses) in a row's categories (Expenses' `ROW_HOLDS`: the row's own categories, plus
  subscriptions and pets in eating out and fun and personal care in shopping, which the survey's entertainment and
  personal care put there; C3 money review D5) comes off that row's guess, so it is never counted
  twice; a housing bill that is the mortgage's own payment does not.
- **Take-home a (7.0, `takeHome`).** Every income line coming in today (pay as wages, Social Security as such, the rest
  as other income; a line marked untaxed is added as it is), less federal income tax (`core/math/tax` `federalTax` with
  the filing status, children under 17 (a child of unknown age counts as one), adults 65 or over, and typed pre-tax
  saving to a 401(k), traditional IRA or HSA: a contribution that is our guess is tier 4 and left out; refundable credits
  in), less the state's income tax: the State page's typed rate x AGI, else none in a state with no wage tax
  (`NO_WAGE_TAX`), else the flat rule (`FLAT`, `flatTax`), else (a graduated state, or no state) a = income x the
  survey's own after-tax ratio at that income (`taxRatio2023`, log-log between the fifths). The spec's 7.0 counts pay
  only; every line is counted here so a retired household's pension and Social Security are not $0 (the personas are
  unchanged). S $44,420 (federal $3,580), J $57,813 (federal -$692, Ohio $879), N $112,040.
- **Flexible rows** (utilities, groceries, car and transit, insurance and health, eating out, shopping):
  `sQ_r(a) x r_hh x r_reg x a / 12`. `sQ_r` is the share of after-tax income the survey's second to fifth income fifths
  spend on the row (items below), against `A(fifth) = 2025 income before taxes x the 2023 after/before ratio`, log-log
  between them and flat outside (the lowest fifth, retirees spending savings, is left out; no extrapolation above the
  top fifth). `r_d(cell) = [share(cell)/share(all)] / [sQ(A(cell))/sQ(A(all))]` (cells with no 2023 after-tax column take
  the ratio at their income). Household type (spec 5.4): one person, one parent (a child under 18), a married couple by
  the oldest child (unknown ages: all couples with children), three adults or more: all households. Region: the
  state's Census region (`STATE_REGION`). No income: the household type's own share at its own income (income
  integrated out), with "your pay" as a sharper. Utilities use the tenure ratio and `1 + energyShare (0.523) x (the
  state's EIA electric + gas bill / the U.S. one - 1)` in place of the region; car and transit scale the insurance part
  (`vehicleInsShare` 0.269) by the state's NAIC average car insurance over the U.S. average.
  The home as the spending rows price it (`spendTenure`): the profile's tenure, except that a mortgage counts only while one
  is owed (an account of type mortgage with a balance, Get started's `hasMortgage`). A mortgage picked on question 5 and
  later removed or paid off is not one any more, so the home's property tax and insurance (in its payment before) come back
  into "Home costs" at the next save; question 6 then asks for "Home costs" (C3 verify: with the pick alone they stayed out,
  about $271 a month for Pat and Lee, counted nowhere). Test: setup "C3 verify: a mortgage removed after Get started ...".
  Items: groceries = foodAtHome + housekeepingSupplies; car and transit = gasoline, maintenance and repairs, rentals
  and licences, vehicle insurance, public transport (purchases and loan interest are on What you owe); insurance and
  health = healthcare + life and other personal insurance; eating out and fun = food away, entertainment, alcohol;
  shopping = apparel, personal care, furnishings, reading, tobacco, miscellaneous, other household expenses (education
  and cash gifts have goal pages).
- **Rent (E01).** `ACS median gross rent (state, else U.S. $1,557) x contractShare 0.897 x [sQ_rent(a) x a / rent per
  renter (all)] x r_hh,rent`, rent per renter = rentedDwellings / share renting; no region ratio (the state anchor is
  local). S: 1,515 x 0.897 x 0.867 x 1.038 = $1,223 -> $1,200.
- **Home costs besides the mortgage (E01).** Upkeep `value x 0.293% (AHS 2023 aggregate maintenance / value) x CPI
  since 2023 / 12` (the home's value typed or our `home.value`; none: the AHS mean $1,363 x CPI / 12), plus the HOA fee
  by the share of the state's owners who pay one (ACS 2025; U.S. with no state): under 35% left out, over 65% the state's
  median fee (with or without a mortgage), in between asked ("Do you pay an HOA or condo fee?"; unanswered or Not sure
  takes the likelier side; the spec has the box wait for the answer, but a box with no grey figure would save nothing,
  so the likelier side is shown while it asks), plus property tax and insurance (`home.propertyTax`, `home.insurance`,
  or the Home page's typed ones) when there is no mortgage or the escrow tap says they are not in the payment. J $50,
  N $120 (Arizona 48.8%: asked; No is the likelier side).
- **Insurance and health (E05)**, by the `health-cover` tap (asked once): through work, KFF's worker contribution
  ($139 a month single for one adult and no children, else $623 family) plus the out-of-pocket share (medical services,
  drugs, supplies); Medicaid or Medicare, for each adult 65 or over Part B $202.90 + the Part D base premium ($38.99 in
  2026, $41.33 in 2027) + the state's Medigap Plan G average, plus out of pocket (under 65: out of pocket only); own,
  Not sure or unanswered, the survey's healthcare + life insurance share. The Marketplace price before help is not used:
  the help depends on income (retirement/healthcare works that out). The premium is a price (not scaled by R10); the
  out-of-pocket part is a share and is. So through work S is $139 + 90 x 0.794 = $210 and J $623 + 120 x 0.783 = $720,
  where the spec's E05 text ($230, $740) adds the share before R10.
- **Childcare (E06)**, always asked ("Do you pay for childcare or after-school care?"): Yes prices each child under 13
  whose age is known at Child Care Aware 2025's full-time center price for the state (under 1 infant, 1-2 toddler, 3-5
  the "four-year-old" figure, 6-12 before and after school), / 12; a state it has no figure for, NDCP 2022's weekly
  price x 52 x CPI since 2022, then NDCP's last earlier year x CPI since then; no state (or New Mexico, in neither), the
  middle of the states' Child Care Aware figures. No and Not sure write nothing. J Yes: (10,552 + 6,162) / 12 = 1,392.8
  -> $1,400 (R11's $50 steps; the spec writes $1,390).
- **R10, the envelope.** Households like this spend `sQ_env(a) x r_hh x r_reg x a / 12` a month in all (the survey's
  total less personal insurance and pensions, cash gifts and education, plus the mortgage principal it reports as a
  negative). The flexible rows ours are scaled by `k = clamp((envelope - typed bills and loan payments - our prices) /
  our flexible rows, 0.5, 1)`. S: envelope $3,221, typed loans $510 (the car's $420 and our card minimum, R11-rounded to
  $90 in C2; the spec's 0.764 used $86), k 0.762, eating out 295 x 0.762 = 224.8 -> $220 where 7.H says $230 (R11 wins),
  total $2,680 (7.H $2,690). J: $4,986, k 0.918, $3,000. N: $7,763, k 1, $5,260.
- **Bias, stated.** The survey's lower-income and one-parent cells report spending above their after-tax income (the
  second fifth spends $51,405 on $46,080 before tax; one-parent outlays are 103% of after-tax income), so spending
  guesses lean high for households under about $60,000 after tax and left-over guesses lean low. The envelope and the
  waiting verdict (Next best action's `spare.waits`, Expenses' `guessedShare`) contain it; nothing hides it.
- **Retirement (7.F; `RETIRE_RATIO`, used by setup's `overview/setup:retireSpend`).** What households 65-74 spend on a
  row over households 55-64 (CE 2025 by age): utilities 0.880, groceries 0.953, car and transit 0.792, eating out 0.876,
  shopping 0.859. A mortgage still running when work stops is counted in setup's figure with its whole payment, which
  holds the home's property tax and insurance (E22), so those two are added on top only when the mortgage ends before
  work stops (C3 money review D9). Pat and Lee: about $3,790 of costs plus the $1,600 payment, $5,390 (spec 7.H's "$4,100
  + mortgage" counted the $280 of tax and insurance twice; the figure is one amount for every year of retirement).
- **The basis line (`spendBasis`)**: "The grey figures are what a household like yours usually spends: one adult
  renting in Texas on about $48,000 a year." **E10 (`missingSpend`)**: every row typed and the month under exp(-2.33 x
  0.25) = 0.56 of the household's guessed total; shown in C7. R12 (bank files) stays off until C7.

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
- **R10** the household envelope (C3, "Spending" above). R7 (couples split by pay), R8 (totals are sums) and R12 (bank
  files) are the saving and bank commits' (C4, C7).

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
inflation setting (`cpiSince`; C2's home insurance is NAIC 2023 × 1.0570; the others arrive in C3).

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
handled (M later)"; a `later:` row whose commit is built fails. C1: 48 handled, 143 later. C2: the six Get started
rate boxes are `guess:debt.<kind>.rate` (54 handled, 137 later). C3: Get started's insurance and shopping rows
(`guess:spend.insurance`, `guess:spend.shopping`) and its retirement spending question
(`guess:overview/setup:retireSpend`): 57 handled, 134 later.

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
C2: the 7.H answer keys for the home and every debt (Jordan, Pat and Lee, Sam from `qa/fixtures/setup-personas.mjs`,
built with Get started's apply functions up to Q5b), the purchase-price case (FHFA HPI), the start taps, the card
floor and bound, student and other loans, no state (national figures, "your state"), the gate, the profile, and the
"Better guesses are ready" card (offers, both buttons, drawn with the stand-in kit).
C3: take-home a for S, J and N (and the C4 pre-tax case, a guessed contribution left out, a graduated state, no
income); every 7.H spending cell (rows, envelope, k, totals, R11 noted); the envelope holds for the personas and every
qa household archetype, spending is never $0, S's living share 0.70-0.85, J's flexible rows scaled and housing not,
flat above the top fifth; monotone at a bucket edge and in the spread; the HOA hurdle (Ohio left out, Arizona asked,
Yes adds the fee), childcare always asked (Yes $1,400 for J, No and Not sure nothing, the NDCP and no-state
fallbacks), health cover asked once; E05 by tap (work, Medicare, Medicaid); a bill typed later on Expenses comes off
its row (and comes back when removed); the 7.F ratios and N's figure from 50; the $15,000 rent slip; the rows agree with
setup's; the basis line and E10.
`qa/fixtures/guessed-plan.mjs` is a household made through Get started with the unknown boxes left empty (the older
guesses in place): the tests and the screenshots use it.

## Next (spec 15)
C2 (built) debts are never dropped; C3 (built) spending; C4 retirement
saving; C5 the questions and the reveal (pay, goal targets); C6 the form kit and the pages outside setup (`restsOn`);
C7 existing plans and bank files; C8 verdict ranges and the measured ranking; C9 calculator previews and coverage;
C10 plain words.
