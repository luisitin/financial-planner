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
- A gray figure in an empty box is exactly what the plan counts if the box stays empty. An empty box with no gray
  figure counts as nothing. What the person types always wins and is never moved.
- One why-line per guess, at most 70 characters after "Our guess: ", naming the answers it used; no publisher, year or
  statistics words on screen. Publisher, table, year and read date sit in one fold here ("Where our guesses come from").
- A guess never turns anything green, amber or red by itself.

## How it is stored (core/estimate; docs/CONVENTIONS.md "Guesses"; docs/DATA_MODEL.md `guesses`)
A guess is an ordinary value in its field plus one ledger entry `plan.guesses[path] = { k, v, u, s, at, d }`. The
field counts as a guess only while it still equals `v` (`same()`, per unit: rates within 1e-9, money within $0.005).
- **S1** only a page that saves a box the person saw with its gray figure creates one (`markGuess`, `saveField`).
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
"69 tables from 18 publishers" (`org` counted). A plan that takes no U.S. figures (the gate) gets no list there:
"We fill in typical figures only for households in the U.S. that count in dollars, so none of these tables is used for
your plan." Rates are shown and saved to a thousandth of a percent (6.125%), as Get started keeps them. Saving a debt's
rate while its older payment still stands adds "Your payment of $1,261 a month was worked out at the old rate, so type
your real one too." Records, never a table (390 px). Saving: Save (or Enter) commits through `saveField` as a typed figure;
"That's about right" through `confirmGuess`. A save is not made on blur: the re-render after a blur-save would move the
button under the finger before a tap on "That's about right" lands. Empty state: an empty plan points to Get started; a
plan with every figure typed says so, says a figure filled in later will show here, and offers the Dashboard. Rows of
the older guesses keep the setup's order (each debt's payment, then its rate; people in household order).
**"Fill in what you skipped"** (spec 11.4, C7), after "Is this the same loan?" and before "Better guesses are ready",
when `offers.fill` has items: "When your plan was set up, some boxes were left blank, so these aren't counted yet. Here
is what's typical for a household like yours." One record per debt ("Mortgage, about $110,000 owed", "$880 a month at
4.6% a year" or, with the payment typed on Expenses, "$1,600 a month (your “House payment” on Expenses) at ...", with no
home in the plan "Your home: worth about $210,000", "Our guess: why.") and one for the spending ("Day-to-day spending
(not the mortgage)" with a mortgage, else "Everyday spending", "about $3,230 a month", "Our guess: typical for one parent
of two paying a mortgage in Ohio on about $58,000 a year.", "Once you stop working: about ...", question 6's open
questions as chips (below), and on this page the rows in a fold, "How it adds up", where with a mortgage the home's row
is "Home upkeep (tax and insurance are in the mortgage payment)"); one line of what else the tap changes (`fillEffect`:
"This counts the $110,000 you owe on your home and your home, worth about $210,000, so what you own minus what you owe
goes up by about $100,000, and about $3,230 a month of spending.", thousands rounded); "Nothing changes until you tap.
After that, you can type your real figures any time on Expenses and Debts."; "Use these guesses" (filled;
`useFillGuesses` with the card's answers; notice "Saved: your mortgage (about $110,000 owed) and about $3,230 a month of
spending are counted now. Type the real figures on Expenses and Debts when you have them.") and "Not now" (outlined;
`fillLater`; "Nothing was changed. We'll ask again in a month; Our guesses for you keeps them until then."). After "Not
now" this page keeps the offer folded ("Skipped for now: your mortgage and your spending", the same card inside, with
`ignoreLater`); the 30 days apply to the Dashboard only. With the card (or the fold) and no guess in use yet, it is the
page (the "every figure is one you typed" card would say the opposite). **The card's questions** (C7 UX review 5):
question 6's taps the rows still need (health insurance; childcare with a child; an HOA fee where the state's share is
asked), each as chips (`role="radio"`); an answer redraws the card with the figures it gives (`fillOffers` with `taps`;
nothing is written), the question stays with its answer picked, and "Use these guesses" writes the answers where
question 6 keeps them (`guide.setup.taps`, creating `guide.setup` with them alone on a plan Get started never saw).
**Undo** (UX review 7): after a tap that writes figures (Use these guesses, Add our guesses for the rest, Use the new
guesses) the green notice carries an outlined "Undo" for the next render: `undoOf(plan)` keeps the plan's parts a tap
may change (accounts, debts, expenses, goals, income, household, retirement, guesses, guide) as they were, and Undo
puts them back through `store.update` ("Undone: your plan is as it was before the tap."). The same cards are drawn by
`fillCard`, `missingCard` and `upgradeCard` (exported, with `sayNotice` and `registryOf`; scoped `.gs-card` styles) for
the Dashboard and Expenses. On Expenses with nothing listed (UX review 8) `fillCard(..., { onMine, only, title })`:
with the spending alone, "Not sure what you spend?" ("Households like yours (who) spend about $X a month, besides the
mortgage. Use our guesses to start, and type your own figures as you learn them.", "Use these guesses" writing the
spending alone (`only: "spend"`, no `fillSkipped`) and "I'll type mine", which writes nothing and goes to the form);
with a debt left out too, the Dashboard's card and figures. "Not now" on the Dashboard does not hide it there.
**Rows read from the bank files** (R12, UX review 11) are not "our guesses": they fold apart, "Read from your bank
files" with their count ("These follow your bank files as new ones come in. Type your own figure to keep one as it
is."), each "From your bank files, September and October." and no "That's about right". With every spending row from
the bank the hero's lede says so. While bank files are in but set no row (R12 held, below) the spending row carries
why and what to do (`spendBankNote`, e.g. "Your bank files cover September and October, but about $300 a month went to
your Visa, and its file isn't in. Bring it in, and our spending guesses become what your bank shows. Bring in the Visa
file ›"). With a guessed mortgage payment in it the spending row is "Spending, with the mortgage payment" (one name for
each figure, UX review 4).
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
is gone.") and "No, two loans" (outlined; "Kept both: ... We won't ask again."). The gray figures in the boxes use `--muted` (scoped to `.gs-root`:
4.8:1 in light mode, about 6:1 in dark; Chrome's own gray is 3.7:1 on the dark panel).
Ranking in C1 is by static weight (estimator `weight`, or the legacy weights below); the measured ranking (spec 11.2,
`compute(plan, { ranges: true })`, the "If it's off ..." line) arrives in C8.

## compute(plan, { estimators, tables, today })
`{ rows, top, count, frozen, stale, big, small, applies, sources: { used, all, orgs }, offers: { fill, upgrade, twins? },
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
lowers it (below).

### "Fill in what you skipped" (`offers.fill`, spec 11.4, C7)
`fillOffers(plan, o)`: what one tap would write, worked out on a copy (nothing is written), as a list of cases
(`FILL_CASES`), each `{ id, can, find, write, endsWhenUsed }`, run in Get started's order; each case is worked out from
the plan as the cases before it leave it (written and settled on the copy, as the store settles after each of Get
started's screens), so the spending is guessed with the filled-in mortgage's payment counted. Nothing at all while the
gate is closed (EUR, "outside the U.S.") or for `FILL_AGAIN_DAYS` (30) after "Not now". Built now:
- **debt**: a kind picked on Get started's question 5 (`guide.setup.picks.owe`, not "none") with no `setup-owe-<kind>`
  account, Get started past its debts (`at` is spend, goals, goal-details or done, or `finishedAt`), not kept elsewhere
  (an account of its type added on Net worth or Debts; a car loan is a loan named car, auto, vehicle or truck, as setup's
  `existingOwe` reads it), and not a card answered "I pay it in full". Get started before the guesses dropped such a debt
  when its balance was left blank. The item: what is owed, the rate and the payment (E20-E32: `debt.<kind>.owed`,
  `.rate`, `.payment`, with question 5b's args, every box blank and its start tap if one was given), and with a mortgage
  and no home in the plan the home's value (`home.value`, as question 5b asks it then). `write` puts the account and the
  debt row exactly as question 5b's `put` does (an existing record gets only the figures), marks the three (four) as
  our guesses, renames a typed "Rent" row "Rent or mortgage" (our "Rent" row "Home costs"), and adds "home" to
  `picks.have` (`homeFromOwe`) when it adds the home. Fixes after the C7 money review (each with a test that failed
  first): **M4** kept elsewhere (`keptElsewhere`): with only the car loan picked, any loan added on Net worth or Debts is
  it, whatever its name ("Honda Civic", "Ally loan"), unless the name says personal, student or another kind
  (`notCarName`); with both the car loan and another loan picked, a car's name or maker (car, auto, vehicle, truck,
  Honda, Toyota, Ford ...) is the car loan and any other name the other loan. **M6** a `setup-debt-<kind>` row on Debts
  without its account was removed on Net worth on purpose: not offered; and `write` never writes over a debt row that is
  there (only a fresh row gets the rate and payment and their marks). **M5** a payment typed on Expenses
  (`typedPaymentOf`: for the mortgage a housing bill named mortgage, house or home payment, or a lender's name, or within
  10% of our payment and not rent; for the car loan a bill named car, auto, the maker or the lender, under transport or
  "Loan and card payments") is the debt's payment: written as typed (not marked: Expenses matches it, so it counts once),
  and what is owed and the rate are worked back from it with question 5b's args (`payment` given), as question 5 does.
  Expenses ties a loan's payment to its bill only under "Loan and card payments" (`matchDebts`), so a car payment typed
  under "Car, gas and transit" would be counted twice after the tap (the bill, and the loan's payment from Debts): `write`
  moves that bill under "Loan and card payments", and the card says so ("moved under Loan and card payments so it counts
  once"; `paidUnder`). A mortgage's bill under housing stays where it is (Expenses' `mortgageFiled` reads it there). (C7
  verify V1, 2026-11-06.)
- **spend**: income on file now (not once-only, active today), no expense and no bank line, and Get started not started
  or past its spending screen (goals, goal-details, done). The item: each of question 6's rows as it writes them with
  every box blank (7.A; one spending plan, one envelope: `spend.<row>` with `args = { mode: "rows", rows: every row
  null }`), childcare only with a child listed and only once its question says Yes (none here: it is not offered), a row
  typed as 0 (`spendZero`) left the person's 0; and, for a plan made through Get started with no figure for it yet,
  spending once work stops (`overview/setup:retireSpend`, the same screen's; not for a plan built on the pages, nor when
  every adult is retired). `write`: `setup-x-<row>` rows with setup's shape (name, category, essential = a must-pay row,
  monthly, inflating) and `spendMode: "rows"`, each marked. `o.taps` (the card's chips: health-cover, childcare, hoa
  only) go into the rows' args as question 6's would, the item lists the questions still open (`asks`, from the
  estimators' `ask`) and the answers (`taps`), and `write` keeps the answers in `guide.setup.taps`. With a mortgage the
  item says so (`mortgage`): its payment is counted from Debts, so the home's row is its upkeep. A mortgage added on Net
  worth with no payment on Debts (kept elsewhere, so the debt case leaves it) is counted nowhere yet: `mortgageUnpaid`, and
  the card says "Your mortgage's payment isn't on Debts yet, so it isn't counted. Add it on Debts ›" (C7 verify V2). `o.only` runs one case
  (Expenses' spending card); `o.ignoreLater` lists what "Not now" put off (this page's fold, Expenses).
- **Later** (not built): C4 adds a retirement tile picked with no account for an adult (balance, contribution, match;
  a contribution with amount 0 and match 0 becomes a question, "Do you put money into it from your pay?", never a
  figure); C5 a setup goal with target 0 (education, home). Each is one more entry in `FILL_CASES`.
`useFillGuesses(draft, o)` runs the same cases on the draft (inside `store.update`; the store's settle after it moves
nothing, a test checks) and sets `guide.fillSkipped = { at, choice: "used" }`: a case with `endsWhenUsed` is not offered
again (a debt or the spending removed later was removed on purpose). `fillLater(draft, today)` writes only
`guide.fillSkipped = { at, choice: "later" }`. Shown items: `{ case: "debt", key, name, owed, rate, payment, paidAs, home, why }`
and `{ case: "spend", rows: [{ row, name, label, value, why }], total, retire, who, mortgage, asks, taps }` (`who`:
`householdWords`). `fillEffect(items)` = `{ owed: sum of owed, home: sum of the homes added, net: home - owed, spend:
the spending's total }` (the card's line of what else changes). On the three
7.H households made before the guesses (setup-personas, Q5b's owed boxes blank, Q6 skipped), one tap makes the plan
Get started makes today with the same boxes blank (key order aside; module.test.mjs).
Known limit: a debt removed later while Get started's pick stays, on a plan that never tapped, is offered again (nothing
in the plan tells it from a dropped one); the person taps "Not now" (a month) or adds it. An "I don't have it any more"
choice is the owner's call (C7 report).

### The Dashboard's cards (`guessCards(plan, o)`, spec 11.3; overview/dashboard compute's `guesses`)
`{ fill, missing, upgrade, first } | null`: "Fill in what you skipped" (`fillOffers`), "Is something missing?"
(`spendMissing`, below) and "Better guesses are ready" (`upgradeOffers`), each only while it has something. The
Dashboard shows one at a time: `first` is fill (blanks that leave a figure out), else missing (a list far too short),
else upgrade (older figures). Fill and missing sit right under "where you stand" (C7 UX review 2), and while one is up
the rows it decides wait on it: "Left over each month" ("Depends on your spending: not counted yet", or "...: your list
may be missing about $2,460 a month", or "Depends on what you owe: not all counted yet"), "Safety cushion" while it is
open and the spending is not counted ("Needs your spending") and "Retirement" with any verdict ("Depends on the figures
below"), each with no coloured dot, "See below ›", and a tap that scrolls to the card (one way to fill in spending, UX
review 4). "Better guesses are ready" comes after the money tiles, with the same filter and why-lines as this page
("Our new guess: ...", "Plus one small change of under 2%.") and "See all on Our guesses for you ›" as a link (UX
review 10). `guessCards` adds `fillEffect`. The Dashboard compute adds the key only when given a day (its view asks
with the registry merged from every manifest); the shell's own `compute(plan)` is as before.

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
| `home.boughtYear` | 1 (tier 1), year-date, big | `floor(today - T)`, T = the middle of the owners' move-in years for the age, cut at age 20 (README "When the home was bought") | `acs2025_year_moved_in_by_age_us`, `acs2025_owner_households_by_age_us` | "Most owners your age bought in the last few years." |
| `home.value` (E18) | 1, total, big | Home's purchase price × FHFA all-transactions HPI (state, 2025) / HPI (state, the year bought), when the Home page has the price, a year from 1990 and a state is set; declared spread 0.15. Else the ACS 2025 median home value for owners with (or without) a mortgage, state (else U.S.), × `rInc` × `resid` on the SCF primary residence (R2), measured spread | `fhfa_hpi_at_state_annual`; `acs2025_median_home_value_by_state_and_mortgage_status` + the SCF tables | "what you paid in 2018, grown with Ohio home prices since"; "typical for an Ohio home with a mortgage, on your pay" |
| `home.propertyTax` (E23) | 2, year, big | the home's value (typed or on file, else E18) × ACS median taxes / median value (Ohio 1.223%, U.S. 0.901%) | `acs2025_effective_property_tax_rate_by_state` | "Ohio homes pay about 1.2% of their value a year" |
| `home.insurance` (E24) | 3, year, small | NAIC 2023 average HO-3 premium (Ohio $1,116, U.S. $1,737) × CPI 2024-2025 (1.0570) | `naic2023_homeowners_premium_by_state` | "the average Ohio homeowner policy, in 2025 prices" |
| *The three `debt.mortgage.*` rows below are the 2026-11-02 rules. Since 2026-11-07 the rate, the balance and the payment are worked from the year the home was bought unless the payment and the balance are both typed or a refinance was tapped; see "When the home was bought" below.* | | | | |
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

## When the home was bought (estimators/purchase.js, home.js, debts.js; owner's request 2026-11-07)
The owner: a 25-year-old couple should not be told their mortgage has 12 years left. Two things made it so, found by walking a
couple of 25 through Get started with nothing typed, with a payment only, a balance only and a home value only (BEFORE table in the
build notes): **(1) the balance prior** (E21) is the average over all mortgages outstanding, loans people took out 15 years ago included,
so a first-time buyer got a mid-life loan and, with a payment typed, the tap-less path paid it over 360 months from today; **(2) the
pages counted the whole payment, tax and insurance included, against the balance** (Debts, the mortgage page, Pay off debts, Timeline
and the rest read `debts[].minPayment` as principal and interest), which cost a loan begun in 2024 about 11 of its 27.5 years on those
pages (review 2026-11-07, D1). Both are fixed here: (2) by **`loanEscrow`** (home.js): the tax and insurance inside a mortgage payment
(the same figure the guess adds) are taken off before the payment is turned into months, in `balance/liabilities` (`row.escrow`,
`months`, `payoffDate`, `totalInterest`), `core/math/payoff.js` (a debt's optional `escrow`: only the rest pays the loan and rolls on
when it is gone), `debt/payoff`, `debt/mortgage` and so the Timeline, Dashboard, Next best action and Your plan. It applies only while
the balance or the payment is our guess (a plan with both typed reads as typed: nothing moves), not after the escrow tap says "no",
and never takes more than half the payment; `debts[].escrowMonthly` (a number, optional, no version bump) overrides it. Two
guards (verify 2026-11-07): a payment our older Get started guessed (only the `paymentGuessed` flag, no ledger entry) is
`typicalPayment`, the level payment over 30 years with no tax or insurance in it, so nothing is taken off it (the fixture
`qa/fixtures/guessed-plan.mjs`, $185,000 at 7.24% paying $1,261, had $363 taken off and never paid off on Debts, Mortgage, Pay off
debts, Timeline and Your plan; it keeps its 360 months), and Your plan gives such a payment no "years left (bought ...)", which it
was never worked from; and when taking the tax and insurance off would leave no more than the month's interest (balance x rate /
12), the payment is read as the loan's alone, so a guess never turns a payment that pays the loan off into one that never does.
The cash pages keep the whole payment as money out. Not done here (other lanes, listed in the fix notes): retirement/projection's loan end,
debt/consolidation, cashflow/statement, balance/projection read `minPayment` for months themselves.

**Data** (`data/purchase.js`, built by `tools/extract-purchase-data.py`, read 2026-11-07; the Census move-in table and the FHFA state
index were already bundled in `home.js`):
| table | what it gives | source |
|---|---|---|
| `acs2025_year_moved_in_by_age_us` (home.js) | owners by age group (15-34, 35-64, 65+) and the span they moved in (2023 or later, 2020-22, 2010s, 2000s, 1990s, 1989 or earlier) | Census ACS 2025 1-year, B25128, https://www2.census.gov/programs-surveys/acs/summary_file/2025/table-based-SF/data/1YRData/acsdt1y2025-b25128.dat |
| `acs2025_owner_households_by_age_us` | owner households in nine age brackets, the weights for each group's mean age (28.6, 50.3, 74.6) | Census ACS 2025 1-year, B25007, .../acsdt1y2025-b25007.dat |
| `pmms30_annual_average_by_year` | the average 30-year fixed rate of each calendar year, 1971 to 2026 (2026 is the year so far, 44 weeks) | Freddie Mac PMMS, https://www.freddiemac.com/pmms/docs/historicalweeklydata.xlsx, the mean of each year's weekly figures (2021 2.96, 2022 5.34, 2023 6.81, 2024 6.72) |
| `nar2025_home_buyer_profile` | median down payment 10% (first-time buyers, median age 40) and 23% (repeat buyers, median age 62) | NAR 2025 Profile of Home Buyers and Sellers, news release 2025-11-04, https://www.nar.realtor/newsroom/first-time-home-buyer-share-falls-to-historic-low-of-21-median-age-rises-to-40 (a trade group's survey; flagged as industry) |
| `fhfa_hpi_at_state_annual` (home.js), `fhfa_hpi_national_annual` | home prices by year, the state's, else the nation's (the state table's U.S. column is empty) | FHFA all-transactions annual index, hpi_at_state.xlsx, https://www.fhfa.gov/hpi/download/annual/hpi_at_national.xlsx |
The Census API wanted a key (Missing Key), so the published summary files above were read instead; the figures match the API's labels
(B25128_004E owners 15-34 moved in 2023 or later: 3,357,513). NAR's table by buyer *age* is not free: the down payment is by buyer type
(first-time or repeat), and the median ages 40 and 62 of the two types place them on the buyer's age.

**`home.boughtYear`** (tier 1, order 1, unit year-date): the year an owner of this age most likely bought. For an age `a` the cap is
`a - 20` years (nobody is taken to have bought before 20). Within an age group the owners' move-in spans are a distribution over
years since the interviews (mid-2025: "2023 or later" is 2.5 years, "2020 to 2022" 5.5, "2010 to 2019" 15.5, "2000 to 2009" 25.5, "1990 to
1999" 35.5, the oldest span to 55.5; straight lines inside each span; review D9). The tenure of an owner of age `a` is the middle
of the group's distribution *cut at the cap*: `T = F^-1(0.5 F(a - 20))`, so a 25-year-old (cap 5) gets 2.24 years, not the group's 3.9.
The tenure is blended between the two neighbouring groups' by age between their owners' mean ages (28.6, 50.3, 74.6; weights from
B25007), so the guess has no steps (it is nondecreasing in age, tested for every age 20 to 90). No age: the middle of all owners,
12.7 years. The year is `floor(today - T)`, never before the 20th birthday's
year. Ages: 25 -> 2024, 30 -> 2023, 41 -> 2020, 45 -> 2019, 50 -> 2017, 55 -> 2015, 61 -> 2012, 66 -> 2009, 70 -> 2007, 85 -> 2002. A couple uses the older adult (profile.age). Words:
"Most owners your age bought in the last few years." (T under 5), "...in the last ten years or so", "...ten to twenty years ago",
"...have been in their home for twenty years or more". The state is not used (the state median year moved in, B25039, differs by
under two years from the nation's for most states).

**Where it is typed.** Get started's "Year you bought it" (beside the home's value on question 4; on question 5 it is said once, "You said
you bought it in 2025", with a way to change it), the Home page's "Year you bought it" and the mortgage page's one box all write the
home's purchase date: the Home page's entry for the home when it has one (any id; `homeEntryFor`), else `property[setup-home]`; July 1 of
the year, an exact date already in that year staying. Nothing is stored for a guess. A year ahead is no answer (the bound is the year of
the plan's today) and the box says so. A second home or a rental's loan reads **its own** home's entry (`homeOfLoan`: the entry that
names the loan, else the home account when the loan is Get started's or the only mortgage), never the main home's year, value or tax
(review D2); the mortgage page offers its year box only for a loan whose home is that clear.

**The loan's start** (`startOf`): the tap "When did you take out this mortgage, or last refinance it?" (the middle of its span), unless
it is earlier than the purchase typed (impossible: set aside); else the purchase date typed; else the middle of `home.boughtYear`.
Months left = 360 less the months since, never under 12. **A purchase so long ago that fewer than 60 months of a 30-year loan would be
left (typed 1995, say) is not the loan's start** (it was refinanced, or is another loan): the loan is counted like most owners this
age, from the middle of `home.boughtYear` (`startOf` returns that start with `stale` = the year typed), and the refinance question is
offered (the mortgage page asks it too, with four buttons that write the same tap Get started keeps; review D3). Verify 2026-11-07:
the first fix used no start, the usual balance and a full new 30 years, and once the tax and insurance came off the payment that read
as "paid off in 2056" for a 60-year-old who typed 1995; counted from the guessed year it reads about 18 years, as with no year typed.
Your plan says such a loan as "loan from about 2013, our guess", never "bought 2013", and Get started's gray line under "Still owed"
says "counted like most owners your age, from about 2013: a 1995 loan would be paid off by now" (it said "typical in 2013 with 14% paid
up front" under "You said you bought it in 1995").

**Rate.** *A year typed:* that year's average 30-year rate (Freddie Mac), as the owner asked. *A refinance tapped:* the mean of the
yearly averages over its years (before 2010: 2000-2009, 6.3%; 2010 to 2019: 4.1%; 2020 or 2021: 3.0%); "2022 or later" keeps the state's
new-loan rate (review D6; the 7.H tap keys at the state's 4.6% moved: $116,000 / $138,000 / $79,600 became $121,000 / $162,000 /
$73,300 for Jordan; the owner may want them back). *A year we guess:* the mean of the yearly averages over the **middle half of the
age's move-in years**, eased toward the average on mortgages people already have (FHFA, state or U.S.) the longer ago that is, because many
of those owners refinanced in 2012 or 2020-21: the weight on the purchase years is 1 up to 2 years in the home and falls 0.07 a year
after, to 0.3. A judgment, not a measured figure (it is said so); it keeps the guessed rate from jumping with age (a one-year rate swung
from 6.8% at 30 to 3.1% at 41 and 6.4% at 70; now 6.7%, 6.3%, 4.9%, 4.4%, 4.3%, 4.5%, 4.6%, 4.8%, 5.0% at 25, 30, 35, 41, 50, 55, 61, 66,
70; tested for no step over 0.8 points a year of age). With the payment *and* the balance both typed and no year typed: unchanged, so
nothing moves for those plans (tested against the build before this change).

**Balance (E21), neither payment nor balance typed.** `loanFrom`: the price (typed, else today's value, typed or ours, taken back with
the FHFA index of the state, else the nation's: `value x HPI(year) / HPI(this year)`, never above today's value) less the usual down
payment (10% to the buyer age 40 and 23% from 62, straight between; the buyer's age is the age then), at the rate of the start, paid
for the months since: `B = L((1+i)^360 - (1+i)^k) / ((1+i)^360 - 1)`, `i = rate / 12`, `k` = months gone (at most 348).
**Decision (combine, with the old prior).** Compared with the Survey of Consumer Finances' median mortgage among families who have one
(`scf2025_median_value_if_held`), at the SCF median home value of each age group and the loan of the year we would guess:
| age | year | home (SCF median) | purchase alone | SCF median mortgage | purchase / SCF | combined | combined / SCF |
|---|---|---|---|---|---|---|---|
| 25 | 2024 | $320,000 | $272,700 | $218,500 | 1.25 | $263,100 | 1.20 |
| 40 | 2020 | $376,000 | $197,700 | $215,000 | 0.92 | $202,200 | 0.94 |
| 50 | 2016 | $400,000 | $157,700 | $203,000 | 0.78 | $173,200 | 0.85 |
| 60 | 2012 | $400,000 | $106,900 | $165,000 | 0.65 | $130,800 | 0.79 |
| 70 | 2006 | $382,300 | $103,600 | $130,000 | 0.80 | $117,300 | 0.90 |
| 80 | 2002 | $350,000 | $44,300 | $100,000 | 0.44 | $69,100 | 0.69 |
The purchase says what a typical loan *begun in the guessed year* leaves; the survey says what mortgage holders of the age owe, which
includes refinances and cash-outs the purchase cannot see (older holders owe more than their purchase left) and, for the young, cheaper
homes than the median. Neither replaces the other, so they are combined in logs by precision (R4): the purchase's declared spread is
`0.25 + 0.03 per year since the purchase`, at most 0.8 (a refinance can reset any older loan), the prior's is the survey's own (0.73
for all families): at 25 the purchase carries about 83% of the weight, at 41 about 73%, at 61 about 53%. The result is never more than
the home's value. It is a declared, not a measured, spread. The old prior stays the whole answer when there is nothing to work
from (no date, no value).
**With the payment typed**, the balance is worked back from its P&I over the months left since the start: `pv(i, months left, P&I)`
(spread 0.25 for a guessed year, 0.15 for a typed year or a tap), **never above the home's value, typed or our guess** (a $4,000 payment
on a home guessed at $280,000 owed $550,000 before: review D4). The old "at most the typical balance" bound goes: a payment is read as
the loan's, whatever year it began. **With the balance typed** the payment is
`pmt(i, months left, balance)` plus the usual tax and insurance, over the months left since the start (not 360).
**The payment (E22)** is `pmt(i, months left, balance)` plus the usual tax and insurance as before, for a balance typed or ours, so
the payment pays the balance off in exactly the months left at the rate (tested for every age 20 to 85, to the dollars the payment
is rounded by). **It is rounded to $10 inside the estimator** (as the card minimum is), not R11's $50 above $1,000: the pages turn the
payment, less its tax and insurance, into the years left, and near 330 months a $25 step in a $1,200 principal and interest moves the
end by about 18 months. With $50 steps 8 of 56 households aged 25 (seven states, four pays, single and couple) read 26.5 to 26.9 years
on a loan with 27.7 left, one 30.1, and a couple with no pay typed 26.2 in the browser; with $10 steps all 56 read 27.4 to 28.3
(verify 2026-11-07; answer keys that moved by $10 to $20 say so).
Tested: `tests/home-purchase.test.mjs` (the data, the tenure, the loan, the persona grid with the **pages** -- Debts, the mortgage
page, Pay off debts and the Timeline say the loan's own months left, to the payment's rounding -- and one test for each of the review's
findings D1 to D9), and the answer keys in `module.test.mjs`
and `overview/setup/module.test.mjs` that moved (Jordan's and Pat and Lee's mortgage, 2026-11-07) say so in their titles.

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
  takes the likelier side; the spec has the box wait for the answer, but a box with no gray figure would save nothing,
  so the likelier side is shown while it asks), plus property tax and insurance (`home.propertyTax`, `home.insurance`,
  or the Home page's typed ones) when there is no mortgage or the escrow tap says they are not in the payment. A bill
  typed under another kind whose name says it is one of those two parts (`PROPERTY_TAX_BILL`: property, real estate, home
  or house tax; `HOME_INSURANCE_BILL`: home, house, homeowners, dwelling or condo ... insurance) comes off that part, never
  past it (C7: the qa retirees typed "Property tax" under taxes and "Home and car insurance" under insurance, and the row
  counted both again, $297 of its $431); a housing bill comes off the whole row as above. J $50,
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
- **The basis line (`spendBasis`)**: "The gray figures are what a household like yours usually spends: one adult
  renting in Texas on about $48,000 a year." (`householdWords` is the part after the colon.) With R12 on: "The gray
  figures are what your bank files show going out on each, a month over September and October." (the months read, M8)
- **R12, the person's own bank files (`bankSpend`, C7; spec 2.2 R12, 7.A).** A month (before this one) is read when
  all of these hold, looked at newest first: it is at most `BANK.maxAge` = 12 months old (else held "old"); it is whole
  (ledger `monthCover` full and `monthGaps(...).whole`: the files reach both ends within the ledger's slack, no
  account's files have a hole in it, stop early or start late; the same test Expenses' bank card uses); a checking,
  savings or cash account's own files cover it (a card's file alone shows what the card bought, never the rent and
  bills: held "no-checking", M1a); no money went to a card whose own file is not in (ledger `monthGaps` cards and
  "unsure", and a line paying a card in the plan by name, `CARD_LINE` + `PAY_LINE` words, with no line of that card's
  own: held "card", M1b) nor to a card the plan does not have (a card-payment line filed as a payment, a transfer that
  `cardPayments` does not tie to a card in the plan, or with no kind: held "unknown-card", M1b); and what is left with
  no kind is at most `max(BANK.looseDollars, BANK.uncategorised x the month's money out)` = max($50, a tenth) (else held
  "unfiled", UX review 1; it was half). Before that, a line with no kind is taken out when it says it is a transfer
  (`TRANSFER_LINE`: transfer, xfer) or a card's payment, when it is a bill typed on Expenses (within 10% of its amount,
  as often as its period has in a month: a rent paid by check is that bill, counted once on Expenses, M3), or a payment
  on Debts (a loan's words, `LOAN_LINE`, or within 10% of a loan's payment or the mortgage's). The newest
  `BANK.maxMonths` = 6 such months are read, and R12 is on with `BANK.minMonths` = 2 or more. The ledger's month checks
  read every line (about 7 ms a month on six months of 150 lines) and the store settles on every change, so the answer
  is kept for the same inputs (every line, file record, account, kind, bill typed, debt, the day and the rows; the last
  eight). A line counts when it is money out of a spending kind (with no kind, by its sign), not a transfer
  (`transferId`, the transfer kind), a loan or card payment (`debt`), `taxes` or `savings`; a refund in a spending kind
  takes off. Kinds map to rows as Expenses holds them (`ROW_HOLDS`: phone in utilities, health in insurance, fun,
  subscriptions and pets in eating out, personal care in shopping; the spec says setup's `covers`, which leave
  subscriptions, pets and personal care in no row, and Expenses' bank card groups them this way); the lines with no kind
  left and every kind in no row (travel, gifts, other, one of your own) go to "Shopping and everything else", as does
  childcare with no child listed. **The mortgage** (M2, Expenses' `mortgageLines`): a housing line named mortgage or
  mtg, or within 10% of the payment on Debts, or the largest payee's line found in every month read that is within 10%
  of the same amount each month and at least half the payment (a servicer's name: "MR COOPER", "PENNYMAC LOAN SVC"), is
  the servicer's; the payment on Debts is counted there, and what goes to the servicer beyond it each month (its tax and
  insurance, or a payment typed low) is a home cost, so the plan's month is the bank's. Each row is then
  `max(0, its lines / months - the bills typed on Expenses that the bank puts in it, less the months a line with no kind
  was that bill)` (never counted twice), no envelope, no tap, `sigma` 0.15 (declared), `basis: "yours"`, why "your bank
  files, September and October" (ledger `monthsWords`; "your bank files, six months to May" when that does not fit), no
  table and `dataAsOf` = the spending tables' read date (so moving between the bank and the survey is never held back by
  the S7 guard). **A row the files show nothing for keeps our figure** (M1c: "not in these files" is not $0; lumpy home
  upkeep is a mean over years). **Insurance and health** (UX review 11) adds the cover the bank never sees: with health
  cover through work the worker's share (KFF EHBS 2026, the row's own `premium`: $139 single, $623 family), with
  Medicare each adult 65 or over's Part B premium (it comes out of Social Security); why "..., and cover taken from pay",
  or "...; not cover taken from pay" when nothing is added. One month, or none, leaves the survey's rows, and
  `bankHeldWords(plan, b)` says why in one line with a link (Expenses under its tiles and this page's spending row,
  through compute.js `spendBankNote`, only while a row is still ours): "no-checking" "Your card's files cover ..., but
  not your checking account, where rent and bills are paid. Bring in its file too, ..." (Bring in a bank file ›);
  "card" "Your bank files cover September and October, but about $300 a month went to your Visa, and its file isn't
  in. Bring it in, ..." (Bring in the Visa file ›, `#/transactions/import?accountId=<card>`); "unknown-card" "... about
  $3,200 a month went to a card that isn't in your plan (CHASE CREDIT CRD AUTOPAY). Add the card and bring in its file,
  ..." (Add the card ›, Net worth), or with cards in the plan that the line does not name (a "CAPITAL ONE AUTOPAY" beside
  a card saved as "Visa") "... about $300 a month went to a card (CAPITAL ONE AUTOPAY), and what it bought is in no file.
  If that is your Visa, bring in its file; if it is another card, add it first. ..." (Bring in the Visa file ›; with
  several cards, Bring in the card files ›); "unfiled" "12 bank lines still need a kind. File them, ..." (Categorize ›, the
  plan's lines with no kind); "old" "Your bank files are from January and February 2024, more than a year ago, ..."
  (Bring in a bank file ›); each ends "and our spending guesses become what your bank shows." Rows of ours move at the
  next save (settle; a row whose bank figure equals the survey's still says it is the bank's, M9: settle refreshes the
  entry's spread when the figure is the same); a row the person typed stays theirs. Pat and Lee with two months of
  checking (module.test.mjs): home 90, utilities 330, groceries (800 + 1,000) / 2 = 900, car 120, insurance 220, eating
  out 80, shopping (300 + 270) / 2 = 285 -> $290; the $1,600 mortgage line apart; Expenses' bank card then shows a gap
  of about $5 (rounding) and no line.
- **Bills typed under another kind (`elsewhere`, C7 M7).** A homeowners insurance bill typed under Insurance comes off
  the home costs row's insurance part first (`HOME_INSURANCE_BILL`; at most our figure for that part) and only the rest
  off Insurance and health, so it is taken off once ($150 a month off the two rows, not $250); a bill named for a car's
  insurance (`CAR_INSURANCE_BILL`: car, auto, vehicle, truck or motorcycle ... insurance) typed under Insurance comes off
  Car, gas and transit's guess, not Insurance and health's (the survey keeps vehicle insurance in transport); "Home and
  car insurance" gives the home part first (`homeInsTaken`), the rest to the car (`carShift`).
- **E10, "Is something missing?" (`missingSpend`, spec 11.6, C7)** when all three hold: the spending is typed (no row of
  it our guess, and not one rough total, which no row can be added beside); the typed month (bills and loan payments)
  is under `MISSING_LINE` = exp(-2.33 x 0.25) = 0.5585 of the household's guessed total (every row ours with every box
  blank, plus the bills typed elsewhere and the loan payments: a bill in a row's kinds comes off that row, so the total
  stays put while the list grows); and no bank files cover two whole months (Expenses' bank card speaks then).
  "That's everything" (`guide.spendComplete`) ends it. `rest`: Get started's rows with no bill of their main kind (the
  first of setup's `covers`, UX review 9: "Phones $95" under phone leaves "Utilities and phone" to offer, less the $95)
  and not typed as 0. Pat and Lee with $2,100 of bills and the $1,600 mortgage: asked; a dollar under the line asked,
  at it and a dollar past it not (module.test.mjs). compute.js `spendMissing` adds our guesses for `rest`, worked out
  together (one envelope: the settle after "Add our guesses for the rest" moves nothing), each row's `listed` (the bills
  under its other kinds, which its guess is already less) and `withThese` = typed + rest; `addSpendGuesses` writes them
  as Get started does; `spendIsComplete` stores the day; `spendAskAgain` deletes it ("Ask me again" on Expenses, shown
  while `spendSaidComplete`: said, and the list is still under the line). The card: "Households like yours usually spend
  about $5,700 a month. You've listed $2,565." (the list to the dollar, as Expenses' tile), "Not listed yet, about
  $2,460 a month", each row ("Utilities and phone, besides the $95 you listed  $310"), "With these, your list comes to
  about $5,000"; "Add our guesses for the rest" (filled, with Undo) and "That's everything" (outlined).

## Retirement saving and balances (estimators/saving.js; spec 7.B, E12-E17, E40; C4, 2026-11-06)

Get started's question 4b ("About how much is in each?") shows a gray figure in every box and writes it, marked, when the box
is left blank. A picked retirement tile always makes the account. All tables are bundled (data/balances.js, data/pay.js, read
2026-11-02); the IRS limits are read from `modules/retirement/contributions/data/limits.js`.

| key | formula | persona answer (R11 rounding) |
|---|---|---|
| `account.retire.balance` (E12) | Vanguard's median 401(k) balance, everyone $44,115 x [median at this pay / $44,115] x [age group median / $44,115] / [median at the age group's typical pay / $44,115]. The pay line is log-linear between the seven pay groups' typical pays (`VG_PAY_CENTRES`); the age group's typical pay is the Census full-time median at that age. No pay: the age group's median; no age: the pay ratio alone; neither: $44,115. Spread: sqrt(2 ln(average / median)) of the age group. | Sam (24, $48,000) $3,100 (middle half $1,100 to $8,600); Jordan (41, $58,000) $26,000; Lee (59, $40,000) $29,000 |
| `account.retire.split` (E12s) | the joint figure typed x this adult's share of pay (equal parts when someone has no pay). Applies while the tap `retire-joint` is on file and the typed person's own balance is still this guess. | $500,000 x 85/125 = Pat $340,000; x 40/125 = Lee $160,000 |
| `account.ira.balance` (E15) | SCF retirement accounts, median among holders, R2 by household income and age, the age residual held between x0.5 and x2, split by pay for a couple | Sam $13,000 (middle half $5,600 to $32,000) |
| `account.invest.balance` (E16) | the same with the SCF's pooled investment funds | |
| `account.cash` (E17) | SCF transaction accounts by R2. Checking and savings both picked and both blank: half each of the rounded total. One typed: the other gets the total less it, if $100 or more, else nothing. | Jordan $2,700 -> $1,350 each |
| `account.car.value` (E40) | SCF vehicles by R2 over the vehicles per household at that age (CE profile) | Sam $12,000 |
| `contrib.amount` (E13) | participation first: log-odds of Vanguard's 83% plus the pay group's distance from it plus the age group's distance with the age group's typical pay taken out. Under 50%: nothing yet, said so. Else the share of pay: Vanguard's average deferral 7.6% x pay ratio x age ratio (same R2) x median / average (6.6 / 7.6), to 0.1 point, x pay / 12, to $10 (R11), never past the IRS limit. Spread ln(q75 / q25) / 1.349 of the published split of participants (0.64; not "measured", so no range is printed). | Sam 5.0% = $200; Jordan 5.5% = $270; Pat 8.4% = $600; Lee 6.3% = $210 |
| `contrib.match` (E14) | the usual match, 4% of pay (median value of a promised match) x min(1, share put in / 6%) (median share needed for all of it) x pay / 12, to $10 a month, stored x12 a year. Nothing put in: nothing. "No match at this job": no guess. | Sam $130 a month; Jordan $180; Pat $280; Lee $130 |

Notes where this differs from the spec:
- **Rounding (R11).** The spec's "5.5% -> $270" rounds the share first (0.1 point) and then the dollars; the estimator does that. The
  match is rounded as a month ($10) and stored x12, so the screen's monthly box shows the spec's $130 / $180 / $280 (a yearly $50
  rounding would show $133). Because the spread of what people put in is worked from a bucketed table it is not marked
  measured, which keeps the dollars at $10 (R11's 2-figure rule for measured spreads would have made Jordan $260).
- **Participation.** Sam's p is 0.599 here (the spec quotes 0.54); both are over one half, so the result is the same.
- **Pay-group centres** (`VG_PAY_CENTRES`: $10,000, $21,200, $38,700, $61,200, $86,600, $122,500, $200,000) are the middle of each
  Vanguard pay band on the log scale, the square root of its two edges rounded to $100 (sqrt(15,000 x 30,000) = 21,213; sqrt(30,000 x
  50,000) = 38,730; sqrt(50,000 x 75,000) = 61,237; sqrt(75,000 x 100,000) = 86,603; sqrt(100,000 x 150,000) = 122,474). The two open
  ends are declared ($10,000, $200,000). They are not a measured median; plain (arithmetic) middles would move Jordan's balance 4%.
- **Spread of what people put in** (`deferralSigma`) is read from the table `vanguard_has2026_deferral_distribution` (Figure 30, five
  bins; the open bin is closed at 25%), so a data refresh moves it, and the guess lists the table as a source.
- **Limits (IRS, read 2026-11-06, IR-2025-111 and Notice 2025-67).** 401(k) $24,500; catch-up from 50 $8,000; 60 to 63 $11,250
  (replaces the $8,000); IRA $7,500, catch-up $1,100. They only cap a guess of what people put in.

Taps: the couple tap (E12's `ask`, key `retire-joint`) shows when exactly one of two adults' retirement boxes is typed and the
other is blank; "Not sure" counts the figure as one person's.

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
- **R10** the household envelope (C3, "Spending" above). **R12** the bank files (C7, "Spending" above). R7 (couples
  split by pay) and R8 (totals are sums) are the saving commit's (C4).

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
column). C7: the bank files' spread 0.15 (`BANK.sigma`), the months read from the bank (`BANK`: two to six whole months at
most 12 months old, at most $50 or a tenth of a month's money out with no kind), "Not now" waits 30 days (`FILL_AGAIN_DAYS`). Direction of bias (C3): the survey's lower-income and one-parent cells spend more than their after-tax income,
so spending guesses lean high for households under about $60,000 after tax; the envelope and the waiting verdict
contain it.

### The tables (69, from 18 publishers)
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
| `fhfa_hpi_national_annual` | purchase.js | Federal Housing Finance Agency | Last updated March 31, 2026 | - | 2026-11-07 | index |
| `acs2025_owner_households_by_age_us` | purchase.js | U.S. Census Bureau, American Community Survey | 2025 figures, published October 2026 | - | 2026-11-07 | count |
| `pmms30_annual_average_by_year` | purchase.js | Freddie Mac | weekly figures to the latest week (2026 is the year so far) | - | 2026-11-07 | average |
| `nar2025_home_buyer_profile` | purchase.js | National Association of Realtors | July 2024 to June 2025 sales, released November 2025 | - | 2026-11-07 | median |
| `ahs2023_routine_maintenance_spending` | home.js | U.S. Census Bureau and HUD, American Housing Survey (research-derived) | 2023 survey, the newest | 2023 | 2026-11-02 | median, mean and ratio |
| `kff_ehbs2026_premiums` | health.js | KFF, Employer Health Benefits Survey (industry) | 2026 figures, published October 2026 | 2026 | 2026-11-02 | mean |
| `kff_aca_benchmark_premium_40yo` | health.js | KFF State Health Facts (industry) | Plan years 2026 and 2027 | per row | 2026-11-02 | average |
| `cms_aca_age_rating_curve` | health.js | Centers for Medicare & Medicaid Services | In use since 2018, the newest published | - | 2026-11-02 | ratio |
| `cms_medicare_2026_parts_ab` | health.js | Centers for Medicare & Medicaid Services | 2026 figures, published November 2025 | 2026 | 2026-11-02 | as set |
| `cms_medicare_part_d_parameters` | health.js | Centers for Medicare & Medicaid Services | 2026 and 2027 figures | per col | 2026-11-02 | as set |
| `kff_medigap_average_premium_2025` | health.js | KFF, from NAIC Medigap data (industry) | 2025 premiums, published October 2026 | 2025 | 2026-11-02 | mean |
| `ssa_snapshot_2026_09_average_benefit` | retire.js | Social Security Administration | September 2026, published October 2026 | 2026 | 2026-11-02 | mean |
| `ssa_retired_worker_benefit_by_age_sex_2025` | retire.js | Social Security Administration | December 2025, published 2026 | 2025 | 2026-11-02 | mean |
| `scf2025_cross_median_if_held` | cells.js | Board of Governors of the Federal Reserve System, Survey of Consumer Finances | 2025 survey, published October 2026 | 2025 | 2026-11-07 | median (worked out from the microdata by age x income group) |
| `scf2025_home_value_to_income` | cells.js | Board of Governors of the Federal Reserve System, Survey of Consumer Finances | 2025 survey, published October 2026 | ratio | 2026-11-07 | percentiles (worked out from the microdata by age group) |

`STATE_REGION` (data/index.js): the U.S. Census Bureau's four regions, the ones the CE survey reports by.

## The import rule (spec 6.2; a test reads the import graph)
compute.js and estimators/*.js import `core/*`, their own `data/`, and, read-only, other modules' data files and these
computes: `core/math/tax.js`, `modules/taxes/state/compute.js` (claude-a's file, imported and never edited),
`modules/cashflow/expenses/compute.js` and, for R12 (C7), `modules/transactions/ledger/compute.js` (whole months) and
`modules/transactions/categories/compute.js` (each kind's in, out or transfer); the spec's 6.2 names three, the test
names the five. No file reachable from this compute imports this compute, and it imports no
`overview/*` compute. overview/setup may import this compute (nothing here reaches setup).

## Coverage (coverage.js)
Every input the 2026-11-02 inventory marked "a layperson does not know this" (191 rows after de-duplication, the
"roughly / no" 401(k) balance on Get started and the "no (until quoted)" refinance rate included; the spec counted 188), with how a blank is handled: `guess:<key>`, `compute:`, `fallback:`, `example`, `ask`, `other-builder`
(claude-a's pages) or `later:C<n>`. `npm run check` validates it and prints "guess coverage: N of 191 unknown inputs
handled (M later)"; a `later:` row whose commit is built fails. C1: 48 handled, 143 later. C2: the six Get started
rate boxes are `guess:debt.<kind>.rate` (54 handled, 137 later). C3: Get started's insurance and shopping rows
(`guess:spend.insurance`, `guess:spend.shopping`) and its retirement spending question
(`guess:overview/setup:retireSpend`): 57 handled, 134 later.

## Believable for the household: the sanity check (qa/guess-sanity.mjs; 2026-11-07)
A guess has to be one a layperson believes for their own household: age, couple or single, children, owner or renter, pay,
state and what they typed (the owner's example: a couple of 25 must not be told their mortgage has 12 years left). The rules
live in `qa/guess-sanity-rules.json` (what is checked, the line, why, the published source and its date); the one command
`node qa/guess-sanity.mjs` builds a grid of households through Get started's own apply functions, adds the qa plans, and
writes `qa/results/sweep.md` with each failing rule under its owner; `tests/guess-sanity.test.mjs` runs the hard rules in
`npm test` and `tests/guess-sanity-fixes.test.mjs` holds one test per fix. A new estimator or default adds its rule in the
same change. What it changed in the estimators:
- **Survey cells by age and income** (`data/cells.js`, `crossMedian`, `homeRatios` in estimators/common.js). The survey's
  published tables give a median by income group or by age group, never both, and multiplying the two overshot at young ages
  and at both income extremes (a 20-year-old on $40,000 was given $32,000 of investments; holders under 35 in the bottom 60%
  by income have a median of $2,900). `account.invest.balance` and `account.ira.balance` now read the SCF 2025 cell for the
  oldest adult's age and the household's income, on straight lines of the log between the age groups' middles (28, 40, 50,
  60, 70, 80) so a birthday never steps it. `home.value` is held to the age group's 5th to 95th percentile of value over
  income (not when the income is under $1,000 a year, the lowest point of the survey's income scale: a ratio to almost nothing
  bounds nothing, and a $1 pay had held a couple's home to $13), and above a mortgage balance the person typed divided by the
  group's 75th-percentile loan-to-value.
- **Home insurance follows the home** (`insuranceYear`): the state's average HO-3 premium in 2025 prices, scaled by this
  home's value against the state's typical owner-occupied home (ACS 2025), at least $350 a year. It moves the mortgage payment
  guess's insurance part with it.
- **Spending rows** (spend.js `buildModel`): health insurance and medicine follow the oldest adult's age (CE 2025 by age) and the
  household's size; a household with a child under 18 never gets a row (but groceries) smaller than the same adults without
  one, because the survey's household types stand in for age; the rows are sized on take-home before typed pre-tax saving
  (`takeHome(..., { sizing: true })`), so saving more never raises the guessed dining and the retirement figure after it.
- **Get started** (overview/setup/compute.js): the Education goal is dated August 15 of the year the first child under 18 turns
  18 (`educationDate`); the cushion is the Emergency fund page's own advice, 3 months with two incomes, 6 with one, 3 more for
  pay that goes up and down (`defaultCushionMonths`; a figure typed on Assumptions or set on Emergency fund is kept, 6 included:
  `guide.setup.cushionWrote`); a retired person of 62 or more whose Social Security is left at "Estimate it for me" (the
  "Already retired" tick on the ages question) gets the average retired worker's benefit at their age (SSA, Annual Statistical
  Supplement 2026, Table 5.B9, Dec 2025; `averageRetiredBenefit`), divided by the early claim factor before full age, in place
  of $0, and Our guesses for you names that table. Still to do: someone who said retired on question 2 is asked "I already get
  it", and a blank amount there is still $0 (`pt.ss.not-zero-when-retired`).
- **No birthday steps** (`smoothAge` in estimators/common.js, `smoothVg` and `smoothPay` in estimators/saving.js): every figure the
  survey, Vanguard or the Census publishes by age group (cash, vehicles, home value, the 401(k) balance, the share of pay put in,
  the share who put in at all, the pay "people your age" have) is read on straight lines of the log between the groups' middles,
  so turning 35 moved a 401(k) guess from $6,900 to $13,000 and cash from $1,800 to $1,300 and now moves neither by more than a
  few percent. Check: `sr.saving.no-cliff`, `sr.saving.monotone`.
- **Two corrections in the spending rows**: a household with a child under 18 never gets a row (rent included) smaller than the
  same adults without one, because the survey's household types stand in for age; an adult of 65 or more with an income above the
  Medicare Savings Program's Qualifying Individual limit ($1,816 a month single, $2,455 a couple, 2026; CMS, read 2026-11-07) is
  never guessed under Part B plus the Part D base premium ($202.90 + $38.99 a month, 2026), rounded up to $10.
- A home value held to its age group's range is taken to two figures on the inside of the bound (so rounding for display cannot
  step over it).
- The two `cells.js` tables are hand-kept, not built by tools/build-guess-data.mjs: `data/index.js` carries their read date,
  and a rebuild of the generated files must keep that line.

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
fallbacks), health insurance asked once; E05 by tap (work, Medicare, Medicaid); a bill typed later on Expenses comes off
its row (and comes back when removed); the 7.F ratios and N's figure from 50; the $15,000 rent slip; the rows agree with
setup's; the basis line and E10.
C7 (each failed before the change): the three 7.H households made before the guesses are offered Get started's own
figures and one tap makes its plan (settle after it moves nothing); what is not offered (kept elsewhere, another loan is
not a car loan, paid in full, Get started on the debts' screen, "none", EUR, outside the U.S., a bill, a bank line, no
pay, pay ended, a row typed 0, childcare); "Not now" writes only its answer and the card is back at 30 days, not 29;
after "Use" a removed debt stays removed; a plan built on the pages gets no retirement figure; the Dashboard's key only
with a day and its order; R12 with two months (the rows, the why, the basis line, the bank card's gap, a typed row kept,
a typed bill taken off), one month, a mostly unfiled month, a hole, the month running, a transfer pair, the kinds' rows;
E10 at and around its line and each of its three conditions; "Add our guesses for the rest"; the constants agree with
setup's; an owner's property tax and home insurance typed under other kinds come off the home costs row's two
parts, each part alone, never past it, and a car insurance or income tax bill does not; the fill card drawn with the
stand-in kit (both buttons, their notices). The bank card's mortgage line:
cashflow/income-statement/module.test.mjs. C7 fixes after the money review ("C7 fix M1a" ... "M9", each failed on the C7
build first): a card's file alone, money to a card in no file or not in the plan, a row the files show nothing for, a
servicer's line under another name beside a different payment on Debts, a rent paid by check and the tenth unfiled, a
loan on Debts under any name, a house or car payment typed on Expenses, a debt removed on Net worth and a typed rate
kept, a homeowners bill typed under Insurance, files over a year old and the months' words, a bank figure equal to the
survey's. After the UX review ("C7 fix UX 1" ... "UX 11", drawn with the stand-in kit; the Dashboard with every module's
manifest and compute): a month half unfiled and its line on Expenses and here; the Dashboard's card under where you
stand and its waiting rows (Left over, Safety cushion, Retirement) leading to it, and Expenses' waiting tile; each held
reason's words and link; the names after the tap; the card's chips (nothing written until the tap, the answers kept in
`guide.setup.taps`); the line of what else changes and the notice; Undo on every writing tap, "Ask me again"; Expenses'
own card ("Not sure what you spend?", "I'll type mine"); the missing card's main-kind rows, "besides the $95 you
listed", the list to the dollar and its total; the Dashboard's "Better guesses are ready" with its why-lines, small
changes and link; the bank rows' fold and the cover taken from pay.
`qa/fixtures/guessed-plan.mjs` is a household made through Get started with the unknown boxes left empty (the older
guesses in place): the tests and the screenshots use it.

## Next (spec 15)
C2 (built) debts are never dropped; C3 (built) spending; C4 retirement
saving (and its `FILL_CASES` entry); C5 the questions and the reveal (pay, goal targets; and its `FILL_CASES` entry); C6
the form kit and the pages outside setup (`restsOn`); C7 (built for debts and spending) existing plans and bank files; C8 verdict ranges and the measured ranking; C9 calculator previews and coverage;
C10 plain words.

Review fixes (C4 review, 2026-11-06). Sources: IRS IR-2025-111 (401(k) $24,500, catch-up $8,000, 60 to 63 $11,250, IRA $7,500 + $1,100;
read 2026-11-06) and IRS Notice 2025-67 (compensation limit under 401(a)(17) $360,000 for 2026, $350,000 for 2025; read 2026-11-06).
- **Match on high pay.** The pay the usual match is worked on is `min(pay, compensation limit)` (`compLimit(year)`, read from Work
  benefits' yearly table), and what is put in is capped at the 401(k) limit for the age reached in the year (`ageInYear`: year minus
  birth year; 50 from the year one turns 50, the larger amount for 60 to 63). Usual: `4% x min(1, put in / comp / 6%) x comp`.
- **Typed match formula.** When Work benefits holds match tiers for the person, the guess is that formula on the same pay
  (`sum of rate x slice of pay up to each upTo`, as Work benefits' matchAt), $10 a month rounding; tiers with no money in them are "no
  match" and nothing is guessed (a match guessed before them goes to $0). Next best action's "put in X%" step uses the formula's own full-match share, and skips anyone whose match
  is typed ("I know it").
- **A guess follows its inputs.** With no pay now (no job, or the pay line ended) a guessed contribution and match go to $0; a row that
  is not monthly is never given monthly dollars, and saving the edit form with another period ends the guess. A contribution typed in
  any period still sets the match (its yearly total over 12).
- **Joint split** adds up to the typed figure: the others get their share to two figures, the person who typed gets the rest.
- **Cash** counts a typed $0 as typed and takes bank accounts already on file (Net worth's) out of the survey's transaction accounts.
- **The usual match is said once as "about 4% of pay when you put in 6%"** (Vanguard 2026 Figure 7: median promised match value 4.0%,
  median share needed 6.0%). Work benefits' assumed formula (50% of the first 6%, 3% of pay: the single most common one) is a different
  statistic and is left to that page; the step names which one it means.
- **Retirement verdict** waits (`standing().retireGuessed`, `retireGuessedWhat: "balance"`) when half or more of the money in retirement
  accounts is a guess.

Final check (C4 verify, 2026-11-06; IRS figures read again that day: IR-2025-111 and Notice 2025-67 pp. 1-2, "individuals who attain
age 60, 61, 62, or 63 in 2026", compensation limit $360,000):
- **"No" after "Yes".** When the person says the job has no retirement plan (`retirement.workPlans[id].plan === false`), a guessed
  contribution is $0 and so is a guessed match; a typed one is left alone. When "no match" is said after our match was saved
  (Contributions' `workPlans[id].match === false`, or match tiers with no money in them on Work benefits), a guessed match is $0, not
  frozen at the old figure. Question 4b's own answer (Not sure, I know it) replaces an earlier "no match", so the figure its screen
  showed is the one settle keeps.
- **A removed person's account** kept as the household's: its guessed balance stays as it was (no pay or age is left to guess from).
- **Question 4b reopens** a guessed balance in the plan at work (Q2's account) gray, like every other guess (spec P2), and question 4
  says "Next we'll ask what is in it" while Retirement is ticked (C4 ticks it for a plan at work), not "Tap Retirement".

## Follow-up, 2026-11-07 (workflow wfu1; tests `tests/followups-*.test.mjs`)
- **F7.** Labels: "Sam's retirement savings at work", "Lee's share of your $500,000 retirement savings" (the total from `guide.setup.taps["retire-joint"]`), "Sam's retirement savings on your own"; no longer "<account name>: <estimator label>".
- **F8.** `contrib.amount` and `contrib.match` (and `usualShare`) work from `jobPayOf`: the pay line Get started made for the person (`setup-pay-<id>` and the raises that continue it), so a second job added later does not raise the first job's 401(k) guess. A person with no such line (pay typed on Income): all their pay, as before.
- **F9.** `payOf`: a lone adult's unassigned pay lines (`personId` empty) count as theirs only while none of their pay is assigned to them. A partner removed with their pay kept as the household's no longer moves the remaining adult's guesses (it counted as theirs: $130,000 became $260,000).

## Wording follow-up (2026-11-07, claude-b lane B)
- The "like you" lines for balances, a home, a car, the bank balance and spending say "on your income" (not "on your pay"): a retired household has income, not pay. The work-plan saving lines keep "on your pay" (they need a job). "on our pay guess" is unchanged (pay we guessed).
- Review round 2: the debt guesses say "your age and income" for the pay-based words (the like-you lines for a retiree).
