# Stress tests  (`scenarios/stress-tests`)

**Status:** usable (phase 9)
**Purpose:** Your plan run through a crash the year you retire, a decade of high prices, a job loss, an illness, losing a partner and a long life: which ones it survives and what would fix the rest.

## Inputs
Everything `retirement/projection` `buildInputs` reads (people, accounts, contributions, Social Security, pensions, spending, assumptions), plus `income` (who earns what, for the job loss and disability), `retirement.longevity` (the long-life odds), `insurance.policies` (a disability policy's monthly benefit; term or whole life benefits paid at a death). Params: `today`, `when` ("retire" or "now": when the market crises hit). Writes nothing. `heavy: true` (about 500 projections): the PC runs it when connected.

## Outputs
`{ ready, missing, when, hitYear, base, scenarios[], passed, total, years, notes, retireYear, startYear }`; each scenario `{ id, group, icon, title, story, success, failYear, failAge, endReal, minReal, path (savings in today's dollars by year), affordable, roomMonthly, worstGap, go }`.

## The shocks (each is the plan's own engine with one thing changed)
| shock | what changes |
|---|---|
| A crash like 2008; a lost decade like 2000-2009; the 1970s (1973-1982); 1929 and the Depression (1929-1938); stocks and bonds down together, like 2022 | from the hit year (the household's retirement year, or now), the real yearly returns of stocks, 10-year Treasuries and bills, and the real CPI inflation of those years (Damodaran, `retirement/historical/data/returns.js`), then the plan's own assumptions again. The stories' figures (the deepest fall, average inflation, the real stock result) are worked out from the same data by `crisisFacts`. |
| Returns 2 points lower, for good | the stock and bond assumptions minus `LOWER_RETURNS` (0.02) every year |
| Out of work for 6 months | the biggest earner still working: `JOB_LOSS_MONTHS` (6) of take-home pay (`TAKE_HOME` 75% of gross; a planning assumption) comes out of savings this year as an engine event, and their contributions skip the year |
| Never working again | the plan rebuilt with that person retiring now (contributions stop; if it is the first person the household's spending years start); their Social Security line starts next year at the full-retirement-age amount (Social Security disability pays the PIA); a disability policy on file pays its monthly `benefit` to 65 |
| If X died this year (couples, each adult) | the plan rebuilt for the survivor alone: X's people entry, income, contributions and Social Security removed; filing single (head of household with a dependent); spending x `SURVIVOR_SPENDING` (0.75, a rule of thumb) from now; the survivor's Social Security the larger of their own and `couple.survivorMonthly` (widow(er)'s limit included); `FUNERAL` ($8,300, NFDA 2023 median with viewing and burial) out, term/whole life benefits on file in |
| Living to 100 | every adult's plan-end age 100 (105 if the plan already runs to 100); the story gives the chance at least one reaches it from `retirement/longevity` `survival` |
| Three years in a care home | `CARE_HOME_YEARLY` ($127,750, the 2024 national median private nursing-home room, CareScout/Genworth Cost of Care Survey) a year in today's dollars for three years from the first person's 85th birthday (earlier if the plan ends before 88), on top of spending |

New engine hooks (`core/math/retirement.js`, tested in `tests/retirement.test.mjs`): `events` (money out of or into savings in a year), `spendingChanges` (spending times a factor from a year), `contributions[].untilYear/skipYears`, `incomes[].fromYear/untilYear`.

## The figures shown
- Lasts / runs out (and the age); left at the end (today's dollars).
- At worst: the deepest the savings sit below the plan's own path, as a share, and the year (`worstGap`).
- Spending room: `affordableSpending` under the shock (the largest steady, inflation-adjusted spending that lasts) minus the plan's spending, a month, in the shock's own spending (a survivor's 75%). Negative: the cut that makes it last.

## Edge cases
No plan basics: not ready, lists what is missing. Already retired: markets hit now. Nobody earning before their retirement age: no job loss or disability, with a note. One adult: no death shocks. A crisis that ends ahead of the plan (history's recoveries beat the assumptions) says so in its story: the dip is what hurts.

## Tests
`module.test.mjs`: the family's twelve shocks and their order, the crisis replay matching the plan until the hit year, `crisisFacts` against the data, the job-loss amount, death shocks only for couples, the long-life length, the care-home cost, an already-retired couple.

## Ideas / not yet
- A shock picker: build your own (crash size, year, a cut in spending in response).
- The Monte Carlo spread under each shock; unemployment benefits; the pre-retirement budget after a death (how many years one paycheck covers), to size life insurance (`insurance/life-needs`).
