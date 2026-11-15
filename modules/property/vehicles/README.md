# Vehicles  (`property/vehicles`)

**Status:** usable, phase 7
**Purpose:** What each car really costs a year and per mile, and keeping it against buying new or leasing over the same years.

## Inputs
- `accounts[]` of type `vehicle` (value); `property[]` entries with `kind: "vehicle"`: `{ id, accountId?, name, value (without an account), milesYear, mpg, fuelPrice, electric?, kwhPerMile, kwhPrice, insuranceYear, maintenanceYear, registrationYear, loss, loanAccountId? }`.
- The loan named by `loanAccountId`, with its rate and payment (`balance/liabilities`).
- `whatIfs.vehicles = { car, years, newPrice, newSalesTax, newMpg, newRate, newTermMonths, newDown, newInsuranceShare, newMaintenanceYear, leaseMonthly, leaseDue, leaseMonths, leaseMiles, leaseExcess, upkeepRise, ev? }` (`ev`: "Electric or gas for your miles", below).

## Outputs
`{ ready, cars: [{ id, accountId, name, value, details, loan, year: { lines, total, monthly, perMile } }], total, monthly, chosen, comparison: { years, tradeIn, loanLeft, newPayment, financed, options: [{ id, label, out, back, cost, monthly, endValue, owedAtEnd, terms }] }, inputs, best, previewed? }`.
`compute(plan, { today, previews? })`: `previews` and `previewed` are in "Our guess in the rate box" below. Also exported:
`PREVIEWED`, `newCarRate`, `estimators` (re-exported by `module.js`, merged by `core/app.js`).

## Formulas
- A year: value lost = value × loss (default 12%); fuel = miles ÷ mpg × price (electric: miles × kWh a mile × price);
  insurance, upkeep, registration as typed; loan interest over the next twelve payments (`yearOfPayments`). Per mile = total ÷ miles.
- Values: a used car × (1 − loss)^years; a new one × (1 − 20%) after year one, then × (1 − 15%) a year (rough averages).
- Keep: the old loan's payments for the period (stopping when paid) + fuel, insurance and registration at today's
  prices + upkeep rising 10% a year as the car ages (only upkeep rises); back = its value at the end less what the old
  loan still owes then, so it compares like for like with buy and lease, which pay that loan off at the start (until
  2026-10-31 the debt left at the end was ignored).
- Buy: trade-in = value − old loan; a negative trade-in is paid in cash; financed = price × (1 + sales tax) − positive
  trade-in − cash down, at `newRate` over `newTermMonths`; payments for the period; running costs with the new mpg,
  insurance × 1.25, upkeep `newMaintenanceYear`, all at today's prices every year (a new car's upkeep is counted flat);
  back = the new car's value at the end − what is still owed.
- Lease: the old car goes when the lease starts, so a positive trade-in comes back as cash (`leaseCredit`, taken off what
  is paid; a negative one is paid off, as for buy) + due at signing for each lease started in the period + payments every
  month + miles over the allowance × the charge + running costs at today's prices (upkeep halved: under warranty); back = 0.
  Until 2026-10-31 a positive trade-in was not credited, which made leasing look dearer by the car's whole equity.
- Buy, a trade-in (with any cash down) worth more than the new car's price with tax: nothing is borrowed and the rest
  comes back as cash (`cashBack`, taken off what is paid), as the lease credits the whole equity (until 2026-10-31 the part
  past the price was dropped).
- Cost = paid − back; monthly = cost ÷ months. The cheapest is marked: keep, buy, lease in that order, a later one winning
  only when cheaper by more than $1. No discounting: the periods are the same length.
- Blank inputs take `DEFAULTS` (a new car: $35,000, 6% tax, 32 mpg, 7% over 60 months, $500 upkeep; a lease: $450 a month,
  $3,000 at signing, 36 months, 12,000 miles, $0.25 a mile over; upkeep rising 10%).

## Our guess in the rate box (smart guesses C9 second stage, 2026-11-14; spec 12.1 "K3 previews")
An empty **Car loan rate** box (under "The figures") shows our guess in gray, **7.2**, with "Our guess: the average bank rate
on a new-car loan." The comparison counts it while the box stays empty, on this page only, and says so where buying names the
loan: "$499 a month on $25,100 borrowed for 60 months at 7.2% (our guess)." (Riley's $12,000 car against the $35,000 new one).
An empty box saves `null`, never the figure, and no `plan.guesses` entry is made; opening the page writes nothing. Without
`params.previews` `compute` is exactly as before (module test, on six plans).

| box | estimator | formula and table |
|---|---|---|
| car loan rate | `property/vehicles:newRate` (this module's) | the Federal Reserve's average bank rate on a 72-month new-car loan, **7.17%**, to a tenth of a point (R11) **7.2%**: the figure the guesses module's `debt.car-loan.rate` gives a new car's loan on Debts. Table `auto_personal_rate_fed_g19`: Board of Governors of the Federal Reserve System, G.19 Consumer Credit, "Terms of Credit", release of 2026-10-07 (2026 Q3, August survey, preliminary), read 2026-11-02 |

Choices made here:
- **The bank rate, not Experian's 6.35%.** Experian's average new-car rate (Q2 2026, bundled) includes carmakers' promotional
  financing; the bank rate is the one Debts guesses for a new car, so the two pages agree.
- **The loan's length is not guessed.** Experian's average new-car term (69.46 months, `auto_loan_terms_experian_q2_2026`) is
  bundled, but the estimator contract (`core/estimate` `UNITS`) has no unit for a count of months (its whole numbers are an
  age and a year), and `core/estimate` is being changed by another batch now. The length stays the stated 60 months, said in
  its help; adding a "count" unit and a `property/vehicles:newTermMonths` estimator is a follow-up. So a 72-month loan's rate is
  counted on a 60-month loan (critic e9 F9): the bundled G.19 table holds only the 72-month new-car rate, so for a shorter loan
  the gray figure may lean high. Said here, not on screen (the first view has no words to spare).
- **No gray figure without a table**: the new car's price ($35,000), sales tax (6%), miles per gallon (32), cash down (none),
  the years compared (5) and the whole lease ($450 a month, $3,000 at signing, 36 months, 12,000 miles, $0.25 a mile over)
  open empty, each help saying what an empty box counts ("Left empty, we count $35,000."). A car's own details do the same
  (12,000 miles, $1,500 insurance, 28 mpg, $3.50 a gallon, $900 upkeep, $200 registration, 12% lost a year). Before, every
  box opened with these figures typed in and a save wrote them as the person's; an empty box now saves `null` and the year
  costs what it did (module test).
- **Folds**: the comparison's boxes are "The figures" (a part, `parts()`): five boxes first (years, price, rate, length, the
  lease payment; with two cars "Compare for" takes the lease payment's place), the rest under "More details (optional)";
  shut on a first visit (a list page: the cars are the answer) with "our guess" as its status while the rate is ours, and the new
  car's price beside it only once the person typed one (beside "our guess" the stated $35,000 would read as ours);
  open after "Compare" with the green line naming the cheapest
  way ("Saved. Cheapest over 5 years: keep it, $253 a month.", R7, R17). Each car's details open in place under an outlined
  "Change its details", a new car under an outlined "+ Add another car", both with the kit's `ui.openUnder`: the button stays
  above its form, Cancel or a second tap shuts it, and the focus goes back to the button (a button swapped for its form left
  Cancel nothing to go back to: the focus fell to the page and the screen jumped, seen on the walk); with no car the add form is open
  at five boxes (name, value, miles, insurance, its loan; R20). "More on this" is `links()`. No hand-written `<details>` remain.
- Without a guess (another currency, outside the U.S., or a shell without `ctx.guess`) the rate box is empty with "Left
  empty, we count 7% a year." and the page counts `DEFAULTS.compare.newRate` as before.

## Edge cases
- No vehicle account or entry: a hero and the add form. A car worth less than its loan: said, and paid off in the
  buy and lease cases.
- These are averages; real quotes and a used-car guide's value replace them.

## Tests
`module.test.mjs`: values new and used, a year by hand (and an electric car), not ready, keep/buy/lease by hand for the
family's sedan, a short period with a loan still owed, a car without an account. C9: the estimator's contract, table and gate
(another currency, outside the U.S.), invariance without previews, the preview only in an empty box, and the page drawn: the
gray figure, "(our guess)" outside any fold, opening writes nothing, "Compare" with the box empty saves no figure and no
guess (S11), a typed rate ends the gray figure, no guess for another country or without `ctx.guess`; a car's details open in
place, Cancel shuts them, a save of empty boxes writes `null` and costs the same; with no car the add form shows five boxes.

## Answer key
`tools/golden_property_goals` works 1,500 invented households with one or two cars (petrol and electric, with and without a
loan, blank what-if boxes at the page's defaults) from the brief and its sources, never from this code, by two exact
derivations that agree on every value; `tests/golden-property-goals.test.mjs` compares (rules: `tests/golden/property-goals/
RULES.md`). It found two errors here, both fixed on 2026-10-31: keeping the car left out what its loan still owes at the end
(buy and lease pay it off at the start), and the lease dropped a positive trade-in's equity (dearer by the car's whole
equity); a trade-in worth more than the new car's price now comes back as cash. Doubts left for the owner, not failed: keep's
upkeep rises while the new car's costs stay flat (it leans toward buying or leasing), the full new price is taxed (many
states tax the price less the trade-in), and an electric first car's new car is charged by the car's kWh whatever the new mpg
box says.

## Ideas / not yet
- Replace-when: the year upkeep plus lost value beats a newer car's cost.
- Gas against electric, with the federal and state credits: built, "Electric or gas for your miles" below.
- The car form has no "It is electric" tick: an electric car's own cost per mile (`electric`, `kwhPerMile`, `kwhPrice`) is counted when the plan holds it, but only a plan made elsewhere can say so today.

## Touch and input stress test (2026-11-11, claude-g)
- Number boxes take any whole number (loan and lease months, miles): "11,200 miles" was refused with "The two nearest valid values
  are..." (W6). A new car's value is required at the box (DP-2's page part).

## Electric or gas for your miles (gap list, next 60, item 56; map V9; 2026-11-15, claude-b)
A calculator one quiet tap away: what a gas car and an electric car each cost a year to run for the miles you drive, and how
many years the cheaper running cost takes to make up a higher price, with what credits remain. Information, not advice.

**What a person sees.** The first view is as it was, but for one more row in the parts card, under "The figures":
**"Electric or gas for your miles"** (a `part()` of kind `own`, its title pinned in `qa/first-view-lib.mjs`; no status until
something is typed, then "N set by you": no figure, so the first view keeps its count). Inside, top to bottom:
- the answer, one written sentence per case (below); after "Work it out" it is the green line "Saved. ..." instead (R7);
- two records: "A new gas car $1,813 a year" (gas $1,313, upkeep $500) and "A new electric car $1,112 a year" (charging $612,
  upkeep $500), then the basis (`evBasis`, one written sentence per case): "Both are new cars driven 12,000 miles a year, like
  yours." (the compared car's miles; "like your Family car", "like Bo's truck" for a car with a name of its own, `carPhrase`),
  then "They are not your own car's costs." when the new car of that car's kind costs $1 or more a year more or less in fuel
  or charging, or in upkeep, than that car's own figures above (`differs`), then "Boxes you leave empty use examples: type
  yours to replace them." while any price, efficiency or upkeep is an example; "Both are new cars driven 15,000 miles a year."
  for miles typed here. (The walk showed the answer read as fact while it rested on examples; critics then found the two cars
  read as the person's own car, whose card above shows other figures, and the first wording of this line said "card", a
  builder's word: s3 fix rounds 1 and 2.)
- the federal line: "Federal tax credits for electric cars ended for cars bought after September 30, 2025, and for home chargers
  put in after June 30, 2026, so none is counted.";
- the boxes, five first: How much more the electric car costs to buy; State credit or rebate; Miles a year; Gas price a gallon;
  Electricity price per kilowatt-hour (kWh). Under "More details (optional)": Gas car's miles per gallon; Electric car's
  kilowatt-hours (kWh) per 100 miles; Gas car's upkeep a year; Electric car's upkeep a year. Filled "Work it out" (the part's
  own Save; its label differs from The figures' "Compare", so the kit's "More details" memory keeps the two apart);
- "Counts fuel or charging and upkeep at today's prices, in today's dollars; insurance and the value each car loses are left
  out. Information, not advice."
Every box opens empty; its help says what an empty box counts. "Work it out" writes `whatIfs.vehicles.ev` only (each empty box
`null`), keeps the part open and moves no other part (test "S11 (R17): Work it out ..."). The Figures' "Compare" keeps `ev`.

**What an empty box counts** (`evOrGas(plan, d)`, `from[key]`): what was typed here, else the plan's own figure, else a
labelled example:
| box | the plan's own figure | else |
|---|---|---|
| miles a year | the compared car's miles ("the 11,000 miles you typed for your Sedan") | the 12,000 the page counts for it ("the 12,000 miles used for your car") |
| gas price | the compared car's fuel price, when it is not electric | $3.50, "an example: type what you pay" (`DEFAULTS.car.fuelPrice`) |
| electricity price | the compared car's kWh price, when it is electric | $0.17, an example (the figure `yearCost` counts for an electric car) |
| gas car's mpg | the new car's miles per gallon typed in The figures | 32, an example (`DEFAULTS.compare.newMpg`) |
| electric car's kWh per 100 miles | the compared car's kWh a mile x 100, when it is electric | 30, an example (`yearCost`'s 0.3 a mile) |
| each car's upkeep | - | $500 a year, an example (`DEFAULTS.compare.newMaintenanceYear`), the same for both |
| price difference | - | none: no payback until typed ("Type how much more it costs to buy ...") |
| state credit or rebate | - | none ($0); its help shows "for example $1,000" as an example of what to type, never counted |
None of the examples is a measured or sourced figure: each is the page's own figure, said as an example, and the person's own
figure replaces it. The electric car's upkeep example equals the gas car's: no source was read for a difference this session,
so the example favours neither (a person who knows theirs types it).

**Formulas** (`compute.js`, pure; `compute()` itself is unchanged):
- `running()`: gas energy = miles / mpg x gas price; charging = miles x kWh per 100 / 100 x electricity price; each car's year =
  energy + upkeep; saving = gas year - electric year.
- `payback()`: net = price difference - state credit (the federal credit is $0); `ev-back` when saving >= $1 and net > 0:
  years = net / saving; `ev-now` when net <= 0; `ev-ask` with no price; `gas` when saving <= -$1 and the electric car is no
  cheaper to buy (or no price); `gas-back` when it is cheaper to buy: the gas car makes that up in net / saving years (both
  negative); `same` when the two are within $1 a year.
- `yearsPhrase()`: "within a year" under 1; "in about 7.1 years" (one decimal under 10, whole from 10); "in more than 30 years"
  above 30 (`PAYBACK_MAX`).
- Riley (`qa/fixtures/renter-debt-plan.mjs`, nothing typed but the price): 12,000 / 32 x $3.50 = $1,312.50 + $500 = $1,812.50
  against 12,000 x 0.30 x $0.17 = $612 + $500 = $1,112; saving $700.50 a year; $5,000 more less a $1,000 state rebate = $4,000,
  4,000 / 700.50 = 5.71: "The electric car costs $701 a year less to run, so it makes up the $4,000 more it costs in about 5.7
  years."

**The sentences** (`evLine`, each read in full by a test): ev-back "The electric car costs $701 a year less to run, so it makes
up the $5,000 more it costs in about 7.1 years." / ev-now "... and no more to buy, so it is cheaper from the start." / ev-ask
"... Type how much more it costs to buy to see how long it takes to make that up." / gas "At these prices the gas car costs
$660 a year less to run, so an electric car that costs more to buy never makes that up." / gas-back "The electric car costs
$2,000 less to buy, and the gas car makes that up in about 3 years with its $660 a year lower running cost." / same "At these
prices both cost about $1,500 a year to run, so the one that costs less to buy costs less overall."

**The federal credits, read 2026-11-15** (`FEDERAL_EV`, `FEDERAL_LINE`):
- New: https://www.irs.gov/credits-deductions/credits-for-new-clean-vehicles-purchased-in-2023-or-after ("Page Last Reviewed or
  Updated: 13-Jul-2026"): "The New Clean Vehicle Credit is not available for vehicles acquired after Sept. 30, 2025." ... "You
  can demonstrate acquisition by entering into a binding written contract and making a payment on the vehicle on or before
  Sept. 30, 2025." (IRC 30D, as changed by the law the page calls the "Working Families Tax Cuts").
- Used: https://www.irs.gov/credits-deductions/used-clean-vehicle-credit (13-Jul-2026): "The Previously-Owned Clean Vehicle
  Credit is not available for vehicles acquired after Sept. 30, 2025." (IRC 25E).
- A home charger: https://www.irs.gov/credits-deductions/alternative-fuel-vehicle-refueling-property-credit (26-May-2026): "For
  property you buy and place in service at your main home from January 1, 2023, to June 30, 2026, the credit equals 30% of the
  cost of the property up to a maximum credit of $1,000 per item" (IRC 30C); so none for one put in after June 30, 2026.
- So for a car bought today no federal credit is counted, and the page says so in one line. A state credit or rebate is the
  person's own box (no state table was read). The words say "bought"; the IRS's "acquired" (a signed contract and a payment) is
  here, not on screen.

**Builder's choices.** Insurance, registration and the value each car loses are left out (said on screen): they differ by
model, not by fuel, and the page's own "Keep, buy or lease" counts them. The miles follow the car compared in The figures
("Compare for", with two cars). With no car on the page the row is not drawn (the empty page keeps its add form and its
count; the empty plan's first view is at 95 of 100 words). To keep the first view's words where they were (234 for Riley), three
existing sentences lost a few words: "a real cost though no bill comes" (was "even though"), "A new car's running costs at
today's prices" (was "..., upkeep too, ..."), "Replace it when repairs cost more than the value it loses" (was "start to cost
more than the value it is losing"). The parts on the first view rose from 1 to 2 (the new row; the budget is 5).

**Tests** (`module.test.mjs`): running costs and the payback by hand; the federal dates and line; every sentence and the three
year phrases; each box's fallback (typed, the car's own, the page's, The figures', an example) with its help line in full;
invariance (compute() byte-identical with `ev` typed, saved empty, or absent, over the four fixture plans, a plan with a car and
the 14 invented households); the page drawn: the row shut with no status, five boxes first, none required, empty boxes; S11:
"Work it out" saves `ev` only, the part stays open with the answer as its green line, "2 set by you", and Compare keeps `ev`. The
basis line in every case (the compared car named, for the household with two cars too; `differs` on and off; miles typed; no
example left once every box is typed, the miles per gallon included), and never the word "card".
