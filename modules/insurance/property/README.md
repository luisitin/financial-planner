# Auto, home, umbrella  (`insurance/property`)

**Status:** usable (phase 8)
**Purpose:** Whether the home, car and umbrella cover is enough for what you own: the home insured for the cost to rebuild, the liability limits against the net worth a lawsuit could reach, an umbrella when it makes sense, and the deductibles against the cash.

## Inputs
`accounts` (net worth, retirement accounts, homes: type `property`, cars: type `vehicle` or a loan named for a car), `insurance.policies` (kinds `home`, `auto`, `umbrella`). Writes three optional fields on a home policy (`rebuildCost`, `liability`, `deductible`) and `deductible` on an auto policy. A home policy may carry `accountId` to pair it with a home when there are several.

## Outputs
`compute(plan, { today })` -> `{ netWorth, exposed, shielded, ownsHome, homes[], auto, homeLiability, homeLiabilityKnown, umbrella, inCar, atHome, suggestedUmbrella, umbrellaCost, deductibles, checks[], hasAny }`; each check `{ id, ok: true|false|null, title, text, go }`.

## Formulas
- Shielded = 401(k) balances (ERISA plans are out of creditors' reach) + min(IRA and Roth balances, `IRA_LIMIT` $1,711,975: the bankruptcy cap for IRAs, 11 U.S.C. 522(n), adjusted April 1, 2025). Exposed = max(0, net worth - shielded). Homestead exemptions (state law) are not counted.
- Home: dwelling cover / rebuild cost; "ok" from 100%, "low" from `COINSURANCE` 80% (the coinsurance clause: below it most policies also cut partial-loss payments), "under" below. Without a rebuild cost the page explains that the sale price includes land.
- Car: liability per accident (the policy's benefit) against `AUTO_MIN` $300,000 (the common 100/300/100 advice).
- Liability: in a car accident = car limit + umbrella; at home = home liability (`HOME_LIABILITY_DEFAULT` $100,000 when not entered) + umbrella. Protected when the weaker of the two >= exposed.
- Umbrella suggested when there is none and exposed > the higher underlying limit: rounded up to `UMBRELLA_STEP` $1,000,000; cost (`umbrellaCost`) $150 to $300 a year for the first million, about $75 more for the second and $50 for each one after (Insurance Information Institute, "Liability and safety tips for dog owners", read 2026-10-31). An umbrella on file is checked against what insurers usually require underneath (`UMBRELLA_UNDER`: $500,000 per accident on cars, $300,000 on the home).
- Deductibles: the sum of the home and car deductibles entered against usable cash (Emergency fund's "now"); with three times that in cash, a higher deductible is suggested.

## Edge cases
- No home and no home policy: renters insurance is suggested.
- Several homes: paired with home policies by `accountId`, else one to one when the counts match.
- A car is recognised from a `vehicle` account or a loan whose name mentions a car.

## Tests
`module.test.mjs`: an empty plan, the shielded and exposed amounts (with the IRA cap), the family's checks, the rebuild statuses, the umbrella suggestion and its price, the car checks, the deductibles.

## Ideas / not yet
- State minimum car limits and uninsured-motorist cover; flood and earthquake (not in standard home policies).
- Homestead exemptions by state; renters' contents value against the belongings.

## One figure per phrase, and a rented-out home (round 8 batch 6, landlord-7, 2026-11-06)
- **"A lawsuit could reach"** is only `exposed` (net worth less retirement accounts). What the policies leave over is
  `uncovered` = max(0, exposed − `liabilityCover`), `liabilityCover` being the weaker of the car and home cover. The tile
  reads "Not covered by your policies: $218,000 — of the $318,000 a lawsuit could reach (what you own outside retirement
  accounts), after $100,000 of liability cover"; the check reads "$218,000 of what you own is not
  covered". The landlord: net worth 618,000 − 401(k)s 300,000 = 318,000; home liability 100,000 (assumed, none entered) <
  car 250,000; 318,000 − 100,000 = 218,000. The tester's unsourced "commonest lawsuit" is left out.
- **The rental check** (`rented[]`, a check `rental-<id>` per rental on Rental analysis): its policy is the one paired with
  its Net worth account (or the account of its name), else a home or landlord policy whose name names it. Landlord kind:
  fine; homeowners kind: "Condo is rented out: it needs a landlord policy" (set its kind if it already is one); none: "has no
  policy on file". Source: Triple-I, "Coverage for renting out your home" (read 2026-11-06): a lease of "six months or a
  year, you will likely need a landlord or rental dwelling policy"; it covers "physical damage to the structure", "includes
  liability coverage" and most "provide coverage for loss of rental income". With an umbrella on file: "Tell your umbrella
  insurer about Condo too: an umbrella pays only after a policy under it has paid" (Triple-I, "Should I purchase an
  umbrella liability policy?", read 2026-11-06: a "personal umbrella policy goes into effect after the underlying policy
  coverage is exhausted"; it lists "renting out a property you own" among the reasons for one). That the umbrella "must
  list" the rental was not found in a primary source, so the page asks the person to tell the insurer instead.
- Landlord policies count with home policies (dwelling cover, liability, deductibles, the Policy terms fold).
- Pairing: `insurance/policies` `pairHomes` (a lone home still takes the first of several policies, as before).
- Tests: "batch 6" in `module.test.mjs`.

## Review fixes (round 8 batch 6, 2026-11-06)
- A rented-out home's policy is What you own's (balance/assets `homes`: the same rows and the same `pairHomes`), so the two
  pages cannot disagree (money 6: the condo only on Rental analysis, insured by "Acme rental dwelling" there, had "no policy on
  file" here). The accounts' own pairing passes `rental` for a home rented out, so a landlord policy goes with it before list
  order.
- The home side of the liability check (money 8): a home or landlord policy's liability cover is for its own home, so the
  weakest of the landlord policies counts, against the homeowners policies' highest (as before this batch for homeowners
  policies alone): home 100,000 and the condo's landlord 1,000,000 gives 100,000, so $218,000 of $318,000 is not covered.
- The tile (money 7): "(your net worth outside retirement accounts)"; "what you own outside retirement accounts" is $718,000
  on the landlord plan, not the $318,000 it labelled.
- A rented-out condo (association dues above 0, UX 8): the master policy "generally" covers "the exterior/structure of
  buildings", and a unit owner's policy "may only cover the interior of the unit and its contents" (Maryland Insurance
  Administration, Condominium insurance FAQs, insurance.maryland.gov/Consumer/Pages/condo/faqs.aspx, read 2026-11-06). Its
  landlord check says the building is usually on the association's policy, and its home check, with no rebuild cost entered,
  asks what the policy covers inside the unit instead of the cost to rebuild the building. The landlord policy's terms say
  "liability: if someone is hurt there and sues" (not "coverage E").
- The umbrella checks name the rentals' landlord policies among those underneath it (UX 12).
- "Go there" on a rental insured by a homeowners policy opens that policy's form (`query: { edit }`, UX 11).
- Tests: "batch 6 review" in `module.test.mjs`.
