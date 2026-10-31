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
- Cost = paid − back; monthly = cost ÷ months. The cheapest is marked. No discounting: the periods are the same length.

## Edge cases
- No vehicle account or entry: a hero and the add form. A car worth less than its loan: said, and paid off in the
  buy and lease cases.
- These are averages; real quotes and a used-car guide's value replace them.

## Tests
`module.test.mjs`: values new and used, a year by hand (and an electric car), not ready, keep/buy/lease by hand for the
family's sedan, a short period with a loan still owed, a car without an account.

## Ideas / not yet
- Replace-when: the year upkeep plus lost value beats a newer car's cost.
- Gas against electric, with the federal and state credits.
