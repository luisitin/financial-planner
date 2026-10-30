# Life timeline  (`overview/timeline`)

**Status:** usable (phase 9)
**Purpose:** Every moment from today to the end of your plan that changes your money: retiring, Social Security, Medicare, the last mortgage payment, children growing up, and whether the savings last.

## Inputs
Reads (through the other pages' computes, so every date matches theirs): `household` (birth dates, roles, retirement and plan-end ages), `accounts` (which kinds each adult owns), `retirement` (contributions, Social Security, spending), `debts` + `debtPlan` (payoff order), `goals`, `income`, `expenses`, `assumptions`. Writes nothing. The topic chip is a per-device view choice, not saved.

## Outputs
`compute(plan, { today })` -> `{ ready, missing, notes, startYear, endYear, people, events, years, savings, headline, counts }`.
- `events[]`: `{ id, date | null, year, kind, topic, icon, title, detail, tone, personId, go }`, sorted by date (a year-only moment sorts on January 1), from today on.
- `years[]`: the years with something in them, each with everyone's age that year, its events, its era (`work` before the household's retirement year, `retired` from it) and `gapBefore` (quiet years since the last one shown).
- `savings[]`: the projection's savings by year in today's dollars (`retirement/projection` `buildInputs` + the engine).
- `headline`: `retireYear`, `retireIn`, `debtFreeYear`, `lastsTo` or `shortYear`, `fiYear`, `endYear`.

## The moments and their sources
| moment | when | source |
|---|---|---|
| Retires | the person's retirement age birthday; before 65 it names the years until Medicare | People page |
| Can save more for retirement | 50, while working, with retirement saving or accounts: the 401(k) and IRA catch-up from `retirement/contributions/data/limits.js` | IRS notices (in that file) |
| Four bigger catch-up years | 60, while working, with a 401(k): the 60-63 catch-up | SECURE 2.0 §109, same file |
| HSA limit rises | 55, while working, with an HSA | Rev. Proc. in that file |
| Draw on retirement accounts freely | 59½ (the 59th birthday plus six months), with an IRA, 401(k) or Roth | IRC §72(t) |
| Social Security starts | the claiming age on the Social Security page (birth date plus the claiming age in months), with the amount in today's dollars; with no estimate, 62 flagged as missing | `retirement/social-security` |
| Medicare | 65th birthday; sign up in the three months before | Medicare initial enrollment period |
| Required withdrawals begin | `rmdStartYear` (70½ / 72 / 73 / 75 by birth date), with the projection's first-year amount for that person in today's dollars | `core/math/rmd.js`, Pub. 590-B |
| The plan runs to ... | each adult's plan-end birthday | People page |
| Child turns 17 / 18 / 26 | child tax credit stops (under 17), adulthood, the last year on a parent's health plan | IRC §24; ACA dependent coverage to 26 |
| Debt paid off, mortgage paid off, debt-free | the payoff plan's dates in the order the Pay off debts page chose; debt-free with the last one (only when there are two or more) | `debt/payoff` |
| Goals | each open goal's target date, amount then, behind or on track | `goals/goals` |
| Financially independent | the FI year when it falls before retirement | `retirement/fire` |
| Savings pass $X | the first year the projection's real savings pass 100k, 250k, 500k, 1M, 2M, 5M, 10M, counting only those above today's level | projection rows |
| Savings peak | the highest year, when it is neither the first nor the last | projection rows |
| The money lasts / runs out | at the last plan-end birthday with what is left, or the failure year in red | projection |

## Edge cases
No adult with a birth date, or no `today`: not ready, says what is missing. No accounts or spending: the people moments still show; a note says what unlocks the money moments. Already retired, on Medicare, claiming: those moments are in the past and left out. Debts without a rate or payment: named in a note. One debt: no separate "debt-free". A person's accounts are theirs by `ownerId`; an account with no owner belongs to the first person (as everywhere in the retirement pages).

## Tests
`module.test.mjs` on `qa/fixtures/family-plan.mjs` (Ana, Bo and Cy, made whole for Phase 9) and `retirement-plan.mjs`: every dated moment, the order of debts and goals, sorting, quiet years and ages, milestones, independence, a plan that runs short, people already retired, a plan with no savings.

## Ideas / not yet
- A pension's start (once `retirement/pensions` exists), the partner's survivor years (Social Security's `couple.survivorMonthly`), long-term-care odds by age, estate-document reviews.
- Drag along the line to see the balance sheet in that year.
