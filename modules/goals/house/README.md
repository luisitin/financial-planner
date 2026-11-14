# House down payment  (`goals/house`)

**Status:** usable (phase 4)
**Purpose:** How much home the household's income supports by the lenders' rules, what a home costs a month, the cash needed on the day, and when you will have it; one tap puts the cash target on the Goals page.

## Inputs
`income` (gross monthly), `accounts` and `debts` (other debt payments, not the mortgage), `goals` (the house goal, `findHouseGoal`: a down payment or a home to buy, supplies what is set aside, the monthly amount and the date), `assumptions.returnCash`, `whatIfs.house`. Writes `whatIfs.house = { price, downShare, closingShare, rate, termYears, taxRate, insuranceRate, hoaMonthly, reserveMonths, saved, monthly, targetDate }` and, on "Make it a goal", adds or updates a goal (target = the cash needed, rounded to $100).

## Outputs
`compute(plan, { today, previews? })` -> `{ inputs, grossMonthly, otherDebtMonthly, maxFront, maxBack, maxPrice, rule, monthly, parts, frontShare, backShare, cash: { down, closing, reserves, total }, saved, goal, monthlySaving, monthsToGo, readyDate, target, neededMonthly, warnings, fromGoal, goalTarget, previewed? }`.
`previews` and `previewed`: see "Our guesses in the boxes" below. Also exported: `estimators` (re-exported by `module.js`),
`previewsOf(plan, { today, price? })` (our guesses for the empty boxes, as Estimates), `PREVIEWED`, `guessedWords`,
`previewText`, `placeOf`, `typicalPrice`, `newLoanRate`, `taxShare`, `insuranceShare` (Rent vs buy uses the same four
estimators and the same line).

## Formulas
- Monthly cost(price) = pmt(rate / 12, term x 12, price x (1 - down)) + price x (property tax + insurance) / 12 + HOA. It is linear in the price, so the price a budget buys = (budget - HOA) / the cost of one dollar of price (`priceFor`).
- Budget = min(28% of gross monthly income (front end), 36% of it less the other debt payments (back end)); the binding one is `rule`.
- Cash = down payment + closing costs (3%) + reserves (2 months of the monthly cost).
- Months to go: set-aside money grown at the cash return each month plus the monthly saving, until it reaches the cash needed (`solveMonths`, up to 100 years). Monthly needed by a date = pmtToReach(cash return / 12, months, cash needed, set aside).
- Warnings: under 20% down (mortgage insurance), a price over what the rules suggest.
- The house goal (`houseGoalRank`, `isHouseGoal`, `findHouseGoal`, exported): saving to buy a home, never a goal for a
  home you already have or for a car. Each goal gets a rank and the highest wins (the first of equals), so a real
  down-payment goal beats "Our home" listed before it, and "Home remodel" is never read or overwritten: 3 a name with
  "down payment" (what "Make it a goal" saves) unless it names a car, boat or the like; 2 the 🏠 icon, or a name for
  buying a home ("Homebuying fund", "Buy a house"); 1 house, home or condo in the name, also run into another word
  ("Townhouse fund", "Farmhouse"); 0 anything else, and any name about work on, paying for or a trip to a home you have
  (repairs, remodel, paint, pay off, mortgage, rent, insurance, office, gym, trip, visit, holiday, housewarming...).
  "Beach house" counts (most likely saving to buy one); "Beach house rental" does not. History: until 2026-10-31 any
  name containing "home" counted, so "Make it a goal" overwrote a "Home repairs" goal; the first fix needed house or
  home as a whole word, which lost "Townhouse fund" and "Homebuying fund" and still took "Pay off the house" (found by
  a third review the same day). The step-by-step guide's "Set down payment goal" step uses the same test.

## Opening on your own goal (2026-11-01, round 2 of the owner's experience list)
- Never saved here (`whatIfs.house` absent) and a house goal with an amount: the page opens on the price that amount buys,
  `priceForCash(target)` = (target - HOA x reserve months) / (down share + closing share + reserve months x monthly cost per
  dollar), rounded to $1,000 ("Your "House down payment" goal of $50,000 buys a home of about $206,000"), and "To have it
  by" quotes the Goals page's own `neededMonthly`, so the two pages agree. Before, it opened on the $400,000 example
  ($97,010 cash, "about $2,620 a month") while Goals said $1,431. The form's boxes show the same figures (the price the goal
  buys, not the example), so "Work it out" without a change saves what the page shows. A goal with no date gives no monthly
  figure (it read "To have it by : about $0 a month").
- The goal button shows only once the figures are the person's own (saved): outlined, naming both amounts, "Change the goal
  from $50,000 to $97,000", or "Make it a goal ($97,000)" when there is none. Before, a filled "Update the goal" applied the
  example's figures in one tap and replaced the person's $50,000 with $105,995. Unsaved and with no goal, a line says to put in
  the home first.
- Dates read as month and year ("November 2029").

## Our guesses in the boxes (smart guesses C9, 2026-11-14; spec 12.1 "K3 previews")
An empty **Home price**, **Mortgage rate a year**, **Property tax** or **Home insurance** box shows our guess in gray, the
figure written as the person would type it ("250,000", "6.5", "1.22", "0.46"), with one line under it, "Our guess: ...".
The answer counts that figure while the box stays empty: an empty box saves `null` (nothing new is
ever written, no `plan.guesses` entry), so the gray figure follows the plan (the state on People) and goes the moment a
figure is typed. Opening the page writes nothing. Under the answer one muted line names the guesses in use ("Our guesses
for now: the price, the rate, property tax and insurance."; `guessedWords`, one sentence each for one, two and more), and
"The figures" says "4 our guesses" while shut (docs/OPTIONAL.md R9 #5: a reason to doubt a figure is never folded away).
The page asks for the four through `ctx.guess` (the shell's estimate, with its gate: no U.S. figure for a plan in another
currency or outside the U.S.) and passes the values to `compute` as `params.previews`; without them `compute` is exactly as
before (the module test compares the outputs; checked against the code before this change on eight invented households).
With no guess (another country, or a box the person filled) the box shows the figure as before.

| estimator | formula | table (bundled in `modules/overview/guesses/data/`, with its source and read date) |
|---|---|---|
| `goals/house:price` | the state's median value of owner-occupied homes, in 2025 prices (`cpiSince(2025)` = 1: the CPI table ends in 2025), to two figures (R11): Ohio $254,100 -> **$250,000**; no state: U.S. $371,100 -> **$370,000**. Why: "a typical Ohio home". The same figure Get started's down-payment guess (`goal.home.target`) is a share of | `acs2025_median_home_value_by_state` (U.S. Census Bureau, ACS 2025 1-year, B25077; read 2026-11-02) |
| `goals/house:rate` | Freddie Mac's average 30-year fixed rate of the newest year in the table (2026, the weeks to 2026-11-05: 6.53%), to a tenth of a point: **6.5%**. Why: "the average new 30-year rate so far this year" (in a later year: "in 2026") | `pmms30_annual_average_by_year` (Freddie Mac PMMS weekly history, averaged by year; read 2026-11-07) |
| `goals/house:taxRate` | the state's median real-estate tax over its median home value, to a hundredth of a point (`rounded`, as insurance; critic e9 F5: R11's tenth read Hawaii's 0.265% as 0.3%, 13% off): Ohio 1.223% -> **1.22%** ("Ohio homes pay about 1.22% of their value a year"); Texas 1.32%, West Virginia 0.51%, Hawaii 0.27%; U.S. 0.9% | `acs2025_effective_property_tax_rate_by_state` (ACS 2025; read 2026-11-02) |
| `goals/house:insuranceRate` | the guesses module's own home insurance for a home at this price (`insuranceYear`: the state's average HO-3 premium in 2023, x CPI 2023->2025 = 1.0570, scaled by the price over the state's typical home, at least $350 and at most 2.55% of the value), over the price: Ohio 1,116 x 1.0570 / 254,100 = **0.46%** (to a hundredth of a point, `rounded`: R11's tenth would move a share under 1% by a fifth); U.S. 0.49%. The price is the one typed, else our price guess | `naic2023_homeowners_premium_by_state` (NAIC, Homeowners Insurance Report, data for 2023, read 2026-11-02), `acs2025_median_home_value_by_state_and_mortgage_status` |

Choices made here (the spec said "K3 previews" only):
- **Where the guesses come from.** The tables and two helpers (`cpiSince`, `insuranceYear`) are the guesses module's, so a gray
  figure here is worked out exactly as the same figure is on Home and Get started. The four keys are this module's estimators
  (`npm run check` checks their contract and tables); Rent vs buy asks for the same keys.
- **The rate is the year so far, not the newest week.** The bundled weekly figure (`mortgage_rate_pmms_weekly_2026`, 7.24% for
  the week of 2026-10-29, read 2026-11-02) is behind no other guess (the `modules/overview/guesses` test says so), and
  freddiemac.com could not be opened from the build session on 2026-11-14 to check it; the same publisher's 2026 average (6.53%,
  read 2026-11-07) is the one other guesses use, so that is the gray figure.
- **Down payment, closing costs, the loan's length, reserves and HOA have no sourced table** (closing costs: none is bundled; the
  20% down is a rule, not a statistic), so they get no gray figure. The down payment shows its 20% as before, and its help says
  where it comes from while nobody typed it ("We start at 20%, which avoids mortgage insurance."; critic e9 P2: a black 20 next
  to a gray 6.5 read as the person's own); the help lines all start as sentences ("Left empty, we use the Goals page's house
  goal."; P8). The boxes folded
  under "More details (optional)" open empty and their help says what an empty box counts ("Left empty, we count 3% of the
  price; closing costs usually run 2% to 5%."), so no example sits in a box. An empty HOA box is none.
- **The form asks for five boxes first** (price, down payment, rate, set aside, saved a month); the other seven are under "More
  details (optional)" (docs/OPTIONAL.md R21). The gray property tax and insurance figures are among them: they are not guesses
  in the plan (nothing is written from them), and the line under the answer names them.
- **Not done:** our down payment (NAR's median 10% for first-time buyers, 23% for repeat buyers, which Get started's goal guess
  uses). It would make this page agree with a guessed goal, but under 20% the mortgage insurance warning would open every
  renter's first view; left for the owner.

## The page, simple first (2026-11-14)
First view: the hero while nothing is saved (with "An empty box counts the gray figure, typical for Ohio." when there are
guesses), any warning, what the income supports, the home a month with the cash needed and the guesses line, when you get
there, then "The figures" (a part: open with its five boxes until the page is saved, after that shut with the price or "4 our
guesses" as its status; after "Work it out" it stays open for the next try, R17), then "More on this" (`links()`: "Rent or
buy?", "What do lenders see?"; one shut row on a step of the path). No hand-written `<details>` remain.

## Tests
`module.test.mjs`: the monthly cost and its inverse, months to save, the family's limits, cash and monthly needed, the house goal test (a repairs, pay-off or trip goal is never offered; the clearest of several wins), a house goal supplying the figures, entered figures winning, the warnings, no income. C9: each estimator's formula by hand
from the bundled tables (Ohio and no state), the gate (another currency, outside the U.S.), invariance (no previews: the
output has no new key and is the same with `previews` null, absent or empty), previews only in empty boxes (a typed figure
and the goal's price win), the guesses line for one, two, three and four, the gray text, and the page drawn: gray figures in
the empty boxes, the answer counting them, opening writes nothing, "Work it out" with empty boxes saves no figure and no
guess, S11 (only The figures stays open after a save), no guesses for another country or without `ctx.guess`.

## Ideas / not yet
- Mortgage insurance in the cost; first-time buyer programs; the down payment drawn from a 401(k) loan or an IRA's first-home exception.

## Touch and input stress test (2026-11-11, claude-g)
- "Work it out" says the answer in its green line ("Saved. A $350,000 home: about $2,410 a month.") and keeps "The figures" open
  for the next try (j-one-answer A1, p-cashflow-b-goals F6). Bringing the answer into view is wave 1's shared helper.
