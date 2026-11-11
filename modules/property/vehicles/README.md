# Vehicles  (`property/vehicles`)

**Status:** usable, phase 7
**Purpose:** What each car really costs a year and per mile, and keeping it against buying new or leasing over the same years.

## Inputs
- `accounts[]` of type `vehicle` (value); `property[]` entries with `kind: "vehicle"`: `{ id, accountId?, name, value (without an account), milesYear, mpg, fuelPrice, electric?, kwhPerMile, kwhPrice, insuranceYear, maintenanceYear, registrationYear, loss, loanAccountId? }`.
- The loan named by `loanAccountId`, with its rate and payment (`balance/liabilities`).
- `whatIfs.vehicles = { car, years, newPrice, newSalesTax, newMpg, newRate, newTermMonths, newDown, newInsuranceShare, newMaintenanceYear, leaseMonthly, leaseDue, leaseMonths, leaseMiles, leaseExcess, upkeepRise }`.

## Outputs
`{ ready, cars: [{ id, accountId, name, value, details, loan, year: { lines, total, monthly, perMile } }], total, monthly, chosen, comparison: { years, tradeIn, loanLeft, newPayment, financed, options: [{ id, label, out, back, cost, monthly, endValue, owedAtEnd, terms }] }, inputs, best }`.

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

## Edge cases
- No vehicle account or entry: a hero and the add form. A car worth less than its loan: said, and paid off in the
  buy and lease cases.
- These are averages; real quotes and a used-car guide's value replace them.

## Tests
`module.test.mjs`: values new and used, a year by hand (and an electric car), not ready, keep/buy/lease by hand for the
family's sedan, a short period with a loan still owed, a car without an account.

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
