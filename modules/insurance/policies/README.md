# Policies  (`insurance/policies`)

**Status:** usable (phase 8)
**Purpose:** Every insurance policy you hold on one list: what it pays, what it costs a year, whom it covers, when it ends or renews, and what deserves a second look.

## Inputs
`household.people` (names; who depends on whom), `insurance.policies`. Writes `insurance.policies`.

## Outputs
`compute(plan, { today })` -> `{ items[], count, premiumYearly, premiumMonthly, byPerson[], byGroup[], warnings[] }`.
- `items[]`: the policy plus `kindLabel, icon, group, benefitLabel, personName, premiumYearly, periodLabel, ended, endsSoon, renewsSoon, flags[]`.
- `byPerson[]` (adults only): `{ personId, name, life, disabilityMonthly, ltcMonthly }` from the policies still in force.
- `byGroup[]`: `{ group, label, count, premiumYearly }` for the groups that have a policy in force.

Read by the other insurance pages (life needs, disability, long-term care, property) and by the stress tests.

## Formulas
- Premium a year = premium x payments a year for its period (`core/math/periods.js`: weekly 52, every two weeks 26, twice a month 24, monthly 12, quarterly 4, annual 1).
- Premiums a year (total) = the sum over policies that have not ended; a month = that / 12.
- Ended = an end date before today. An ended policy stays on the list (faded) with a warning until it is removed or replaced.
- Life cover per person = the death benefits of that person's term and whole/universal policies still in force. Disability and care are the monthly benefits.

## Flags
| flag | when |
|---|---|
| through work: it ends if the job does | a life or disability policy marked "through an employer" |
| ends YYYY: is anyone still depending on it then? | a term policy with an end date ahead, in a household with a dependant or a partner |
| renews in N days: a good moment to compare prices | a renewal date within `SOON_DAYS` (60) |
| no ... entered | no benefit amount |

## Edge cases
- A policy with no person belongs to the household ("Household") and counts in no one's cover.
- An unknown kind is treated as "Other".
- Cash value is kept only for whole or universal life.

## Tests
`module.test.mjs`: every kind has a group; an empty plan; premiums a year per period and the ended policy left out; cover per person; the four flags; the 60-day window edge and a single person's term.

## Ideas / not yet
- Read a declarations page (PDF or photo) with the AI and fill the form (the user clicks apply).
- Beneficiaries per policy (estate/beneficiaries will hold them).
