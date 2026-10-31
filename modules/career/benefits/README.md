# Benefits elections  (`career/benefits`)

**Status:** usable, phase 10
**Purpose:** Helps you choose at open enrollment: your 401k percentage, health savings account, employer stock plan and insurance picks.

## Inputs
- Whose benefits (`whatIfs.benefits.personId` when that adult has pay, else the "self" adult with a salary, else the
  first with one); their active salaries and bonuses (`income[]`; pay = salary + bonus unless typed), the paycheck
  count from the first salary's period (weekly 52, every two weeks 26, twice a month 24, monthly 12; a yearly or
  quarterly figure assumes 26 and says so) unless typed.
- **The plan year**: the year the choices are for, next year from October (open enrollment), else this year, or as
  chosen. Its limits are used, or the latest year in the tables with a note; ages are the ones reached in it.
- Their 401(k) contributions (`retirement.contributions[]` into accounts of type `401k`) and employer match.
- `taxes.hsa` (coverage, contribution, employer money, health FSA) as the starting HSA and FSA figures.
- The household's federal tax (`taxes/federal` `taxInputs`), the state's rate (`taxes/state`), the wage base.
- `whatIfs.benefits[personId] = { matchTiers: [{ rate, upTo }], paychecks, planYear, pay?, hsaEligible, hsaCoverage, hsaEmployer,
  hsaElect, fsaElect, dcfsaElect, transitMonthly, parkingMonthly, esppOffered, esppPct, esppDiscount, esppLookback,
  lifeCover, lifePaid }`.
- Writes `whatIfs.benefits`; "Use X%" sets the person's 401(k) contributions (each keeps its share of the total, in
  its own period) and, once the employer's match is typed here, their employer match (an assumed match never
  overwrites the Contributions page's); "Use these on the HSA page" sets `taxes.hsa` coverage, contribution,
  employer and FSA.

## Outputs
`compute(plan, { today })` -> `{ ready, year, person, pay, paychecks, settings, notes, k401, hsa, fsa, dependentCare, commuter, espp, life, total }`
(shapes in the `compute` comment).

## Formulas
- **The match** (`matchAt`): tiers `[{ rate, upTo }]`, each `upTo` the top of its band as a share of pay; match share
  = Σ rate × (min(put in, upTo) − the band's start). In dollars (`matchDollars`) it is figured on pay counted only up
  to the compensation limit ($360,000 in 2026, IRC 401(a)(17), Notice 2025-67) and on what you put in up to the
  deferral limit. The whole match is at the highest `upTo` with a rate (`fullMatchAt`; none when every tier is 0).
  Left behind = match at the whole match − match now. Until the employer's own match is typed, the page assumes 50
  cents a dollar on the first 6% of pay, the most common formula in Vanguard's *How America Saves 2026* (2025 plan
  data; average promised match 4.7% of pay), and says it is an assumption.
- **The 401(k) limit** (`limit401k`) for the age reached this year: $24,500 in 2026; + $8,000 catch-up from 50; or
  $11,250 instead from 60 to 63 (IRS Notice 2025-67; `retirement/contributions/data/limits.js`). Choices shown: now,
  the whole match, the limit (as a share of pay, capped at 100%).
- **What a choice costs**: put in = min(limit, share × pay); the tax it saves (`taxSaved`, `fica` false) = the
  household's federal tax at wages before any 401(k) saving, less at wages lowered by the amount, + the state's rate
  × the amount; pre-tax 401(k) money still pays Social Security and Medicare (IRC 3121(v)(1)(A)). Cost = put in −
  saved; a paycheck = ÷ paychecks. The federal part leaves out the 0.9% extra Medicare tax (a 401(k) does not lower
  Medicare wages). Pennsylvania taxes 401(k) deferrals (`K401_TAXED_STATES`; PA Department of Revenue, Personal
  Income Tax Guide, Compensation): no state saving there.
- **Roth catch-up**: from 2026, someone 50 or older paid over $150,000 by the employer the year before (2026 line,
  Notice 2025-67; IRC 414(v)(7), SECURE 2.0 §603) makes catch-ups as Roth; the final regulations apply from 2027 and
  plans follow the law in good faith in 2026 (IRS IR-2025-91). Not before 2026: Notice 2023-62 gave plans an
  administrative transition through 2025 (`ROTH_CATCHUP_FROM`), so a 2025 plan year puts all of it in pre-tax. The page
  uses this year's pay as the guide, and the catch-up part of a choice saves no tax now.
- **Health savings account** (shown when the plan qualifies): limit = $4,400 self-only / $8,750 family in 2026 (Rev.
  Proc. 2025-19), $4,500 / $9,000 in 2027 (Rev. Proc. 2026-24 §3.01(1), posted 2026-05-29, read 2026-10-31), + $1,000
  from 55, which is in the law and not indexed (IRC 223(b)(3)); room = limit − employer money; the election is capped
  at the room. The IRS puts out the HSA limits in the spring and the others in October and November, so in open
  enrollment the next year's HSA limit can be known before the 401(k)'s: `HSA_AHEAD` in `data/benefits.js` holds it
  until `retirement/contributions/data/limits.js` (not this page's file) has the year, and the page's note says which
  limits are the next year's. "Use these on the HSA page" saves next year's choice on a page that shows this year, so
  the page says that page checks it against this year's limits until January. From 2026 bronze and
  catastrophic marketplace plans qualify (P.L. 119-21; IRS Notice 2026-5). Tax saved through payroll = federal (the
  household's tax with the HSA page's figure taken back out, then the election off wages) + 7.65% payroll tax (6.2% only
  under the wage base) + the state's rate, except California and New Jersey, which tax HSA money (`HSA_TAXED_STATES`).
- **Health FSA**: up to $3,400 in 2026, $680 may carry over (Rev. Proc. 2025-32). **Child care FSA**: up to $7,500 a
  household from 2026 ($3,750 married filing separately; was $5,000), IRC 129 as amended by P.L. 119-21 §70404; shown
  with children under 13 (IRC 21(b)(1)(A)); the other adults' elections come off the household's limit. The account
  also pays care for a spouse or another dependent who cannot care for themselves (IRC 21(b)(1)(B) and (C)); the page
  does not know who that is, so it is shown with a child under 13 or once an amount is typed. **Commuting**: transit
  and work parking, each up to $340 a month in 2026 (Rev. Proc. 2025-32 §4) and $325 in 2025 (Rev. Proc. 2024-40
  §2.17). Each saves federal + payroll + state tax
  (`taxSaved`). A typed amount over its limit is capped, and the page says so.
- **Stock purchase plan** (IRC 423): put in = min(share × pay, $25,000 × (1 − discount)), the most that buys $25,000
  of stock a year at the offering price with prices flat (the limit is on the stock's value at the offering's start);
  discount at most 15%. Gain if sold at once = put in × (1 ÷ (1 − discount) − 1) (15% off = 17.6% on the money; more
  with a look-back when the price rose). Sold at once (a disqualifying sale) the discount is pay: income tax (the
  household's federal tax with the gain added) + the state's rate; no Social Security or Medicare (IRC 3121(a)(22);
  IRS Publication 525).
- **Life cover through work** (IRC 79): the cost of cover above $50,000 is taxable pay: (cover − 50,000) ÷ 1,000 ×
  Table I's monthly rate for the age at the year's end (40 when unknown, said on the page) × 12 − what the employee pays (Treas. Reg. 1.79-3(d)(2), IRS
  Publication 15-B: under 25 $0.05, 25-29 $0.06, 30-34 $0.08, 35-39 $0.09, 40-44 $0.10, 45-49 $0.15, 50-54 $0.23,
  55-59 $0.43, 60-64 $0.66, 65-69 $1.27, 70+ $2.06). Tax = federal income tax on it + Social Security on the part
  under the wage base + 1.45% Medicare + the state's rate.
- **Each paycheck**: pre-tax total = the 401(k) now + HSA + FSAs + commuting a year; tax saved = the 401(k)'s, then
  the HSA, FSAs and commuting worked together on the wages the 401(k) leaves (near the wage base or a bracket edge
  they save more together than one by one); taken from each paycheck = (pre-tax total − tax saved + the stock plan's
  money) ÷ paychecks.

## Edge cases
- No pay (or pay of 0): an empty state; pay linked to nobody: a pointer to People and Income. No 401(k) account for the
  person: the choices are shown with a link to Contributions instead of the "Use" buttons; nothing going in now: no
  "now" choice. No HSA on file and not ticked: the HSA card is left out. Nothing chosen: a sentence, not $0 tiles.
- An HSA with a health FSA: the FSA has to be limited-purpose (a note).
- State tax unknown: not counted in the savings (a note).

## Tests
`module.test.mjs`: match tiers (capped pay, no match), the 401(k) limit by age, Table I (unknown age), the tax a
deduction saves (wage base, state, no payroll, no 0.9%), the plan year in October and spring, Ana's 401(k) choices by
hand, match left behind with two tiers, no match, pay over $360,000, the Roth catch-up's after-tax part,
Pennsylvania, the HSA (room, cap, saving, catch-up from 55, a state that taxes it, none), FSAs and commuting capped,
child care shared in the household, a separate return, the stock plan (gain, tax, the 15% cap, the $25,000 cap, the
state), life cover (above the wage base), the paycheck worked together, paychecks by period, whose benefits (a
fallback), not ready (no pay, pay linked to nobody, pay of 0).

## Ideas / not yet
- Roth or pre-tax 401(k) by this year's rate against the expected rate in retirement.
- The health plan choice itself lives on Health plan compare; disability and accident cover on their own pages.
- The child and dependent care credit (changed from 2026) against the child care FSA.
