# Asset register  (`balance/assets`)

**Status:** usable (phase 10; built by claude-b from codex's idle lane)
**Purpose:** Lists your home, cars and belongings with what you paid, what each is worth now and which policy covers it.

Homes, cars and other assets are read from where they already live: the accounts on Net worth (`balance/net-worth`)
and the details on Home (`property/home`), Rental (`property/rental`) and Car costs (`property/vehicles`), which stay
where they are changed. Belongings (a home inventory for an insurance claim) are kept here, in the new optional
`belongings` section, and are not added to net worth: most belongings cannot be sold for anything like what they cost (a choice for this page,
noted here). Something worth counting can be added on Net worth as an "Other
asset", and it shows here under "Other things you counted".

## Inputs
Plan sections read (`needs`): `accounts` (types `property`, `vehicle`, `other_asset`), `property` (`purchasePrice`,
`purchaseDate`, `loss`, `kind`, `name`, `value` without an account), `insurance.policies` (kind, name, accountId),
`belongings`. Writes (`writes`): `belongings`.
Parameters accepted by `compute(plan, params)`: `today` (YYYY-MM-DD).

A belonging: `{ id, name, kind (KINDS), room, bought (YYYY-MM-DD or ""), paid, value (your figure or null), valuedAt,
life (years it lasts, null = keeps its value), policyId ("" = none), listed (named on the policy), details (make,
model, serial number), proof (where the receipt and photos are), updatedAt }`.

## Outputs
`compute(plan, { today })` -> `{ homes, cars, carPolicies, others, items, totals: { counted, homes, cars, others, paid,
worth, uncovered, uncoveredCount }, checks: [{ id, text, go }], policies, lastChanged, empty }`.
Also exported: `worthNow(item, today)`, `saveBelonging(draft, item, today)`, `removeBelonging(draft, id)`, `KINDS`,
`COVERS_THINGS`.

## Formulas
- **Counted in your net worth** = Σ the Real estate, Vehicle and Other asset account balances (`countedBalance`, the
  way Net worth counts them). A home or car on a property page with no account is listed with its own value but not
  counted.
- **A home's change** = value − what you paid; **a year** = (value ÷ paid)^(12 ÷ months owned) − 1 (`growthRate` from
  `property/home`, a compound yearly rate; none under 12 months).
- **A car loses a year** = value × its yearly loss: the car's own `loss`, else `property/vehicles`' default of 12% (a
  rough average named there).
- **A belonging's worth now** (`worthNow`):
  - your own figure (an appraisal, or what one sells for used) when you gave one;
  - else, when it has years it lasts and a day bought: paid × (1 − years owned ÷ years it lasts), never below 0
    (straight-line wear, the even share a year); years owned = days since bought ÷ 365.25; it loses paid ÷ years it
    lasts a year until it reaches 0;
  - else what you paid (it keeps its value, or there is no day to count from).
  This is a rough stand-in for "actual cash value", what a policy that takes off wear and age pays (NAIC, *A
  Consumer's Guide to Home Insurance*, https://content.naic.org/sites/default/files/publication-hoi-pp-consumer-homeowners.pdf;
  read 2026-10-31). Insurers use their own tables; the page says so.
- **Years it lasts**, the examples per kind: electronics 5, clothing 5, sports gear 8, appliances, furniture and tools
  10, instruments 15; jewelry, art, collectibles, silver and furs, guns and "something else" keep their value. Round
  examples chosen for this page, not from a source; the form fills them in and the person changes them.
- **Not covered** = Σ worth now of belongings with no policy picked.
- **The policy for a home**: one tied to the home's account (`accountId`), else paired one to one in order when the
  numbers of homes and home policies match, else the only home policy when there is one home: the same pairing as
  `insurance/property`. Belongings take a "home or renters" or "other" policy (`COVERS_THINGS`); a new one starts on
  the only such policy when there is one.

## Things worth a look
- A home with no policy; cars with no car policy (both link to Policies).
- Belongings with no policy picked (named when three or fewer).
- Jewelry, art, collectibles, silverware and furs, or guns on a policy but not listed by name: a standard home or
  renters policy pays only a small amount for these unless each is listed (an endorsement, floater or schedule).
  Triple-I, *Homeowners Insurance Handbook* (2023,
  https://www.iii.org/sites/default/files/docs/pdf/2023_triple-i_homeowners_insurance_handbook.pdf) names jewelry,
  silverware, collectibles and furs; NAIC, *My Insurance Doesn't Cover What?*
  (https://content.naic.org/article/consumer-insight-my-insurance-doesnt-cover-what) adds stamps, coins, guns and
  antiques; both read 2026-10-31. No dollar limit is shown: it differs by policy and the person's own policy says it.
- Belongings with no note of where the receipt or photos are: an insurer pays for what you can show you owned; an
  inventory lists brand, price, date, model, serial number and receipts, with photos (Triple-I, *How to create a home
  inventory*, https://www.iii.org/article/how-to-create-a-home-inventory, read 2026-10-31).

## Edge cases
- Nothing at all: a hero with "Add your first belonging" and a link to Net worth for a home or car; no zero totals.
- The add form is open while the list is empty; with belongings it folds behind "+ Add another belonging".
- A future day bought, or a price below zero: refused with a notice. A day in the future never counts as an age.
- An unknown kind is saved as "Something else"; years it lasts of 0 or blank mean it keeps its value.
- A figure of your own is dated the day you typed it (kept when you change something else).
- A policy that was removed: the belonging shows "No policy picked".
- No home or renters policy on file: the policy list says so, and the check links to Policies.

## Tests
`module.test.mjs` (6): worth now (the straight line to the day, past its years, your figure, keeps its value, no day,
a future day, nothing, a zero figure); homes (change, yearly rate, the policy by account and by pairing, a rental with
no account not counted); cars (own loss and the 12% default, car policies); belongings (order, flags, totals, checks,
named checks, the policy list, listing clears the flag); checks for uninsured homes and cars and the empty plan;
saving and removing (cleaning, replacing by id, dates, the kinds).

## Ideas / not yet
- A photo per belonging (needs file storage on the PC server, not the plan).
- Print the inventory as a single sheet for the insurer.
- Compare the belongings' total with a renters policy's contents cover.
