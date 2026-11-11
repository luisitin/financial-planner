# How am I doing  (`overview/benchmarks`)

**Status:** usable (phase 9)
**Purpose:** Your net worth against families of your age, your retirement savings against the usual guideline for your age, and the rules of thumb for saving, cash, housing and debt.

## Inputs
`household` (the head's age: the person marked "Me"), `accounts`, `income`, `expenses`, `debts`, `retirement.contributions`, through the Net worth, Income, Expenses, Emergency fund, Debts and Contributions computes. Writes nothing.

## Outputs
`{ ready, missing, age, group, scfYear, items[], ahead, judged }`; each item `{ id, title, you, benchmark, unit, better, verdict: ahead|on par|behind|unknown, sentence, source, go }`.

## The benchmarks
| item | you | benchmark | source |
|---|---|---|---|
| Net worth | Net worth page | the median net worth of families whose head is in the same age group | Federal Reserve, Survey of Consumer Finances 2025 ("Changes in U.S. Family Finances from 2022 to 2025", October 2026), 2025 dollars: `data/scf.js` |
| Retirement savings for your age | 401(k), IRA and Roth balances / a year's pay (salary and bonus) | Fidelity's multiple of pay for the age (1x by 30, 2x by 35, 3x by 40, 4x by 45, 6x by 50, 7x by 55, 8x by 60, 10x by 67), straight-line between (0 at 22) | Fidelity Viewpoints, "How much do I need to save for retirement?" |
| Saving for retirement | contributions with the employer's money / pay | 15% | Fidelity's 15% guideline |
| Emergency fund | the Emergency fund page's months of must-pay bills | 3 months (ahead from 3; the usual range is 3 to 6) | common rule |
| Housing cost | housing expenses / gross monthly income | 28% or less | lenders' front-end ratio |
| Debt payments | Debts page's debt-to-income | 36% or less | lenders' back-end ratio: Fannie Mae's manual maximum (45% with a strong credit score and reserves, 50% through its automated approval; Selling Guide B3-6-02). The CFPB removed the 43% limit from the General Qualified Mortgage rule (12 CFR 1026.43(e)(2), price test since 2021). Read 2026-10-31 |
Verdicts: "ahead" 10% or more past the benchmark (7% for rates), "on par" within it, "behind" short of it; cash is ahead from 3 months, on par from 2.1.

The SCF figures match Table 2 of the Federal Reserve's report (thousands of 2025 dollars, p. 12), checked on 2026-10-31; they were first typed on 2026-10-30 from news reports of the release. The survey is every three years: update `data/scf.js` when the 2028 survey is out (2029).

## The rules of thumb against the plan's own answer (2026-11-02)
"Retirement savings for your age" and "Saving for retirement" are rules of thumb. When one is behind and the plan's own
answer (`savingVerdict` in retirement/projection, once Social Security is known) says the money lasts, its verdict is
`"rule"`: a neutral "your plan lasts" pill and "Behind the rule of thumb, but your own plan lasts (Will the money
last?)." Amber "behind" stays when the plan runs short (the sentence then says at what age) or has no answer yet.

Review fix (2026-11-02): pay counts business income too (salary + bonus + business), as Retirement contributions does, so
a self-employed household gets the two retirement rows and both pages show the same share. (Three other proposals, a
wider "on track" margin, amber for "tight" and cause-based advice, were refuted by the verifier as intended and are
unchanged.)

## Tests
`module.test.mjs`: the age groups and the savings multiple, not ready without a birth date, the family's six items and verdicts.

## Ideas / not yet
- Percentiles (not only the median) and income groups from the SCF tables; the trend from the net-worth history; a couple's own age gap.

## Round 7 (2026-11-06)
- A birth date after today (a typo: 2031 for 1931) has no age group, and the page failed reading the group's median. It now
  waits: "a birth date before today on the People page". Test: "round 7 (2026-11-06): a birth date after today ...".

## A renter's debt payments (round 8, 2026-11-06)
For a renter (`rentsHome`: no mortgage owed, no Real estate account) the debt row's benchmark is the renters' line, rent not
counted: 15% or less "ahead", to 20% "on par", above "behind" (CFPB, Your Money, Your Goals, "Debt-to-income calculator tool" (2018-11,
https://files.consumerfinance.gov/f/documents/cfpb_your-money-your-goals_debt_income_calc_tool_2018-11_ADA.pdf, read
2026-11-06): homeowners "36 percent or less ... Some lenders will go up to 43 percent or higher. Your home mortgage is
included in this ratio"; renters "15-20 percent or less. Your rent is not included in this ratio."). Its sentence adds the figure a home lender would see
with a housing payment like the rent (`lenderWithHousing`, Fannie Mae's 36% / 45% / 50%). The invented renter: "$670 a month
of required payments on loans and cards is 21% of gross income; for renters the guideline is 20% or less, rent not counted.
Add a home payment like your $950 rent and a lender would see 50% of your income going to debts: more than most lenders
accept ..." (it read "ahead" of 36%). A rent that is still our guess reads "the $1,200 rent we guessed for you (type yours on
Expenses)" (verify, 2026-11-06).
Homeowners as before. Test: `module.test.mjs` ("round 8").

## Retired households, and the cash aim (round 8, 2026-11-06)
- Every adult retired (projection's `householdRetired`): the two pay-based rows ("Retirement savings for your age", which
  read "Needs pay on the Income page" to a widow, and "Saving for retirement") give way to one row, "Your savings in
  retirement", that points to Will the money last? (`savingVerdict`): "your plan lasts" (verdict `lasts`, green, counted as
  ahead) when it lasts, "behind" when it runs
  short (with the age), "not yet" until the plan can be checked. Working households: as before.
- Verify (2026-11-06): when the plan lasts only just (the projection's `tight`: it lasts with average returns but carries
  under 115% of the planned spending, "It lasts, just" on Will the money last?), the row is "on par", not ahead: "By your own
  plan the money lasts, but only just: it can carry about $6,327 a month against the $6,000 planned, with little room for a bad
  run of markets". It read a green "your plan lasts", counted as ahead.
- Percents in the sentences (`pctW`) are rounded as core/format.js `pct` prints them (x x 100 to 12 significant digits, then
  the whole percent), so 28.5% housing reads "29%" and "behind", as What lenders see prints and grades it (verify, 2026-11-06).
- Cash: judged against the plan's own aim, liquidity's `targetMonths` (`assumptions.emergencyMonths`, the Emergency fund
  page's): at or past it "ahead", from 3 months (the planners' least) up to it "on par", under 3 "behind". The benchmark (and
  the ruler) is the aim, and the sentence says it: "Usable cash covers 5.1 months of must-pay bills; your plan aims for 6
  (most planners say 3 to 6)." It read "ahead" of a fixed 3, against 6 on every other page. A household with 2.1 to 3 months
  now reads "behind" (it read "on par", within 30% of 3).
- Test: `module.test.mjs` ("round 8: retired ...").

## Round 8 review fixes (2026-11-06)
- **A renter's debt row is of the required payments** (liabilities `dtiRequired`; the lender figure adds the rent to the
  required payments). Source: Fannie Mae Selling Guide B3-6-05, "Monthly Debt Obligations" (dated 2026-08-05,
https://selling-guide.fanniemae.com/sel/b3-6-05/monthly-debt-obligations, read 2026-11-06): revolving accounts are counted at
the payment the credit report shows, with "5% of the outstanding balance" only when it shows no required minimum; nothing in
it counts a payment the borrower chooses on top.
- **One rule on the housing and debt rows: over the line is "behind".** `lineVerdict(x, line)`: at or under 93% of the line
  "ahead", up to the line "on par", above it "behind", on the share at the whole percent shown (liabilities `shownShare`).
  Housing at 29% against 28% read "on par" (a 7% band above the line) right above "Debt payments 21% ... behind", while What
  lenders see called 29% housing "on the high side"; it is now "behind" on both pages. The same for a homeowner's debts against
  36% (37% read "on par"; the Debts tile and What lenders see say "on the high side"). The renters' debt row keeps its own
  steps (15% or less ahead, to 20% on par), on the percent shown (`renterLevel`).
- **A retired household whose plan lasts is counted as ahead**: verdict `lasts`, a green "your plan lasts" pill, and in `ahead`
  ("Ahead on 4 of 5"); the working-age rule-of-thumb rows that are behind but lasting keep the grey "rule" pill.
- Tests: `module.test.mjs` ("review D3 and D7", "review UX" x2), failing before the fix.
- Review round 2: the row is named "Emergency fund", the one name for that money.
