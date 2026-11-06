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
| Can save more for retirement | 50, while working, with retirement saving or accounts: the 401(k) and IRA catch-up from `retirement/contributions/data/limits.js` (through `limitsFor`) | IRS notices (in that file) |
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
| Financially independent | the first year the projected savings (the chart's own path, `totalReal`) reach the independence number (yearly spending / withdrawal rate, `retirement/fire` `fiNumber`), when that is before retirement; none when they never do, or when today's savings already pass it (2026-11-01: it took the FIRE page's year, a path that invests every spare dollar, and showed "$2.1 million at 50" beside a chart that peaks at $1.4 million). The line says "On this plan's path (what goes into savings now)" and opens Will the money last?, the projection it is read from, not the FIRE page, whose own year assumes every spare dollar is invested | `retirement/fire` (the number), the projection |
| Savings pass $X | the first year the projection's real savings pass 100k, 250k, 500k, 1M, 2M, 5M, 10M, counting only those above today's level | projection rows |
| Savings peak | the highest year, when it is neither the first nor the last | projection rows |
| The money lasts / runs out | at the last plan-end birthday with what is left, or the failure year in red | projection |

## Edge cases
No adult with a birth date, or no `today`: not ready, says what is missing. No accounts or spending: the people moments still show; a note says what unlocks the money moments. Already retired, on Medicare, claiming: those moments are in the past and left out. Debts without a rate or payment: named in a note. One debt: no separate "debt-free". A person's accounts are theirs by `ownerId`; an account with no owner belongs to the first person (as everywhere in the retirement pages).

Before Social Security is known (`retirementKnown`, 2026-11-02): no red "The savings run out" and no "The money lasts";
one neutral end event, "Whether the money lasts: not worked out yet", links to Social Security.

## Tests
`module.test.mjs` on `qa/fixtures/family-plan.mjs` (Ana, Bo and Cy, made whole for Phase 9) and `retirement-plan.mjs`: every dated moment, the order of debts and goals, sorting, quiet years and ages, milestones, independence, a plan that runs short, people already retired, a plan with no savings.

## Review fixes 2026-11-02
The top box says neither "Savings run out" nor "The money lasts" until Social Security and birth dates are in (`headline.needsSS`, `headline.needs`); it shows "Will it last? Not yet known: needs ...". The needs-ss event names what is missing (setup's `retirementGap`) and links to People for a birth date.
A goal waiting its turn on Next best action (alerts' `goalsBehind`: nothing going in, dated after the goals step starts)
reads "Saving for it starts in <Month YYYY>, when its turn comes on Next best action" with no amber, as on Goals and the
Dashboard (the subject is the saving, so "Cy's college ... starts in September 2027" is not read as college starting then).

## Both payoff dates (round 4, 2026-11-02)
A debt event dated by the payoff plan sooner than its own payment (debt/payoff `twoDates`) adds: "This date has the Visa card and Car loan payments moving onto it once they are paid off; on its own payment it runs to January 2046."

## Review 2026-11-02 (round 5): no start for a benefit already paid
Someone the Social Security page counts as already getting it (`claimed`: setup's "I already get it", or a Social
Security line on Income being paid now) has no `social-<id>` event. A claim date already gone was dropped anyway; the
case that slipped through was a benefit paid before the claim age on file (`startedEarly`, a disability benefit at 55
read "starts in 2038, claimed at 67: at full retirement age"). Nor does a benefit paid and typed only on Income get "can
claim at 62: there is no estimate in the plan yet".

## Review 2026-11-02 (round 5, third pass): never "about $0 a month is needed"
A goal that is behind says its monthly need with `needWords`: to the nearest $100 from $95 up ("about $1,200"), to the
nearest $10 below that ("about $50"), and "under $10" below $5. Before, every amount was rounded to $100, so the Boat
(about $49 to $58 a month) read "Behind: about $0 a month is needed." on the family plan. Tested on the words and on the
family plan with a $36,000 Wedding and a $6,000 Boat.

## Ideas / not yet
- A pension's start (once `retirement/pensions` exists), the partner's survivor years (Social Security's `couple.survivorMonthly`), long-term-care odds by age, estate-document reviews.
- Drag along the line to see the balance sheet in that year.

## Review 2026-11-06
- **A spouse's benefit starts (fix round 6).** When the Social Security page counts a spouse's top-up on the partner's
  record (`couple.spousalCounted`, the projection's "<name>'s spouse's benefit" line), the Timeline has "Sam's spouse's
  benefit starts": "About $150 a month more in today's dollars, on Ruth's record, once both have claimed. It is paid with
  Sam's own Social Security and rises with inflation every year after." Its date is the birth date plus
  `couple.spousalStartAge` (the later of their own claim age and their age at the partner's claim, never before 62; the
  age the top-up is reduced for, SSA Handbook 724 and oact/quickcalc/spouse.html), so its year is the projection's
  (`spousalFromAge`). Ruth 2,100 and Sam 900, both at 67: 150 from 2031-09-20; Sam at 64: 150 x 0.75 = 112.50 from
  2028-09-20 (36 months early at 25/36 of 1%); Sam at 62 and Ruth at 70: from Ruth's claim, 2030-08-20. No event for a
  partner who is not a spouse, or a top-up that already started. Across all plans only the three Social Security
  verifier plans gain it (no qa household has a Social Security figure). Test: "a spouse's benefit on the partner's
  record is a Timeline event".
- **Not before the claim it waits for (verifier, fix round 6).** The spouse's benefit is dated at the later of the month it
  starts (on the spouse's day of the month) and the partner's own claim day, and on the same day it is listed after the
  partner's "Social Security starts": Sam, already paid, read "Sam's spouse's benefit starts" on August 10, 2027 above
  "Ruth's Social Security starts" on August 15 ("once both have claimed"). Now both are August 15, Ruth's first. The month,
  the amount and the year are unchanged. Test: the same, "a spouse's benefit on the partner's record".

Review 2026-11-06 (round 7): the person events ("You retire", "You join Medicare", "Your Social Security starts", "Your required withdrawals begin", "The plan runs until you are 95", "Your benefit as a spouse starts", "on your record"), the savings running out ("when you would be 83") and independence ("(at 45)") say you/your for the unnamed first adult ("Me") and "your spouse" for the unnamed partner; typed names read as before (core/words.js). The ages row above each year ("Me 36 · Cy 6") is a label and stays. Test: "Review 2026-11-06 (round 7): the unnamed first adult ..."

Round 8 (2026-11-06, item 3): Next best action's goals step now comes right after costly debt, so on the family plan its turn is December 2026 (was December 2027). The tests follow: the Japan trip (due October 2027) waits that turn ("Saving for it starts in December 2026"), the trip that must stay behind is dated December 20, 2026, and the wedding that holds the step is $150,000 (a $36,000 one fits now). No change to this page's compute.
