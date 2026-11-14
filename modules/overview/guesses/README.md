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
"70 tables from 18 publishers" (`org` counted). A plan that takes no U.S. figures (the gate) gets no list there:
"We fill in typical figures only for households in the U.S. that count in dollars, so none of these tables is used for
your plan." Rates are shown and saved to a thousandth of a percent (6.125%), as Get started keeps them. Saving a debt's
rate while its older payment still stands adds "Your payment of $1,261 a month was worked out at the old rate, so type
your real one too." Records, never a table (390 px). Saving: Save (or Enter) commits through `saveField` as a typed figure;
"That's about right" through `confirmGuess`. A save is not made on blur: the re-render after a blur-save would move the
button under the finger before a tap on "That's about right" lands. A row settled by a tap (and the "Better guesses" card
once it empties) keeps its old height while the person is still going down the list: it lets go only after the page has
been still for 2 s, and any tap, scroll, key or wheel restarts the wait (`STILL_MS`, review 2026-11-11 N8 and N16: a 0.7 s
timer let go under a moving thumb, the next row jumped 124 px and the tap opened "Matters less"). Nothing moves under the
thumb: after a tap the page scrolls so the row's ✓ line sits where the row was (the "Kept" notice added above it is
scrolled past), and when the height is let go the page scrolls so the first control at or below the last tap stays where
it was, with a blank foot until the next draw so the scroll is never cut short. The held height leaves out the red "far
from our guess" line. Empty state: an empty plan points to Get started; a
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
  local). S: 1,515 x 0.897 x 0.867 x 1.038 = $1,223 -> $1,200. Held under `rentCap(gross)` (follow-up lane 2,
  2026-11-07): what 95 in 100 renters in the household's income fifth pay against income (SCF 2025,
  `scf2025_rent_to_income_by_income_fifth`), never above what a higher fifth allows at its lowest income, so the ceiling
  never falls as pay rises; taken down to $50 ($10 under $1,000) so rounding never steps over it. See "Most likely, not
  the edge" below.
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

## Pay before tax (estimators/pay.js; spec 7.E, E33; C5, 2026-11-13)
`pay.gross`, tier 1, a year (`income[setup-pay-<id>].amount`, period "annual"), weight big. Get started's pay box left blank
after "I work" (an employer or their own business) shows it in gray and, saved blank, writes it and marks it
(`PAY_GUESS_STORED = true`, the owner's default, spec 17.1; set it to `false` and the figure is only an example under the
box, never written). Formula (R2, anchor x ratio):

    pay = ACS full-time median(state) x CPS full-time median(age) / CPS full-time median(all ages)

- **Anchor:** U.S. Census Bureau, American Community Survey 2025 1-year, table B20018 (median earnings of people who worked
  full time, year round), by state; "US" with no state (`acs_median_earnings_by_state`, read 2026-11-02, bundled data).
- **Age ratio:** U.S. Census Bureau, Current Population Survey ASEC 2026, PINC-01 (people working full time all year), the
  median by age band over the all-ages (15 and over) median (`cps_ftyr_income_by_age5`, read 2026-11-02). The age is the
  exact age in years (days / 365.2425) and the bands are read on straight lines of the log between their middles (R3), so a
  birthday never steps it: a day either side of 25 moves it under 0.1%. The middles are each band's middle, except 15-24 at
  22 (almost nobody under 20 works full time all year, so the band's full-time workers are mostly 20 to 24; saving.js
  places Vanguard's "under 25" at 22 the same way) and 75+ at 77. No birth year yet: the all-ages row (ratio 1), and "your
  age" joins "your pay" under "Sharper if you tell us"; once question 3 saves the year, settle moves the figure to the age's.
- **Held flat from 62** (`PAY_TOP_AGE`, critic M5, 2026-11-13): PINC-01 is total money income, so its older bands hold Social
  Security, pensions and withdrawals (65-69 $83,380, 70-74 $95,420) and read on they made a 70-year-old's pay rise above a
  62-year-old's, with the plan then counting their Social Security again beside it. Pay from work falls after the early 60s
  (PINC-03, earnings of people working full time all year: 55-64 $71,500, 65+ $68,240; `cps_median_earnings_by_age`, read
  2026-11-13), so from 62 (the 60-64 band's middle) up the ratio and the spread are 62's: R3's "held flat outside the end
  buckets", with 60-64 the last band of pay. Texas: $65,000 at 62, 70 and 75.
- **Spread:** sqrt(2 ln(mean / median)) of the CPS cell at that age (the mean read the same way), measured, so the figure is
  rounded to two figures (R11) and the middle half is e^(-/+0.674 s).
- **Their own business:** the same figure (spec: "the same, rough"; no table of self-employment pay is bundled). Part-time is
  not asked on question 2, so the full-time row is always used (spec 7.E's all-earners row is not wired: cut, see C5 notes).
- **Not guessed:** someone retired or not working now; a pay line kept in another period (a month's line is never given a
  year's figure: the estimator gives nothing, so the entry stays as it was); a pay line typed on Income (only Get started's own
  line, or one continuing it, is ever ours); outside the U.S. (the gate).
- **Why:** "typical full-time pay at 24 in Texas" ("in the U.S." with no state; "at <age>" only with a birth year).
- **Answer keys (2026-11-02):** Sam (24.7, Texas) $42,000, middle half $28,000-$64,000; Lee (59.2, Arizona) $67,000; no birth
  year in Texas $60,000 (Texas's own median, $60,353). Spec 7.H read the band flat and gave $35,000 and $68,000; the smooth
  read is the rule here (R3, "No birthday steps" above), so a 24-year-old is not given the figure of a 20-year-old.
- **What reads it:** every guess that reads pay follows it (the profile says "on our pay guess"), and settle runs pay first
  (tier 1), so a pay guess that moves with the age moves the saving, spending and Social Security guesses after it.

### Pay worked out from what reaches the bank (E34 `pay.fromTakeHome`; C5, 2026-11-13)
Tier 1 after `pay.gross`, a year, basis "yours" (worked out from the person's own figure), weight big. Question 2's quiet
"I only know what reaches my bank" turns the pay box into what one paycheck puts in the bank; the answer is kept in
`guide.setup.taps["pay-mode-<id>"] = "bank"` and `["take-home-<id>"] = { amount, period }`, and the pay before tax is
worked out and saved marked "worked out" (`uses.pay`), so it follows when the 401(k) share changes:

    takeHomeOf(gross) = gross - 401(k) - 6.2% x min(gross, wage base) - 1.45% x gross - federal income tax held back - state tax
    pay.fromTakeHome  = the gross with takeHomeOf(gross) = what reaches the bank a year (bisection to a cent, then $50, R11)

- **Social Security and Medicare tax:** 6.2% to the year's wage base and 1.45% (IRC 3101(a), (b); the 2026 wage base $184,500
  is in taxes/federal's tables, SSA, read 2026-11-02); the 0.9% extra Medicare tax is inside federalTax.
- **Federal income tax held back:** core/math/tax.js `federalTax` on this pay alone (less the 401(k)) with the household's
  filing status, as a paycheck's withholding is worked (a W-4 claims the household's status and its children on one
  paycheck: the first adult's). The child credit's refundable part is paid with the return, not in the paycheck, so it is
  left out (`totalTax + credits.refundable`, never below 0).
- **State:** none in a state with no wage tax; the flat rule (taxes/state `FLAT`, `flatTax`, read-only); a rate typed on the
  State page; a graduated state's tax is not counted (no rate is bundled: spec 16), so there the figure is a little low, and
  question 2's line under the box says so: "Oregon's income tax is not counted in it, so your pay is likely a little higher."
  (setup `payStateLeftOut`; Oregon $4,000 a month: $57,050, against $62,050 at 6.5%; critic M8, 2026-11-13).
- **Health insurance through work** (critic M7, 2026-11-13): when question 6's "How do you get health insurance?" says
  "Through work", what a worker usually pays for it comes out of the paycheck before the bank, before tax (a Section 125
  plan: out of the wages income tax and Social Security and Medicare tax are worked on): KFF Employer Health Benefits Survey
  2026, worker contribution a year, $1,672 single and $7,471 family (`kff_ehbs2026_premiums`, read 2026-11-02; the same table
  E05 reads), single for one adult with no children, else family, on the first working adult's paycheck (the one the
  children are claimed on). Jordan's $1,485 every two weeks then means $53,600 before tax, not $45,550; the plan counts the
  premium in Insurance and health, so the month is not short by it twice. Answered later than question 2, settle moves the
  pay when the answer comes. Another answer, or none: nothing is added.
- **The 401(k):** a share typed on Contributions (`pctOfPay`), dollars typed (Get started's question 4b, or Contributions), or
  question 4b's chip (`guide.setup.saving[id].pct`); else Vanguard's median participant deferral rate, 6.6% (How America Saves
  2026, `vanguard_has2026_headline`, read 2026-11-02) when a plan at work was picked (question 2's "Yes"); else none. Our own
  guess of what goes in (`contrib.amount`, tier 4) is never read: it is worked out from this pay.
- **Why:** "worked out from the $1,485 every two weeks that reaches your bank". Sharper: "your pay before tax".
- **Answer key (2026-11-02):** Jordan (Ohio, head of household, two children under 17, a plan at work): $1,485 every two
  weeks = $38,610 a year reaches the bank -> $45,550 before tax (no plan at work: $42,300). Spec 7.H said "about $48,000";
  the children's credit lowers the tax held back, which that figure left out.

## Goal amounts (estimators/goals.js and overview/setup's estimators; spec 7.F; C5, 2026-11-13)
Get started's question 7b asks "How much" for each goal picked. A box left blank used to save 0: the goal then counted
nowhere (Goals: "no amount"), and nothing said so.
- **Weight big, both** (critic M6, 2026-11-13): a goal's amount decides whether Goals calls it "behind" and what it needs
  a month ($2,033 a month for Jordan's $238,000), which spec 5.1 calls big ("can move a headline figure by $100 a month or a
  verdict"). So both are listed under "Matters most" and keep the Dashboard's "Look over our guesses" open.
- **`goal.home.target`** (tier 4, big, total): the typical down payment on a typical home in the person's state.
  `value = ACS median home value (state, else U.S.) x CPI since the table's dollars x NAR's median down payment share`,
  10% for a first-time buyer (a renter) and 23% for a repeat buyer (someone who owns a home now). Two significant figures
  (roundGuess, unmeasured). Ohio: $254,100 x 10% = $25,410, so **$25,000** for a renter; x 23% = $58,443, so **$58,000** for
  an owner. No state: the U.S. $371,100. The why-line says it is the down payment only ("add closing costs if you know
  them"): no closing-cost table is bundled. Sources: U.S. Census Bureau, ACS 2025 1-year, B25077 Median Value (table
  `acs2025_median_home_value_by_state`, read 2026-11-02); National Association of Realtors, 2025 Profile of Home Buyers and
  Sellers, median down payment by buyer (table `nar2025_home_buyer_profile`, read 2026-11-07).
- **`goals/education:target`** (tier 4, big, total, basis yours; in overview/setup's estimators because it reads the
  Education page's compute, which this folder may not import, spec 6.2): the Education page's own "Make it a goal" figure for
  each child with a birth year whose college has not begun, summed (`educationTarget` in modules/goals/education/compute.js:
  `round(totalToday x share / 1,000) x 1,000` a child). Jordan's two children (2019, 2023), public in-state: **$238,000**
  ($117,000 + $121,000). Source: that page's prices (College Board, Trends in College Pricing and Student Aid 2025).
  With two or more children the goal is one per child (critics M2 and person 2, 2026-11-13): on a child's own goal's path
  (`goals[setup-goal-education-<child id>].target`, `args.childId`, or the Education goal while `guide.setup.eduSplit` names
  it for the first child) the figure is that child's alone ($117,000 for Child 1, "four years of public in-state college
  for Child 1, in today's dollars"); `args.total` asks for the sum (question 7b's gray figure).
- **A trip, a car or "something else"** has no figure that fits everyone: it stays 0, and Get started's summary (and Your
  plan's "Not counted yet") says "The trip: add an amount on Goals, so it can be counted" (setup `standing().later`,
  key `goal-amount`).
- **Older plans**: Fill in what you skipped (`FILL_CASES` "goal") offers both amounts for a home or education goal Get
  started left at 0, once Get started is finished; "Use these guesses" writes them marked. A plan that already used the card
  before C5 is not offered it again (the case ends when used, as the others do); its summary line still says to add an amount.
  With two or more children still to start college the Education goal is split as question 7b now writes it (critics M2 and
  person 2): the Education goal becomes the first child's ("Child 1's college", that child's figure and start) and a goal
  is added for each other child (`setup-goal-education-<child id>`), each marked `goals/education:target` on its own path.
  A goal's amount does not change the left-over, so on the Dashboard (`guessCards`) a card with only goals on it is not the
  waiting card: those items go in `goals`, `first` is `"goals"` and `waitsMonth` is false (`"fill"` and `"missing"`, spending
  and debts, make the month and retirement wait; critic person 1, 2026-11-13). The card's footer and its saved notice name
  the pages of its own items (`typeWhere`: "on Goals", "on Expenses and Debts", "on Expenses, Debts and Goals").

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

### The tables (70, from 18 publishers)
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
| `scf2025_home_value_to_income` | cells.js | Board of Governors of the Federal Reserve System, Survey of Consumer Finances | 2025 survey, published October 2026 | ratio | 2026-11-07 | percentiles (worked out from the microdata by age group), and the median and households by age x income group |
| `scf2025_rent_to_income_by_income_fifth` | cells.js | Board of Governors of the Federal Reserve System, Survey of Consumer Finances | 2025 survey, published October 2026 | ratio | 2026-11-07 | percentiles (worked out from the summary extract by income fifth) |

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
  home's value against the state's typical owner-occupied home (ACS 2025), at least $350 a year (and that floor never above
  2.55% of the value: follow-up lane 2, below). It moves the mortgage payment
  guess's insurance part with it.
- **Spending rows** (spend.js `buildModel`): health insurance and medicine follow the oldest adult's age (CE 2025 by age) and the
  household's size; a household with a child under 18 never gets a row (but groceries) smaller than the same adults without
  one, because the survey's household types stand in for age; the rows are sized on take-home before typed pre-tax saving
  (`takeHome(..., { sizing: true })`), so saving more never raises the guessed dining and the retirement figure after it.
- **Get started** (overview/setup/compute.js): the Education goal is dated August 15 of the year the first child under 18 turns
  18 (`educationDate`); the cushion is the Emergency fund page's own advice, 3 months with two incomes, 6 with one, 3 more for
  pay that goes up and down (`defaultCushionMonths`; a figure typed on Assumptions or set on Emergency fund is kept, 6 included:
  `guide.setup.cushionWrote`); a retired person of 62 or more whose Social Security is left at "Estimate it for me" (the
  "Already retired" box on the ages question) gets the average retired worker's benefit at their age (SSA, Annual Statistical
  Supplement 2026, Table 5.B9, Dec 2025; `averageRetiredBenefit`), divided by the early claim factor before full age, in place
  of $0, and Our guesses for you names that table. Someone who said retired on question 2 and left "I already get it" blank,
  or "I have my statement figure" blank, or answered "Not sure", gets it too (follow-up lane 2, below).
- **No birthday steps** (`smoothAge` in estimators/common.js, `smoothVg` and `smoothPay` in estimators/saving.js): every figure the
  survey, Vanguard or the Census publishes by age group (cash, vehicles, home value, the 401(k) balance, the share of pay put in,
  the share who put in at all, the pay "people your age" have) is read on straight lines of the log between the groups' middles,
  so turning 35 moved a 401(k) guess from $6,900 to $13,000 and cash from $1,800 to $1,300 and now moves neither by more than a
  few percent. Check: `sr.saving.no-cliff`, `sr.saving.monotone`.
- **Two corrections in the spending rows**: a household with a child under 18 never gets a row (rent included) smaller than the
  same adults without one, because the survey's household types stand in for age; an adult of 65 or more with an income above the
  Medicare Savings Program's Qualifying Individual limit ($1,816 a month single, $2,455 a couple, 2026; CMS, read 2026-11-07) is
  never guessed under Part B plus the Part D base premium ($202.90 + $38.99 a month, 2026), rounded up to $10. That floor is
  a fixed bill in the row (follow-up lane 2): a tight month scales the rest of the row down, never the premiums (a retiree
  whose Social Security now counts as income had $130 against $241.89; `SF-HEALTH-AGE`).
- A home value held to its age group's range is taken to two figures on the inside of the bound (so rounding for display cannot
  step over it).
- The two `cells.js` tables are hand-kept, not built by tools/build-guess-data.mjs: `data/index.js` carries their read date,
  and a rebuild of the generated files must keep that line.

## Most likely, not the edge (follow-up lane 2, 2026-11-07; tests `tests/guess-likely.test.mjs`)
The owner's rule is that a guess is the most likely figure for people like you, not the edge of what is believable. Five
guesses moved; each decision is here with its data (the build notes in the follow-up's build.md hold the before and after).

- **Social Security already paid, left blank** (`overview/setup:ssPaid`, tier 4, order 2.5; overview/setup/compute.js
  `ssPaidGuess`, `averagePaidBenefit`). Someone of 62 or more who answers "I already get it" on question 3 and leaves the
  amount blank was planned on $0 (190 of the 371 such households in the sanity sweep at c804ed0 failed
  `pt.ss.not-zero-when-retired`). Now the
  blank is what SSA pays retired workers of that age a month on average: SSA, Annual Statistical Supplement 2026, Table 5.B9,
  "Number of retired-worker beneficiaries, percentage distribution by monthly benefit, and average monthly benefit, by age: By
  sex, December 2025" (https://www.ssa.gov/policy/docs/statcomps/supplement/2026/5b.html#table5.b9; read 2026-11-02, the page
  read again 2026-11-07): all retired workers $1,451 at 62-64, $1,967 at 65-69, $2,225 at 70-74, $2,154 at 75-79, $2,102 at
  80-84, $2,018 at 85-89, $1,897 at 90 or older; the men's or women's row when Longevity says which. December's benefits carry
  the 2.8% raise for 2026, so they are what is paid through 2026 (SSA's 2026 fact sheet: the average retired worker $2,071
  after the raise, Table 5.B9's own total). Read on straight lines between the bands' middles (63, 67, 72, 77, 82, 87, 92), so a
  birthday moves it a few dollars. It is written the way a typed amount is: the Income line "Your Social Security", the age it
  started (full retirement age once past it, else today's age; the stepper on the screen can change it) and the full-age
  amount worked back (paid / claim factor at that age, to the dime), both marked as ours (`overview/setup:ssPaid` on the line,
  `overview/setup:ss` on the full-age amount, which follows the line's figure: "worked back from what retired workers your age
  get"). The box shows it in gray with "Our guess: what retired workers your age get on average"; typing an amount ends both
  guesses; a line the person typed is never replaced. "I have my statement figure" left blank, and "Not sure", write what
  "Estimate it for me" writes (from the pay on file, or once work has stopped the retired average), as the full-age amount,
  with no Income line (nobody said it is paid). Only for a U.S. plan in dollars. From 70, a benefit not claimed is valued at
  70 by the Social Security page, so `averageRetiredBenefit` divides by the claim factor at 70 and the page shows the average,
  not 24% to 32% more.
- **The family floor, then a fit to take-home** (spend.js `fitFloor`). A household with a child under 18 never gets a row
  smaller than the same adults without one (the survey's household types stand in for age). That floor alone must never push
  the guessed leftover below zero. The rule: work the rows out as the household's own type spends (no floor) and with the
  floor; the room is the Budget's month after tax (cashflow/budget-percent `yearTaxes` afterTax / 12, handed over as
  `provided("budget:afterTaxMonth")`: federal tax with its credits, two returns for unmarried partners, state tax and payroll
  tax; fixer rounds 1 and 2, see "The room counts the child care credit" below) less the retirement saving out of pay (typed, or our guess at the figure its own estimator gives now: it reads only pay and age, so
  one settle pass still reaches the fixed point), less the bills typed and the loan payments, less the rows without the floor.
  The floor's extra goes on only as far as the room allows: first on rent, utilities and groceries (what a family cannot do
  without, and where the survey's families spend more), then on the other rows, each group in one share (all, part, or none),
  so the rows move smoothly as pay does. Where the rows without the floor already spend more than the room, no floor is
  added: it would only deepen a shortfall Get started already asks about. That is the one case this fit and
  `SF-SPEND-CHILD-MONO` (a child never lowers a row) cannot both hold. The rows are saved at the usual steps ($10 under
  $1,000, else $50) by `roundWithin`, never adding up to more than the rows without the floor plus the room: when rounding
  each row on its own would (g196 California: rent $2,432.99 to $2,450, the month $28 over the room, the Budget's leftover
  -$28 with $60 of the floor kept; g1204 Texas: -$33 with $113 kept), the rows that rounded up go to the step below, the
  most rounded-up first (g196 rent $2,400, leftover +$22; g1204 rent $1,650, +$17). Fixer round 3, 2026-11-11,
  floor-rounding-negative; test: tests/guess-likely.test.mjs. Since the rows now round to fit the room, the room must be the
  same on every settle pass: the Budget's tax reads our guessed 401(k) line at its estimator's figure (as the saving out of pay
  already did), or a raise left the first pass $3 a month tighter and the Texas couple at 20 ($40,000 to $46,000) saved
  shopping at $390, then $400 on a second pass (test "the family floor never pushes the guessed leftover below zero"). Re-run 2026-11-11 (fix round 2 on the Social Security
  lane, `node qa/guess-sanity.mjs --rules SF-SPEND-CHILD-MONO`): 3 of its 180 pairs, all the same California couple at $30,000
  each, renting, at 25, 33 and 40, with a baby. Rent, utilities and groceries are unchanged ($2,200, $290, $580); the total
  falls from $5,080 to $4,630 a month, all on the other rows, because the couple without a child is already about $900 a
  month short ($928 at 25) and the family's rows are fitted to its room (its left-over goes from -$928 to -$295, more than the
  $183 a month child tax credit). The Ohio and Texas pairs at $60,000 the earlier count named (9 of 180) no longer fail since
  the room became the Budget's own month (fix round 1). Kept as a soft rule's known exception: lifting the family's rows to
  the childless couple's would only deepen a shortfall Get started already asks about. (On the tree before this lane, 0 of 180
  failed: the floor was not fitted to the Budget's month there; the full sweep of 2026-11-11 still counts 3 of 180, soft.)
- **Rent never above what 95 in 100 renters at that income pay** (spend.js `rentCap`). A California couple of 20 on
  $188,000 was guessed $3,550 a month, 22.7% of pay, over the 21.5% that 95 in 100 renters in the top income fifth pay. The
  choice was the fifth's 95th percentile as a ceiling, or the fifth's median in place of the model. The median was refused:
  the model carries the state's rents and the household (a California couple), which the survey's national fifths do not, and
  the top fifth's median (11.7%) would put that couple at $1,830 a month, under California's median rent for all renters.
  So the model's figure stands and the 95th percentile is its ceiling, made never to fall as income rises (each fifth's
  ceiling is also held to the next fifths' share at their lowest income). Data: SCF 2025 summary extract (SCFP2025, RENT x 12
  over INCOME among renters, weights WGT; https://www.federalreserve.gov/econres/files/scfp2025excel.zip; computed 2026-11-07;
  the fifths' cut-offs and percentiles as the sanity check's SF-SPEND-RENT holds them): 95th percentile 123%, 56.8%, 47.5%,
  29.2%, 21.5% of income by fifth (incomes from $0, $35,946, $63,676, $102,703, $174,595).
- **The home's value: the cell's median, not the cap** (`homeCellValue` in common.js, home.js `home.value`). Over the top of
  the age group's range (95th percentile of value over income) the formula is no figure to believe, and the top is not the
  likeliest either: there the guess is the survey's age x income cell, the median of value over income in the cell times the
  income at the group's middle, at the state's prices (ACS 2025 median value of owner-occupied homes, the state's over the
  nation's: New York 1.27, Ohio 0.69, Mississippi 0.52). The cells' values are made never to fall as income rises (a thin cell
  that dips is pooled with its neighbor, weighted by households), read on straight lines of the log between the groups'
  middles and across the age groups' middles. Below the lowest group's middle the value is held flat, because owners' homes do
  not fall with income there (SCF 2025, all ages: median home $173,000 under $10,000 of income, $176,000 at $10,000 to
  $15,000, $186,000 at $15,000 to $20,000). Data: SCF 2025 full public data (x716 home value, x5729 income, the oldest adult's
  age from x14 and x19) and the summary extract's INCCAT, weighted medians per implicate averaged (computed 2026-11-07;
  `p50:<group>` and `n:<group>` rows of `scf2025_home_value_to_income`). A $12,000 earner of 30 in Ohio who owns: $85,000
  (the cap) before, $80,000 now. The worked example in the follow-up's brief, a $20,000 earner of 20 in New York with a
  mortgage, comes out at the cell's $135,000 at New York's prices, which rounds to the same $140,000: the survey says that is
  the likely figure there, not only the edge. Under the bottom of the range the guess stays held at the bottom: there the
  formula's figure runs along the 5th percentile for higher pay (1.19 to 1.22 times pay from $230,000 to $300,000 at 45 in
  Mississippi), so swapping in the cell's figure whenever it dips under made the guess fall a sixth and rise again as pay went
  up $5,000 at a time. Checked: no fall as pay rises in $1,000 steps from $5,000 to $80,000 at seven ages in four states; the
  largest step is 1.32 times, where the cell meets the formula (Ohio, 20, $13,000 to $14,000).
- **Home insurance on a cheap home** (home.js `insuranceYear`, `INSURANCE_SHARE_CHEAP`). The $350 floor stays, but never above
  2.55% of the value: the weighted median of insurance a year over value among owners of homes worth under $30,000 (Census
  American Housing Survey 2023 national PUF v1.1, household.csv, INSURAMT x 12 over MARKETVAL, TENURE 1, WEIGHT; 314 homes;
  https://www2.census.gov/programs-surveys/ahs/2023/AHS%202023%20National%20PUF%20v1.1%20CSV.zip; computed 2026-11-07). The
  sanity check's 1.61% is the 95th percentile over all owners, most of them in dear homes; owners of homes under $30,000 pay
  more of the value than that three times in four (25th percentile 1.68%; homes of $15,000 to $30,000: median premium $600
  a year, 72% pay $350 or more). So a $10,000 home is guessed at $255, not $350; from $13,700 the $350 stands. The rule
  HD-HOMEINS should judge homes under $30,000 against their own range (the tester's file).

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
- Merged with the 58-sentence follow-up (2026-11-07, p111): the bank balance line reads "a typical bank balance for someone aged 38 with your income" ("with our pay guess" when the pay is our guess); the debt lines read "a typical car loan balance for your age and income". Test: `tests/wording-left.test.mjs`.

## Taking a guess back, and how much is left (stress test 2026-11-11: x-3, F1, F2, F11)
"That's about right" and Save carry the same outlined Undo as the cards (`undoOf`), and say where the figure lives from now on
(`homeOf(path)`: Expenses, Debts, Net worth, Income, Will the money last?, Goals, People) with a 44 px button to it. The hero
counts the rows left ("3 to look over", "All looked over"). Save is outlined until its box has something in it. A row looked over
stays as one line ("✓ Rent: kept at $1,250 a month") in its place, at its height, for the rest of the visit (a new address is a new
visit), so the next row does not slide under the thumb; when "Matters most" empties in a visit it says "Matters most: all looked
over", and "Matters less" opens by itself only when the page was opened with nothing above it. Naming which other guesses moved
with a saved figure ("7 of our guesses moved with it") is core/app.js's sentence: waits for wave 1.

## Retest 2026-11-11 (claude-f, second phone tester)
- Kept lines go back to the row's place as first drawn this visit (`visit.ord`); they came out in reverse order.
- Keeping the last row shows "All looked over" with the lines, never "every figure is one you typed".
- "Better guesses are ready", once its figure is settled, leaves a short card of the same height for the visit, so the
  next row does not move under the thumb.
- A typed figure far from our guess (`farOff`: money over three times it or under a tenth, a rate over three times it) is
  asked about once; a second Save keeps it. No "?." after a page named with a question.
## Tax and insurance in the payment; loans by age (2026-11-07, loans lane 1; tests `tests/loans-escrow.test.mjs`)
- **`debt.mortgage.escrow`** (estimators/home.js, tier 2): the usual property tax and home insurance a month inside a mortgage's
  payment, for `debts[<id>].escrowMonthly`: `min(escrowMonthly(home value, state).total, payment / 2)`, and 0 when taking it out
  would leave no more than the month's interest (owed x rate / 12). Kept to the cent (`rounded: true`): the pages take exactly this
  out of the payment, so a kept payment's payoff does not move. Tables, as `escrowMonthly` ("The home" above): the property tax
  rate by state (`acs2025_effective_property_tax_rate_by_state`: Census ACS 2025 1-year, median taxes over median value), the
  state's average HO-3 home insurance premium (`naic2023_homeowners_premium_by_state`: National Association of Insurance
  Commissioners, 2023 figures published July 2026, read 2026-11-02, in the tables list above; taken to 2025 prices with CPI,
  x 1.057) scaled by the home's value against the state's median (ACS 2025). By hand, Ohio, a $270,000 home:
  270,000 x 1.223% / 12 = 275.18, plus 1,116 x 1.057 x 270,000 / 254,100 / 12 = 104.45, together $379.63. (Corrected 2026-11-11:
  this line cited the American Housing Survey for the insurance; no AHS table is read.) Checked by guess sanity HD-ESCROW-GUESS.
  The bounds were replaced on 2026-11-11: see "Fix round 1" below.
- **Keep, and the same figure typed**: "Keep" on a guessed mortgage payment (or saving it unchanged on Debts or Get started)
  made the payment the person's, and a typed payment is read as the loan's alone, so the tax and insurance it held went into
  the loan: the couple aged 25's payoff moved from June 2054 to June 2043. Now `escrowBefore` notes what each guessed payment
  held before the save and `escrowKept` writes it to `escrowMonthly`, marked as our guess. Get started also keeps the guessed
  rate when the two figures typed are the ones it showed (`applyOweGuessed` keepRate), so nothing moves.
- **The question** (Debts and Get started 5b): `answerEscrow(draft, debtId, "yes" | "no" | "unsure", amount, today)`; `escrowSaid`
  reads it back. Get started's grey balance reads the answer (`oweArgs` `escrow`: 0 for No, the figure for Yes with one).
- **Older owners' guessed payment** (`debt.mortgage.payment`): when our balance is above what the purchase loan would owe now (a
  refinance or a second loan, read from the usual balance for the age), the principal and interest is capped at the larger of
  the purchase loan's own payment and a new 30-year loan on the balance: `pi = min(pi, max(bought.pi, pmt(rate/12, 360, owed)))`.
  Before, the payment was 1.14 to 1.43 times the purchase loan's own for owners aged 61 to 80; now 0.99 to 1.00.
- **Year taps by age** (`tapSpan`, `mortgageAsk`, `startAsk`): a span ("2010 to 2019") is offered and read only from the year
  the oldest adult was about 20 (`YOUNGEST`, the owner's rule for the youngest age a home is bought at, estimators/purchase.js); a span that starts earlier is cut to
  that year, and dropped when it ends before it. The car loan's taps the same ("5 or more years ago" needs 25 or older).
- **The loan's own start**: Debts' `startDate` and `termMonths` are read first (`startOf` via "loan") when the balance is ours.
  A purchase date typed on the Home page no longer moves a guessed rate when the balance and the payment are both typed
  (`start.via === "typed" && !both`): the two figures already say the loan.
- **Orphans** (C2 follow-up F2): settle drops a debt row's entries once its loan account is gone (core/estimate `orphanDebt`).
- **Twins** (C2 follow-up F4): `guessTwins` no longer offers a rental as the home we guessed, nor a loan named for a car as
  "another loan" or one not named for a car as the car loan (Get started's `existingOwe` test).

## Fix round 1 on the loans lane (2026-11-11, claude-c; tests `tests/loans-escrow.test.mjs`, the ones named "fix ...")
Three reviews of the lane (money, layperson, breaker) found the points below; each has a test written first and seen to fail.
- **One reader, three kinds of figure** (`loanEscrow`, estimators/home.js). The tax and insurance inside a mortgage payment are:
  1. the figure the person typed, used as typed, never more than the payment (it was cut to half the payment without a word:
     $900 typed on a $1,600 payment was read as $800; a figure above the payment is stored as the payment);
  2. a figure of ours on the row (kept with its payment, or answered "Not sure" / "Yes" with no figure), at most half the payment
     and at most `escrowCap`;
  3. with no figure on the row and a payment or balance still ours: the usual figure, with the same two bounds.
  `escrowCap(account, debt) = max(0, payment - pmt(rate / 12, 360, owed))` (core/math/finance.js `pmt`): what is left of the
  payment after the level payment of a new 30-year loan on the balance. So a guessed figure never makes a loan run past 30 years.
  It replaces the old guard ("more than the month's interest"), which let a figure just under it stretch typed loans to 40 to 90
  years (40, Texas, $230,000 at 4.6%, $1,700, "Not sure": 526 months) and fell to 0 at a cliff beside it, where more debt gave an
  earlier payoff ($190,000: 807 months; $200,000: 286). By hand, 25, Texas, $230,000 at 6.7%, $1,850: pmt = 1,484, so the figure
  is at most 366 and the loan runs its 360 months (it was 531 and 651 months).
- **A kept figure is frozen.** `debt.mortgage.escrow` returns the row's own figure when it was kept with its payment and never
  answered, so a home value typed later no longer moves the payoff (the couple aged 25: 2054-06 became 2077-06). One answered
  "Not sure" or "Yes" with no figure still follows the home, inside the two bounds.
- **Keep on the balance beside a typed payment** (`escrowBefore`, `escrowKept`): every mortgage whose payment is read with tax and
  insurance of ours is held, not only one whose payment is the guess; when both figures are the person's and the payment is
  unchanged, the figure is written to the row. Get started keeps the rate too when one of the two figures was ours and typed
  back and the other was already the person's (`applyOweGuessed` keepRate). Net worth's account form calls the same pair.
- **One mortgage's answer is that mortgage's** (`answerEscrow`, `escrowSaid`, new field `debts[].escrowSaid`). The plan-wide tap
  `guide.setup.taps.escrow` is written and read for Get started's own mortgage only; "No" on a cabin's loan used to take the tax
  and insurance out of the home's payment. When no usual figure can be worked out (the loan has no home on file) the answer is
  kept and `answerEscrow` returns "ask": Debts asks for the figure instead of showing "Choose one" again.
- **Keep never moves the other figure** (`loanPI`, `shownOwed`, estimators/debts.js). The loan part of a guessed payment is one
  function of the balance, whoever typed it, in three steps that join up: up to the purchase loan's balance, `pmt` over the months
  left; above it, up to the balance we show with nothing typed, the purchase loan's own principal and interest, never under a new
  30-year loan's (lane item 4, unchanged); above the balance we show, `pmt` over the months that balance and its payment imply
  (`nper`). A payment typed is worked back over those same months (`pv`), and the payment we would show, typed back, gives the
  balance we show. Before, keeping the balance moved the payment in 236 of 448 households and keeping the payment moved the balance
  in 202 (the Florida widow: $1,540 to $1,730, or $100,000 to $84,000). Decision: a typed payment for owners whose balance we take
  to be above the purchase loan's is now read over more months than before, so the balance worked back is larger (the couple aged
  61 and 59 with $1,600 typed: $260,000, was $180,000). That is the cost of one rule both ways; the reviewers' own proposal
  (`pv` over 360 months) gives the same figure here.
- **A known start sets the months.** A start typed on Debts (`via: "loan"`) and one answered on the tap "When did you take out
  this mortgage, or last refinance it?" (`via: "tap"`) are the loan's clock: no cap, and a balance of ours for a loan typed on
  Debts is that loan's own balance (not blended toward what families like this owe). The lane's build capped both, so a 2015 loan
  with 223 months left showed 274. A start on Debts before the oldest adult was about 20 is set aside. One with fewer than 60
  months of its term left, beside a typed balance larger than that loan could still owe (the share of a level loan still owed
  with those months left, times the home's value), is stale: the loan is counted from our guess for the age and the page asks
  when it was last refinanced. So $150,000 typed beside a start in 2000 gives about $1,220 a month, not $4,840.
- **After the loan** (`escrowAfterLoan`, `taxOrInsuranceBilled`): see retirement/projection's README, "Fix round 1".
- **Decision kept from the lane, for the owner to see** (layperson L-2, breaker B-8): lane item 4 says to pay a balance above the
  purchase loan's at that loan's own payment and take the months from `nper`. For a couple aged 61 and 59 that is about 30 years
  (to age 91). The brief names the rule, so it stays; the mortgage page now says the number of extra years instead of "a little
  longer". A ceiling on the months, or a lower guessed balance, would change the rule the owner set. **Superseded in fix round
  2** (below): the final check showed only the words had changed, so the months are now bounded by data.
- **Sources**: the escrow share, Survey of Consumer Finances 2025 public microdata, variable X810 ("Does the payment include
  taxes or insurance?"), Federal Reserve Board, https://www.federalreserve.gov/econres/scfindex.htm, released 2026-10-09. Among
  families with a mortgage payment, weighted, all five implicates: both 55.8%, taxes only 6.8%, insurance only 3.5%, neither
  33.9% (recomputed from the microdata in the lane's money review, 2026-11-11; the build's 56.0% used a filter it did not
  record). Either way most payments include them, so "Not sure" counts them in.


## Fix round 2 on the loans lane (2026-11-11, claude-c; tests in `tests/loans-escrow.test.mjs` named "fix2 ...")
The first final check left these open; each test was run first and seen to fail.
- **A guessed mortgage ends about when owners of that age usually finish** (`usualMonthsLeft`, `YEARS_LEFT_BY_AGE`,
  estimators/debts.js `loanPI`). The middle step of `loanPI` (a balance above the purchase loan's: that loan's own principal and
  interest, months from `nper`) had a floor of a new 30-year loan's payment, so a guessed loan of a couple aged 61 and 59 ran to
  age 91, and the first fix round carried those months into a payment typed alone ($1,600 -> $260,000 owed). Now the most months
  that step can make are `most = min(360, max(left, usualMonthsLeft(age)))` (`left`: the purchase loan's months left), and its
  principal and interest is `min(pmt(r, left, B), max(purchase P&I, pmt(r, most, B)))`. A payment typed alone is worked back over
  the same bounded months (`pv`), so Keep still moves nothing.
  `usualMonthsLeft(age)` joins these points with straight lines, flat past the ends: the weighted median years left on the first
  mortgage on the main home (the year it was taken out or last refinanced, X802, plus its length in years, X806, less 2025) among
  families with one (X805 > 0), by the age of the head (X14), weight X42001, all five implicates, at each group's mean age:
  under 35 (30.0): 27 years; 35-44 (39.5): 25; 45-54 (49.6): 24; 55-64 (59.5): 23; 65-74 (69.2): 19; 75 and over (80.3): 17.
  Source: Survey of Consumer Finances 2025, full public data set (Stata file p25i6), Federal Reserve Board,
  https://www.federalreserve.gov/econres/scfindex.htm, computed 2026-11-11 (interquartile range at 55-64: 12 to 26 years).
  By hand, the couple aged 61 and 59 in Arizona, nothing typed: `left` 188, `usualMonthsLeft(61)` = 12 x (23 + (19 - 23) x
  1.5 / 9.7) = 269, so $140,000 at 4.4% is paid at about $1,120 to 2049 (age 84; was $980 to 2056, age 91). Pat and Lee with
  $1,600 typed: $230,000 owed (base $180,000 over the purchase loan's 188 months; first fix round $260,000), debt-free 2050.
  Decision: the reviewers offered a payoff-age ceiling of about 85 or the purchase loan's months plus an allowance; the survey's
  own years left by age is the most likely value for the household, so it is the bound (it gives a payoff at about 83-85 at 60-65).
  Sweep (5 states, single and couple, ages 50-85, nothing typed): over 25 years at 50-64, 0 of 120; ending after 88 at 65 and
  over, 22 of 110 (base 10; before this round 28, and 13 of 120 over 25 years at 50-64), all owners of 75 to 85 whose own purchase loan still has 9 to
  12 years to run; the survey's median at 75 and over is 17 years left, so no age ceiling is put on them.
- **Keep on a guessed balance alone** (`escrowBefore`, `escrowKept`, `homeFactsTyped`, estimators/home.js; `escrowFor`,
  estimators/debts.js). The home's guessed value takes a typed balance as a floor (HD-MORT-UNDERWATER), so keeping the balance
  while the payment was still ours moved the tax and insurance and so the payment (couple aged 35 in Texas: $2,280 -> $2,340).
  Now the usual figure that payment was worked out around is written to `debts[].escrowMonthly` as our guess with the balance;
  the payment we still guess is rebuilt from it and does not move (money grid: 4 of 104 moved, now 0; breaker sweep: 17 of
  3,584, now 0). Once the person types the home's value, tax or insurance, that figure and the payment we guess follow it again.
  Left: the guessed home value itself still steps up on Keep (as on the base), which moves the retirement figure by $10 in 20 of
  3,584 sweep households.
- **Not done: a typed payment beside a home we guess** (layperson L-8). A payment typed alone can still give a balance at 95-100%
  of the guessed home value (the balance is held to the home's value). Letting the home follow that balance needs the two guesses
  solved together (the balance reads the home for its cap and its tax and insurance; the home would read the balance), which the
  one-pass settle cannot hold without moving on a second settle. Left for a later round; same at base.

## Fix round 1 on the Social Security lane (2026-11-11, claude-c; tests `tests/guess-likely.test.mjs`, the ones named "ssg-...")

- **The family floor's room is the Budget's own month** (ssg-M-1, B-3, B-8). The room was take-home from the survey's
  after-tax ratio and one federal return without the two returns of unmarried partners, so the floor was cut where it fit
  (g1491, Texas partners with three children: room -$51 against a Budget leftover of +$341). It is now
  cashflow/budget-percent `yearTaxes(...).afterTax / 12` (federal tax with every credit, two returns for unmarried partners,
  the State page's tax, payroll tax), worked out with no spending lines (the care row is one these rows size; reading it made
  the gray figure on question 6 differ from the one saved, SF-SPEND-ONE-FIGURE), plus the care account's money lost. The
  guesses may not import that page (it reaches them back through the next-step card, the import rule in module.test.mjs), so
  the page hands the figure over through core/estimate: `provide("budget:afterTaxMonth", ...)` when it loads,
  `provided("budget:afterTaxMonth")` here. The app and qa/guess-sanity load every page first; a caller that has not loaded
  it gets the old take-home rule. Then less retirement saving out of pay, typed bills and the rows without the floor.
- **Never under the family without the floor** (ssg-M-2). Where the needs (rent, utilities, groceries) do not fit, the family
  pays them from its other guessed rows, each down to the envelope's lowest k (0.5), and the other rows keep none of the
  floor; no row ends under what the same household without a child gets. g1491 was $142 a month under it.
- **The home value never jumps where the cell meets the formula** (ssg-B-4). Over the top of the range the guess moves from
  the top (where the formula just reaches it) to the cell's figure once the formula is a quarter over it (`CELL_BLEND` 1.25),
  on a log scale. Ohio at 24: $71,000, $74,000, $79,000, $89,000, $96,000 at $10,000 to $14,000 pay (was $73,000 three
  times, then $96,000: x1.32). New York at 28: $160,000 to $200,000 from $24,000 to $30,000 pay, no step over x1.13. A
  quarter, not more: the Ohio owner of 30 on $12,000 stays within 5% of the cell's figure, as the lane's own test holds.
- **Social Security we guessed counts as income in the guesses** (ssg-B-2). `incomeLinesOf` (common.js) adds, for an adult
  whose full-age amount is our guess (ledger key `overview/setup:ss`) with no Income line, the amount the Social Security page
  pays from the claim age on file (full retirement age, or 70 from 70), once that age is reached. The same claim factor as
  that page (SSA: 5/9 of 1% a month for the first 36 months early, 5/12 of 1% beyond, the delayed credit after; the rule is
  repeated in common.js because the guesses import data files only: retirement/social-security/data/ssa.js). So "I have my
  statement figure" left blank plans the same spending and verdict as "I already get it" left blank.
- **Words**: a guess built on our Social Security guess says "on our Social Security guess", not "on our pay guess"
  (`incomeGuessWords`, ssg-L-4). Our guesses lists one row per person's Social Security: when the monthly payment is our
  guess, the full-age figure behind it is not listed again (ssg-L-7); the rows carry the person's name.
- **Decisions.** ssg-M-6: the dashboard's "usual" figure for spending now counts our Social Security guess as income, so
  four qa plans with guessed Social Security (none typed) move (H-0012 shows "Is something missing?"); intended, since the
  plan counts that income everywhere else. ssg-B-10: a retiree's guessed spending above a guessed Social Security is the plan
  drawing on savings, as for typed figures; the floor fit is about children and is not run for retirees. ssg-M-3/B-9: the two
  new `sr.verdict.monotone` households are traced to a health-cover cliff in retirement/healthcare (g2304, the same cliff
  exists on the base tree) and a $10 rounding of the refilled rows (g2328); see docs/handoffs/2026-11-11-ssg-claude-a.md.

## Fix round 2 on the Social Security lane (2026-11-11, claude-c; tests `tests/guess-likely.test.mjs`, "fixer round 2")

- **A retiree under 67 who has not claimed yet is sized on the Social Security the plan pays from its start** (ssg-B-2).
  `incomeLinesOf` (common.js) counted our Social Security guess only from the claim age on file, so a retired person of 62 to
  66 who left the amount blank ("I have my statement figure" with no figure, or "Not sure") was sized on no income at all
  (Ohio renter at 62: $3,280 a month, short at 65) while "I already get it" was on track at about $1,160. Now (1) Get started
  claims a retired person's blank or unsure figure today when they are under full retirement age (the figure is the average
  SSA pays people who claimed at that age, Annual Statistical Supplement 2026 Table 5.B9; overview/setup README), and (2)
  `incomeLinesOf` counts it before the claim age for a retired adult of 62 or more with no non-Social Security income of their
  own (the projection pays it from its start). Every retired 62 to 66 statement/unsure household in Ohio and California,
  owners and renters, now gets the verdict "I already get it" gets.
  **Before the claim age** (fixer round 3, 2026-11-11, NEW-delay-claim): the amount counted before the claim age is the
  full-age figure x the claim factor at today's age (what a claim made today pays: the figure Get started wrote), never the
  larger amount of a later claim age the person set themselves. Round 2 used the claim age on file, so a retired 62-year-old
  who answered "Not sure" and then set 67 on the Social Security page was counted as drawing $2,072 a month today instead of
  $1,451, and the guessed bills rose with it (Ohio renter $1,160 to $1,660, short at 66; California $1,540 to $2,160). Now the
  bills stay where they were before the claim age was set (Ohio $1,160, $1,160, $1,440 and California $1,540, $1,540,
  $1,780 at 62, 63 and 65). Decision: the verdict
  may still move, because waiting to 67 with no pay means living on savings until then (Ohio 62: short at 65 on the same
  $1,160; Ohio 63 and 65 stay on track; California 63 goes from short at 88 to tight). That is the person's own choice shown
  honestly, not our guess; counting nothing before the claim age instead would have sized a retiree on no income again.
  Test: tests/guess-likely.test.mjs "NEW-delay-claim".
- **Soft sanity rules that fail more often on this lane** (fixer round 3, w4-worsening-unjustified). Grid plus edge
  households, base to lane: pt.withholding.default-follows-w4 6,119 to 6,337 (218 new, 0 gone), sr.retire.like-you 213 to
  241 (28 new), HD-MORT-RATE-VINTAGE 5,665 to 5,679 (101 new, 87 gone), pt.bought.payment-vs-pay 450 to 457 (9 new, 2 gone).
  Every new failure of the first, second and fourth rule, and 95 of the 101 of the third, is a household with a retired adult
  aged 62 or more, which is the change this lane makes on purpose: that adult's guessed Social Security now counts as income.
  Withholding: a retiree aged 62 to 70 beside a working spouse or partner (g12391, California partners 62 and 52: tax $9,430,
  withheld $6,174) now owes on the benefit, and that bill is real, because Social Security withholds federal tax only when
  the person asks on Form W-4V; nothing is withheld by default. Retire-like-you: a retired couple of 62 (g12055, g12057) now
  sits in a different income cell of the savings table, so the guessed savings of $220,000 land at 6.7 times that cell's
  median instead of inside it. Home payment versus pay: a retiree beside a worker with a mortgage (g12577: payment $2,120 plus
  $1,220 of other debts on $6,083 of pay, 55%) gets a home payment sized on household income that now includes the benefit,
  while the rule divides by pay alone. Mortgage rate year: the failures move between households (g619 leaves, g577 joins; a
  retired 65-year-old in Ohio, g13080, now gets a 2012 loan at 4.8%, 1.14 points over that year's average); the net change is
  14 of about 5,700 and its exact path was not traced further. Decision: keep the Social Security income and leave these four soft rules as they are; none of them
  is a hard rule, no KNOWN count rose, and lowering the benefit to pass them would size retirees on no income again.
- **The room counts the child care credit** (ssg-M-1 residual). The Budget's month handed over through core/estimate now
  takes the care figure: `provided("budget:afterTaxMonth")(plan, today, care)` reads the typed spending lines as they are and,
  for a care row we guess, this model's care row before the floor (so the room does not depend on the figure it sizes). Round
  1 left the credit out, so g420 (Ohio, children 5 and 2, paid care) had 61% of its $209 floor cut while $207 a month was
  left. Now a floor is cut only when the month has at most $25 left (g420 $27, g426 $28: the rows are saved rounded, care to
  $100, the rest to $10; g510 -$6).
- **The PC server computes the same guesses as the app** (ssg-provider-order). `budget:afterTaxMonth` exists only once
  cashflow/budget-percent is loaded. The app and qa load every page, but `POST /api/compute/overview/guesses` (a heavy page)
  imported only this page: Get started's spending offers fell back to take-home less payroll tax (g420 with no bills yet:
  car $220 on the server, $270 in the app). core/estimate/providers.js `PROVIDED_BY` names the page behind each handed-over
  figure; server/server.mjs imports those pages before a compute; a test checks every `provided("...")` name is listed and
  that the server's spending offers equal the app's.
- **Decisions.** Claim today, not at full retirement age, for a retiree's blank figure: the figure is what people who claimed
  at that age are paid, and a retiree with no pay is most likely already drawing it. A claim age the person sets on the Social
  Security page, or a typed statement figure, takes over (the note `guide.setup.ssClaimWrote` is dropped). A non-working
  spouse of 62 with no record of their own still gets no Social Security from the guesses (the spousal benefit needs a source
  figure for the average spousal benefit; left for a later round).

## Review 2026-11-11 round 5 (claude-r N20)
- After the page has been still for 2 s, held space is let go only if a button or box is on screen at or below the last tap. That control is kept in place. With none there (a tall kept row at 320 px), the space waits for the person's own scroll or wheel, so nothing rises under a resting thumb. A tap clears the wait, so the page's own scroll after a keep never lets go. Checked at 320 px with the thumb near the bottom edge: before, another row ("Bo's Social Security…") slid under the thumb at 1.9 s; now the kept line stays there. The wait ends on the person's own scroll (a swipe lets go during the swipe; the touch that starts it does not clear the wait, only a tap's click or a key does), holding still what is under the thumb.

## Review 2026-11-11 round 6 (claude-r N20 at 390)
- The held space is never let go on the 2 s timer. After the page has been still for 2 s, the next scroll or wheel by the person lets it go, holding still the first button or box at or below the last tap (else the line under the thumb). With the thumb resting, nothing moves until the next render: at 390 px the timed release used to drop "Open Will the money last? ›" where Insurance was tapped, and a re-tap opened it. While held, the space sits inside the kept rows. Once it is let go, the page keeps only enough length below for that scroll not to be cut short, and each later scroll shrinks it by the distance scrolled (down to the page's own height, and never so far that the scroll is pulled back), so the person never scrolls into a blank screen (attack: a whole 844 px screen of blank under "Continue your plan" before).

## Review 2026-11-11 round 7 (claude-r N22, N23)
- N22: the first way of trimming that blank measured the page with it removed on every scroll. That forced a shorter page, the scroll snapped back, and after every row was kept "Continue your plan" stayed hidden at the bottom edge. Now the blank's height is kept in a variable and lowered by the distance scrolled, with no measuring. The same steps reach the end of the page with Continue in view.
- N23: "Matters less" (or "More of our guesses") remembers, for this visit, whether the person opened or closed it. It used to fold shut again after every keep inside it, so the person re-opened it after each one. It still never opens by itself as "Matters most" empties.

## Lines left out of the totals (gap #32, 2026-11-14)
The spending guess from the bank lines (`estimators/spend.js` `bankSpend`) does not read a line the person left out of the
totals on the Transactions page (ledger `counted`: a purchase to be paid back, the money back, a one-time thing left out of
reports), as no spending page counts it. With none marked the lines read are the plan's own list
(`tests/left-out.test.mjs`).
