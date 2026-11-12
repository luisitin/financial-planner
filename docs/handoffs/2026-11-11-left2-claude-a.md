# Left over each month (left2): what is left in claude-a's pages (claude-c -> claude-a, 2026-11-11)

The left2 lane (follow-up lane 3) makes the money left over each month one answer on every page, and counts a rental in the
month after its running costs. These items are in your folders, so they are left for you. Line numbers were checked on
2026-11-11 on the shared branch with the lane applied; your files were not edited.

## What changed that your pages read

- `modules/overview/next-best-action/compute.js`: `spare.rentCosts` is a rental's running costs a month (Rental analysis:
  the rent less what Income counts after costs; $1,163.33 a month on `qa/fixtures/round8-rental.mjs`; fix round 1,
  2026-11-12: a rental with no rent typed still has its costs here, B-6), already taken out of `spare.monthly`. Fix round 1
  adds `spare.rentLoan`: a rental's loan payment typed only on Rental analysis (not a Debts payment, so not in the spending),
  $851 a month on `condoOnlyRentalPlan`, also already out of `spare.monthly` (M-3/B-4: both ways of entering the condo now
  leave one leftover, $3,712.04). `spare.year` (core/math/leftover.js `yearSaving`) is what the month builds up in a year,
  with `cash` the part that stays in checking and savings. `spare.fromLeft` is set while the leftover the person typed on
  Get started or Expenses drives the bills (core/math/leftover.js `leftMarker`).
- `modules/cashflow/budget-percent/compute.js`: `yearTaxes().rentCosts`, `yearTaxes().rentLoan` and (fix round 2)
  `yearTaxes().rentOwn` (also `spare.rentOwn` on Next best action: rent of a rental no Income line holds, in the gross), lines in Each month's
  money ("Rental running costs (Rental analysis)", "Rental loan payment (Rental analysis)").

## Page by page

1. **balance/projection** (`modules/balance/projection/compute.js`, which imports no Next best action today): add
   `spare.year.cash` (when above 0) to cash each year, or say plainly on the page that the money left over each month is not
   counted. Use the leftover after rental running costs (`spare.rentCosts` is already out of `spare.monthly`), so the
   landlord plan is not $1,163 a month richer here than on the other pages.
2. **goals/emergency-fund** (`modules/goals/emergency-fund/compute.js:44-47`): `monthly` is the emergency goal's own monthly
   amount, else 0, so `monthsToGo` is null ("not known") whenever no goal amount is set. When there is no goal amount, use
   `spare.year.cash / 12` for "full in about N months", and do not wait while `spare.fromLeft` is set (the leftover was typed
   by the person; it is theirs, not our guess).
3. **cashflow/statement** (`modules/cashflow/statement/compute.js:71-80`, `opLines`): CORRECTION (fix round 1, 2026-11-12,
   M-2). The first version of this handoff said Statement already shows the rental running costs. It does not: there is no
   `rentCosts`, `rentLoan` or `careLost` in the file, so on `condoOnNetWorthPlan` Statement nets $4,875.38 a month while Next
   best action, budget-percent, Your plan and FIRE all show $3,712.04 (the $1,163.33 of running costs). Add three lines after
   "Uneven pay not counted on" (line 79), each only above half a dollar, so `year.net` equals `spare.monthly * 12`:
   `(s.rentCosts ?? 0) > 0 ? { label: "Rental running costs (Rental analysis)", amount: -s.rentCosts * 12 } : null`,
   `(s.rentLoan ?? 0) > 0 ? { label: "Rental loan payment (Rental analysis)", amount: -s.rentLoan * 12 } : null`,
   `(s.careLost ?? 0) > 0 ? { label: "Child care account money it would lose", amount: -s.careLost * 12 } : null`
   (the labels are Next best action's `monthLines`, so the two pages read alike). Fix round 2 (2026-11-12, N-1) adds
   `spare.rentOwn`: the rent of a rental typed only on Rental analysis (no Income rent line holds it), a month before its empty
   months; it is inside `spare.gross` and its empty months and costs inside `spare.rentCosts`. Statement's income lines come
   from `inc.byType`, which does not hold it, so add at the top of `opLines` (after the `inc.byType` lines):
   `(s.rentOwn ?? 0) > 0 ? { label: "Rent (Rental analysis)", amount: s.rentOwn * 12 } : null`.
   A test: on both round8-rental fixtures, and on each with its Income rent line removed, `statement.year.net` within $1 of
   `nextBest.spare.monthly * 12` (all four are $3,712.04 a month).
   Reports > Financial statements (`modules/reports/statements`, not yours) prints the same four lines since left2 fix round 3
   (2026-11-12, NEW-1), so the two statements read alike once this lands.
4. **property/rental** (yours from claude-b's idle lane, WORKBOARD claims; the rule is shared with taxes/federal `known.js`
   `rentalStep` / `withoutIncomeRent`): pre-existing on the shared branch, not changed by this lane. With no rent typed on
   Rental analysis, `running.js matchRent` (line 106) cannot tell which Income rent line is that place's, so the Income rent is
   taxed as ordinary income and the place's whole cost (25,487 a year on `condoOnNetWorthPlan` with `property[0].rentMonthly =
   null`) is a passive loss that waits at that income (IRC 469(i): modified AGI 179,600). Federal tax is 19,652 against 14,108
   with the rent typed, about $5,544 a year too high. Suggested change: in `rentalsOf` (running.js line 19) and `rentalsFor`
   (compute.js line 123), when exactly one rental has a blank `rentMonthly` (null or empty, not 0) and exactly one going Income
   rent line (`type: "rental"`, not `once`, not ended) is left unmatched by the other rentals (`matchRent(...).left` > 0), read
   that line's monthly amount as the rental's rent, and say on Rental analysis "Rent: $2,100 a month, from your Income page
   (type it here if it is different)". Or, simpler, ask for the rent on Rental analysis and Income whenever this case occurs.
   Test: that plan's Federal estimate 14,108 +/- 1 and Next best action `spare.monthly` 3,712.04 (now 3,355.04; the pinned
   figure in tests/left2-fix1.test.mjs "L-N2" then moves with it, say so in the commit).

No other page of yours (taxes/state, taxes/filing-status, debt/*, goals/vehicle and the rest) is changed by this lane.
