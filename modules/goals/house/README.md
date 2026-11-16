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
figure is typed. Opening the page writes nothing. While nothing is saved the hero says it ("Leave a box empty and we count
the gray figure, what is typical for Ohio."); once saved, one muted line under the answer names the guesses still in use
("Our guesses for now: the price, the rate, property tax and insurance."; `guessedWords`, one sentence each for one, two and
more), and "The figures" says "4 our guesses" while shut (docs/OPTIONAL.md R9 #5: a reason to doubt a figure is never folded
away).
**`compute` counts them itself** (`previewsOf`: the four estimators below run through `core/estimate`'s `estimate()`, exactly as
the shell's `ctx.guess` runs them, with its gate: no U.S. figure for a plan in another currency or outside the U.S.), so every
page that quotes this compute counts the same figures: Your plan's "home" row ("Your pay supports a home of up to about ...")
equals this page's "Up to about" (critic e9 F1, 2026-11-14: the page passed its guesses and Your plan did not, so the family
read $575,629 here and $636,884 there). The view draws the figure the answer counts (`inputs[key]`) and takes only the
reason from `previewsOf`. `params.previews: null` is exactly the page before C9 (the example figures; the module test compares
the outputs); an object of numbers is used as given. With no guess (another country, or a box the person filled) the box shows
the figure as before.
**Opened from the house goal** (never saved, a goal with an amount), the price is the one the goal's cash buys, and our insurance
is asked again as a share of that price, then the price worked out again with it (up to three times; critic e9 F4: it was a
share of our typical price). The share only moves where the $350 floor bites: West Virginia, a goal of $8,000, a $33,000 home,
1.06% instead of 0.71%.

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
First view: the hero while nothing is saved (with "Leave a box empty and we count the gray figure, what is typical for
Ohio." when there are guesses), any warning, what the income supports, the home a month with the cash needed (and, once saved,
the guesses line), when you get there, then "The figures" (a part: open with its five boxes until the page is saved, after that shut with the price or "4 our
guesses" as its status; after "Work it out" it stays open for the next try, R17), then "More on this" (`links()`: "Rent or
buy?", "What do lenders see?"; one shut row on a step of the path). No hand-written `<details>` remain.

Measured, not guessed: a one-line-shorter hero pulled one more row of figures into the first screen (the browser check,
`qa/first-view.mjs`, counts what is above 844 px), and the guesses line under the answer put the empty plan's first screen over
its 110 words; the hero's words and the line's place were chosen so both checks stay at or under their counts.

## Share these figures (gap list, next 60, item 33; 2026-11-16)
One quiet tap away, at the foot of "The figures" (drawn only once a figure is typed, so never on the first view): the
short line "Only these figures go in the link; nothing is sent until you send it." and an outlined "Share these
figures". The tap builds the link and hands it to the phone's share menu where the phone has one (the person picks the
app and sends it), else copies it (the clipboard, else the older select-and-copy for an http address on the home
network), and shows the link itself with one line that names what goes and what does not (critic P1, P2, P3; fix round
2026-11-16): "Link copied: paste it into a message. It carries the price and the down payment, nothing else. The other
phone fills in the rest with its own figures, so its answer can differ." (the sender sees about $2,920 a month with our
guesses for where the sender lives; an empty phone sees about $2,610 with its own). Up to three figures are named, more
are "the price, the down payment and 7 more figures"; a saved figure a link cannot hold (a price over $100 million, from
an import) is named: "The price could not go in the link." Where the address opens only here or at home it says so:
"It opens only on this device." (localhost, a file) or "It opens only on phones on your home network." (a private
address, a .local or one-word name, a tailnet); "on any phone" is never said.

What the link holds (`SHARE_SPEC` in `view.js`, read and written by `core/share-link.js`): `#/goals/house?share=` and
`name:value` pairs for the home's own figures only: `price` (money, 0 to 100 million), `down` (downShare, a percent),
`rate`, `closing` (closingShare), `term` (termYears, 5 to 40 whole), `tax` (taxRate), `insurance` (insuranceRate), `hoa`
(hoaMonthly, 0 to 1 million) and `reserve` (reserveMonths, 0 to 12 whole); percents 0 to 100 as typed (6.25 for 6.25%).
Never `saved`, `monthly` or `targetDate` (the household's own savings and date: the spec's `stays`), never anything
else from the plan, and never a box left blank. The page's own button writes `name:` (nothing after the colon) for a box
emptied during a visit where this phone has its own figure; the reader takes it as blank, neither filled nor refused.
A number with a leading zero ("07") is refused: the app never writes one. Example, the invented home of the tests: `#/goals/house?share=price:420000,down:10,rate:6.25,
closing:3,term:30,tax:1.2,insurance:0.4,hoa:150,reserve:3`.

Opening a link (another phone, or this one): the page is drawn from `planWith(plan, SHARE_SPEC, withShared(own, link))`,
a copy, so the plan is untouched. At the top: "Figures from a shared link: nothing in your plan has changed.", "The link
filled in 9 figures on this page." (or "...; 2 could not be read and were left out."), then whose the other boxes are
(critic F2, P1; `restOf` and `restWords`): "The rest are our guesses for you." / "The rest are your own figures." / "The
rest are your own figures and our guesses.", and "Keep these" and "Back to my own figures" (both outlined). "The
figures" is open while a link shows, so the visitor sees where to change one (critic P5). The answer counts the link's
home with this phone's own income, debts, savings and goal; a box the link leaves out keeps this phone's own figure, or
its gray guess when it has none (the sender's guess is worked out from where the sender lives, which is plan data, so it
never travels). While the link shows, the savings and date boxes and the goal button are not
drawn (so "When you get there" says "Your savings stay your own: the link does not carry them." instead of pointing at
a box below), and "Work it out" works the boxes out for this visit only: they go into the address (`ctx.replace`, no new Back
step), with "Worked out for this visit: a $430,000 home, about $3,110 a month. Nothing in your plan has changed." (the invented family's figures)
"Keep these" asks first ("Keep the price and the down payment in your plan? They take the place of yours on this page;
your other figures stay as they are. Undo puts yours back."; four or more: "Keep these 9 figures ..."), writes
`whatIfs.house` once (the keys the link holds and nothing else: this phone's own HOA, mortgage length, savings and date
stay, so the kept page answers exactly as the visit did; critic F1, fix round 2026-11-16: Keep had blanked them), takes `share` out of the address and says "Kept. A $420,000 home: about $3,040 a month." with Undo ("Back to
your own figures, as before."). "Back to my own figures" writes nothing: "Your own figures again. Nothing from the link
was kept." A link with nothing readable: "This link's figures could not be read, so the page shows your own."

No formula is new: the answer is this page's `compute()`. The link's figures are the plan's own numbers, a percent
written x 100 (`Number((v x 100).toPrecision(12))`, read back / 100 the same way), money to the cent. The address after
"#" stays in the browser (RFC 3986 section 3.5; the Fetch standard drops it from every request; builder's knowledge, not
re-read this session: the network reaches only irs.gov and the package registries); the app sends it nowhere and stores
it only where the shell keeps every address of this tab (sessionStorage).

Builder's choices: figures travel, answers do not (each phone works the answer out with its own household); the
household's own savings and date stay home; a box the link leaves out is the visitor's own (their figure, else their
guess), so the visit shows what Keep keeps; Keep outlined and asked first, the page's own filled button keeps its place;
the link carries no `?sandbox` or `?view`; the phone's share menu first, then the clipboard (the person still chooses
where it goes; nothing is sent by the app).

## Tests
`module.test.mjs`: the monthly cost and its inverse, months to save, the family's limits, cash and monthly needed, the house goal test (a repairs, pay-off or trip goal is never offered; the clearest of several wins), a house goal supplying the figures, entered figures winning, the warnings, no income. C9: each estimator's formula by hand
from the bundled tables (Ohio and no state), the gate (another currency, outside the U.S.), invariance (no previews: the
output has no new key and is the same with `previews` null, absent or empty), previews only in empty boxes (a typed figure
and the goal's price win), the guesses line for one, two, three and four, the gray text, and the page drawn: gray figures in
the empty boxes, the answer counting them, opening writes nothing, "Work it out" with empty boxes saves no figure and no
guess, S11 (only The figures stays open after a save), no guesses for another country or without `ctx.guess`.
Share (item 33): the round trip through the router's own `parse()` to another household (the answer is `compute()` on the
link's figures), a sender plan full of invented names, places, an employer, notes and balances whose link holds none of
them, unknown and malicious keys ignored and counted, nothing saved without Keep (opening, Back to my own figures, Work
it out on a link, Keep refused), Keep writing the page's own keys once with its green line and Undo putting the plan back,
Keep leaving the visitor's own HOA and length (F1), a box emptied on a visit staying empty, a figure no link can hold
said at its box, a saved one named after the tap (F3), "The figures" open on a visit (P5), the sentences of each case, and invariance over every invented household (no link: no banner, nothing written, the same
text with other query keys, the share never outside a shut part).

## Ideas / not yet
- Mortgage insurance in the cost; first-time buyer programs; the down payment drawn from a 401(k) loan or an IRA's first-home exception.

## Touch and input stress test (2026-11-11, claude-g)
- "Work it out" says the answer in its green line ("Saved. A $350,000 home: about $2,410 a month.") and keeps "The figures" open
  for the next try (j-one-answer A1, p-cashflow-b-goals F6). Bringing the answer into view is wave 1's shared helper.
