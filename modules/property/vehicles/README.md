# Vehicles  (`property/vehicles`)

**Status:** usable, phase 7
**Purpose:** What each car really costs a year and per mile, and keeping it against buying new or leasing over the same years.

## Inputs
- `accounts[]` of type `vehicle` (value); `property[]` entries with `kind: "vehicle"`: `{ id, accountId?, name, value (without an account), milesYear, mpg, fuelPrice, electric?, kwhPerMile, kwhPrice, insuranceYear, maintenanceYear, registrationYear, loss, loanAccountId? }`.
- The loan named by `loanAccountId`, with its rate and payment (`balance/liabilities`).
- `whatIfs.vehicles = { car, years, newPrice, newSalesTax, newMpg, newRate, newTermMonths, newDown, newInsuranceShare, newMaintenanceYear, leaseMonthly, leaseDue, leaseMonths, leaseMiles, leaseExcess, upkeepRise }`.

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
- Gas against electric, with the federal and state credits.

## Touch and input stress test (2026-11-11, claude-g)
- Number boxes take any whole number (loan and lease months, miles): "11,200 miles" was refused with "The two nearest valid values
  are..." (W6). A new car's value is required at the box (DP-2's page part).
