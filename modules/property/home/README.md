# Home  (`property/home`)

**Status:** usable, phase 7
**Purpose:** Your home: what it is worth and what you own of it, what it costs a year to keep, what selling would leave, and value and equity ahead.

## Inputs
- The home: the property account named by a `property[]` entry with `kind: "home"`, else the largest property account
  (its `balance`, `asOf` and `history`).
- That entry's details: `{ purchasePrice, purchaseDate, improvements, propertyTax, insurance, hoaMonthly, maintenance, appreciation, sellCosts, reducedReason, jobs? }`
  (`improvements` is also raised by a job added with "Also count this as an improvement", and lowered by its Remove)
  (property tax falls back to `taxes.itemized.propertyTax`).
- The mortgage (`debt/mortgage`: balance, rate, payment, extra, the yearly schedule); the federal estimate's inputs
  (`taxInputs`, `federalTax`) in today's tax year (`todaysReturn`).
- Writes: the home's details; "Update value" sets the account's balance and `asOf`, keeping the old value in `history`.

## Outputs
`{ ready, accountId, name, value, owed, mortgageName, equity, equityShare, ltv, details, bought: { price, date, years, growth, gain } | null, history, costs: { lines, total, monthly, principal }, sale: { costs, basis, gain, cap, capEach, owners, exclusion, excluded, taxable, term, longOn, test: { days, months, meets, from }, reduced, dateMissing, rate, tax, niit, niitLine, incomeTax, year, otherYear, filingStatus, net }, ahead: [{ years, year, value, owed, equity }], appreciation, pmi }`.

## Formulas
- Equity = value − mortgage; loan-to-value = mortgage ÷ value (above 80% lenders usually require mortgage insurance).
- Growth since bought = (value ÷ price)^(12 / months owned) − 1.
- A year: property tax + insurance + dues × 12 + upkeep (default 1% of the value) + the mortgage's interest over the next
  twelve payments (`yearOfPayments`); the principal part is shown apart (it is not a cost).
- Selling today: costs = value × 6% (agent and closing; your own share); gain = value − costs − (price + improvements).
  A loss on your own home is not deductible.
- **The two-year test** (`twoYearTest`): the gain is tax-free up to $250,000, $500,000 on a joint return (IRC 121(b)(1)-(2)),
  only when the home was owned and lived in as the main home for 2 of the 5 years before the sale (121(a)): "24 full
  months or for 730 days (365 x 2)" (26 CFR 1.121-1(c)(1)), whichever comes first. Days are counted from the day after the
  purchase with the sale day included (Pub. 550 Holding Period; 1.121-1(c)(4) Example 3), which is the plain difference of
  the dates. Full months end on the same day of a later month; a purchase on a month's last day completes a month on each
  later month end, and a day the month lacks falls back to its last day (the answer key's convention L1). So a home bought
  2025-05-16 and sold 2026-11-16 has 549 days and 18 months: no exclusion. The page assumes the home has been the main home
  since it was bought (it says so). `test.from` is the first day the test is met. No purchase date: the test is taken as met
  and the gain as long-term, but the page says so (`dateMissing`): it asks for the date and words the tax-free part "if you
  have owned and lived in it two of the last five years".
- **Selling early for a reason** (`reducedReason`, ticked in the details): a sale before two years because of a change of
  workplace, health or unforeseen circumstances keeps part of the cap (121(c)): cap × the share of the two years owned,
  by days (/ 730) or by full months (/ 24), whichever is larger (26 CFR 1.121-3(g)(1): the period "may be expressed in days
  or months"). Whether a reason qualifies is the owner's call (1.121-3(c)-(e) list the safe harbors); the page does not test it.
- **Short or long** (`term`, `longOn`): long-term when held more than one year, counted from the day after the purchase
  (IRC 1222(3); Pub. 550; Tax lots' `longOn`); a year or less is short-term and taxed like pay.
- **The tax**: the federal estimate's total tax with the taxable gain added (to the qualified income when long-term, to
  ordinary income when short-term, and to the investment income for the 3.8% tax) less the total without, in today's tax
  year. So a long-term gain is stacked on the year's other income through that year's own 0/15/20% bands for the filing
  status (IRC 1(h); Form 1040 Qualified Dividends and Capital Gain Tax Worksheet; Rev. Procs. 2024-40, 2025-32), and the
  3.8% falls on the lesser of the gain and the income over the line for the filing status (`niitLine`, from the engine's
  table: 200,000; 250,000 joint or a qualifying surviving spouse; 125,000 separate; IRC 1411(a)(1), (b)); the excluded part
  is not investment income (26 CFR 1.1411-4(d)(3)(ii) Example 3). `niit` is the 3.8% part, the short-term sentence names it
  too, `incomeTax` the rest, `rate` = tax ÷ taxable gain (shown nowhere: the bands matter). Keep = value − costs − mortgage − tax.
- **Filing separately** (two returns): the home's account in one spouse's name puts the whole gain on their return with
  their own $250,000; in neither name it is half each, each half with its own $250,000 (`owners` 2, `cap` 500,000, `capEach`
  250,000): 26 CFR 1.121-2(a)(2), Joint owners: "If taxpayers jointly own a principal residence but file separate returns,
  each taxpayer may exclude from gross income up to $250,000 of gain that is attributable to each taxpayer's interest in the
  property, if the requirements of section 121 have otherwise been met" (read 2026-10-31; the federal estimate halves income
  in neither name the same way). Each half is added to that spouse's return (`addIncome` in taxes/federal).
- Later on 2026-10-31 a review found: filing separately one $250,000 was set against the whole gain on Me's return; no
  purchase date was assumed met without a word; the short-term sentence hid the 3.8%; the 3.8% line said 200,000 for a
  qualifying surviving spouse. All fixed.
- Until 2026-10-31 the page applied the exclusion whatever the dates, taxed every gain at 15% or 20% using 2025's single
  and joint lines for every year and status, and the 3.8% on the whole gain; the answer key found all four (below).
- Ahead: value × (1 + growth, default 3.5%)^years; owed = the mortgage page's schedule `endBalance` for that year
  (0 once it ends). Not in today's dollars.

## Edge cases
- No property account: a hero pointing to Accounts. No mortgage: all of it is yours.
- No purchase price: growth and the gain are not shown; the exclusion is explained. A price without a date: see above.

## Tests
`module.test.mjs`: growth, not ready, the house by hand, a year of costs (with and without a tax figure), selling under the
exclusion, a large gain above it, the years ahead against the mortgage schedule, the two-year test (a February 29 inside,
month ends), the answer key's worked examples (Pat: 4,110 at 18 months, 6,040 short-term, the reduced exclusion 188,013.70;
Quinn: 87,260 with 16,340 of 3.8%), filing separately (a home in neither name: 179,000 on each return, no tax; in one
name: 108,000 taxed, 18,974 with 2,774 of 3.8%), no purchase date flagged, the 3.8% line for a qualifying surviving spouse. `tests/golden-property.test.mjs`: an independent answer key (`tools/golden_property`,
1,500 home sales for 2025 and 2026 worked from IRC 121, 1222, 1(h) and 1411, 26 CFR 1.121-1, 1.121-3 and 1.1411-4, Pub. 523
and the Rev. Procs., never from this code; `tests/golden/property/RULES.md`). Every row agrees since 2026-10-31, the days,
months, test, term and exclusion included. It found four causes, all fixed: the two-year test, the short-term rate, the
flat rate with 2025's lines, and the 3.8% on the whole gain.

## Ideas / not yet
- Refinance and recast live on Debt > Mortgage; a link from here when rates fall below the mortgage's.
- Property tax appeals: the assessment against the value typed here.

## Which return it reads (round 8, batch 1 follow-up)

**(a) This household's own tax year.** The tax on selling the home is the tax it adds to this year's return. Source: the same function the Federal estimate uses, `known()` in `modules/taxes/federal/known.js` (through `taxView()`), so this page and that one quote one marginal rate, one AGI and one tax. The gain is stacked on the Federal estimate's return (`taxView()`), so a retiree's Social Security and withdrawals are in the bracket the gain starts from.

## Year you bought it (2026-11-07, owner's request)
The home's details have a "Year you bought it" box beside the exact date. Blank, it shows our guess in grey and in words ("Our guess:
2024. Most owners your age bought in the last few years."); typed, it is saved as the purchase date, July 1 of that year, unless an exact
date in that year is already there (`purchaseDateFrom`, pure and tested). Changing only the year replaces the date; changing the date
wins over the year. The mortgage's years left, balance and payment follow the year on every page. Not a year, or one still ahead: a
message and nothing saved.

## Links that open the form they promise (2026-11-11, claude-g)
Its "Add ..." / "Update this balance" button opens Net worth with that form open and a way back (`?add=`, `?edit=`, `?back=`; see balance/net-worth README). DP-3, B4.
- "Ahead" no longer speaks of a mortgage paid off when nothing is owed (2026-11-11).

## The tax and insurance inside the mortgage payment, once (2026-11-07, loans lane 1; tests `tests/loans-escrow.test.mjs`)
- Before: a guessed mortgage payment held the usual property tax and home insurance (Debts takes them out of it), and this page
  listed property tax and insurance at $0 beside it (guess sanity HD-ESCROW-ONCE failed on 9 households of 18).
- Now the year of costs reads them from the payment when nothing is typed here: `escrowParts(plan, account, debt, today)`
  (overview/guesses estimators/home.js) splits Debts' figure (`loanEscrow`) as the usual tax and insurance split, and the lines
  read "Property tax, in your mortgage payment" and "Home insurance, in your mortgage payment" (x 12). A figure typed here is the
  one shown. With no split to go by, one line: "Property tax and home insurance, in your mortgage payment". The page notes that
  they come out of the payment and are counted once.
- "We use it to work out the mortgage's years left" under the year bought shows only when it is used (`yearUsed`: the
  mortgage's start comes from the year typed and that year worked out the guessed balance or payment).

## Fix round 1 on the loans lane (2026-11-11, claude-c; tests `tests/loans-escrow.test.mjs`)
After "No, I pay them myself" with nothing typed on this page, the year of costs listed no property tax and no home insurance:
the one answer that hid them. It now lists the usual ones for the home as "Property tax, paid by you (our guess)" and "Home
insurance, paid by you (our guess)" (`usualParts`: estimators/home.js `escrowMonthly`), and says where to type the real ones. A
figure typed here wins, as before. A tax and insurance typed for the loan is listed whole (it was cut to half the payment).

## keeping.js (2026-11-13)
The usual figures (`DEFAULTS`), the tax-free gain (`EXCLUSION`) and the lines of a year of keeping the home (`keepingLines`:
property tax, insurance, dues, upkeep) live in `keeping.js`, a file that reads no page's compute. `compute.js` imports and
re-exports them, so nothing here changed; `modules/retirement/happenings.js` reads the same lines for a home that will be
sold ("Things that will happen" on Will the money last?). It was moved, not copied, so the two can never disagree.

## Smart guesses C6 (2026-11-14)
- Upkeep stays the 1% of the value a year default (`keeping.js` DEFAULTS.maintenance), said on the page under "A year of
  owning it"; the guesses coverage lists it as that fallback. "Fannie Mae's rule of thumb" (spec 12.1) is not written
  anywhere: the source could not be checked on the day.
- **Not built in C6, left for C9:** our guess in the property tax (E23), home insurance (E24) and HOA boxes and the
  purchase-year preview (E19). A blank tax or insurance is counted today from the mortgage payment, or as "paid apart"
  (`keeping.js`); a grey figure in the box must equal that, case by case, and the two hand-written `<details>` of this view
  move to `core/ui/more.js` parts first.

## Work done on the home (gap list, next 60, item 56; map V3; 2026-11-15, claude-b)
A dated list of the work done on the home, one quiet tap away, and one line comparing its last 12 months with the upkeep this
page counts. Information, not advice: arithmetic on what the person typed, no outside figure.

**What a person sees.** The first view is as it was, but for one row at the foot of "A year of owning it", under the upkeep
sentence: **"Work done on the home"** (a `part()` of kind `own`, its title pinned in `qa/first-view-lib.mjs`; no status while
the list is empty, then "1 job", "3 jobs"). Inside:
- an empty list: "Keep a dated list of work on the home: handy when you sell, and a check on the upkeep this page counts." and
  the add form, open (R20): When (today, ready), What was done, What it cost, and under "More details (optional)" A note and
  a tick "Also count this as an improvement". "Add to the list" (the part's own Save; outlined while the home's details are
  open, before a price is saved, so their Save stays the page's one filled button). Nothing is `required` at the box (a shut
  part may hold no required box, first-view check S5): a job with no words or no real day is refused at that box ("Say what
  was done, like "New water heater".", "Pick the day it was done." (also for a day the calendar does not have, 2026-02-30:
  `isDay`), "That day is still ahead: pick the day it was done."), and a ticked improvement with no cost at the cost box
  ("Type what it cost to count it as an improvement, or untick that box.").
- a list: the comparison (below), under it "One year can be uneven: a roof or a furnace comes once in many years." when the
  year's costs are compared with upkeep counted, an outlined **"Use $X a year"** when it applies, the jobs newest first as
  records (what and cost, then the day, "counted as an improvement" when ticked, and the note, an outlined "Remove"), the line
  "A new roof or an addition also lowers the tax when you sell: when you add one, tick "Also count this as an improvement"
  under More details (optional).", and an outlined "+ Add another job" opening the form under it.
- Remove asks first ("Remove "Gutters" from the list?"), then says "Removed "Gutters" from the list." in green with Undo
  (""Gutters" is back on the list."). It takes away the one job tapped, found by its place in the list as drawn and checked by
  its day, words, cost and id (`withoutJob`): a job saved by hand or imported may have no id, and a filter on the id took every
  such job at once. "Use $X a year" asks first ("Count upkeep at $2,150 a year from now on? That is 0.57% of
  the home's $380,000 value; a year of owning it changes with it."), then "Saved. Upkeep is now counted at $2,150 a year (0.57%
  of the value): a year of owning it comes to $18,503." with Undo ("Upkeep is back at $3,800 a year (1.0% of the value).").
  An add says "Added "New water heater", $1,450, to the list.". Each green line is inside the part, which stays open after its
  own save and no other part moves (R7, R17; test "S11").
- "Also count this as an improvement" (s3 fix round 2, critic P4: a new roof had to be typed twice): the job's cost is added
  to the home's `improvements` in the same save (`improvementsWith`: the figure there, blank = $0, plus the cost), the one
  figure the sale here and the retirement projection's home sale read, so no page counts it twice or misses it. The green line
  names the new figure: "Added "New roof", $12,000, to the list and to Improvements, now $27,000: that lowers the tax when you
  sell." Its Remove asks "Remove "New roof" from the list? Its $12,000 also comes off Improvements." and takes off its cost,
  never more than Improvements holds then (`improvementOff`), in the same change Undo takes back. The job keeps
  `improvement: true` so its Remove knows.
- Nothing else in the list changes a figure of the plan: only that tick (Improvements) and "Use $X a year" (the upkeep share).

**Formulas** (`compute.js`: `upkeepLog(d, today)`, pure, from `compute()`'s result; `compute()` itself is unchanged):
- the last 12 months: the days after `yearAgo(today)` (12 calendar months back, a month's last day to that month's last day:
  `addMonthsEnd(today, -12)`) up to today. 2026-11-15: from 2025-11-16 to 2026-11-15. A job dated later is listed, not counted.
- L = the sum of those jobs' costs (an empty cost, work done yourself, is $0); U = the "Upkeep and repairs" line the page
  counts (value x the upkeep share, default 1%; 0 when there is no line); gap = |L - U|.
- start = the list's first day (its oldest job). A job whose day is not a real calendar day (`isDay`: "2026-02-30",
  "2026-13-01", a number) is not listed and not counted, like one with no day.
- the case: no job "empty"; none in the year "none" (U > 0) or "none-no-upkeep"; jobs in the year but none with a cost
  "no-cost" (U > 0) or "no-cost-no-upkeep"; costs, but the list starts after the day a year ago "new" (it cannot show a year
  yet); L > 0 and U = 0 "no-upkeep"; gap < $1 "equal" (as right after "Use $X a year"); gap <= 10% of U "close" (`CLOSE`);
  else "less" or "more". One written sentence per case (`logLine`, each read in full by a test; "equal": "In the last 12
  months you logged $2,150 of work, the same as the yearly upkeep this page counts."):
  "Nothing logged in the last 12 months. This page counts $3,800 a year of upkeep." / "Nothing logged in the last 12 months,
  and this page counts no upkeep." / "In the last 12 months you logged 3 jobs, none with a cost, so there is nothing to compare
  with the $3,800 a year of upkeep this page counts." / "In the last 12 months you logged 2 jobs, none with a cost, and this
  page counts no upkeep." / "Your list starts in March 2026, so it cannot show a whole year yet. So far it holds $18,000 of
  work. Add older jobs with their dates to compare a whole year." ("starts today" when it does; the last sentence is the next
  step, critic P1) / "In the last 12 months you logged $2,150 of work. This page counts no upkeep." / "In the
  last 12 months you logged $3,650 of work, about the $3,800 a year of upkeep this page counts." / "... $2,150 of work,
  $1,650 less than the $3,800 a year ..." / "... $5,000 of work, $1,200 more than the $3,800 a year ...".
- "Use $X a year" (X = L): offered when the list reaches back a year (start on or before the day a year ago), the last 12
  months hold two or more jobs with a cost (`USE_MIN_JOBS`; one roof or furnace is not a year's upkeep, critic P3: the button
  sat beside "One year can be uneven"), X >= $1, the value > 0, gap >= $1 and X / value <= 10% (`USE_MAX`, the details box's
  own limit). It sets the home's `maintenance` (the upkeep is a **share of the value** in the plan, not dollars) to
  X / value rounded to 7 decimals, so value x share rounds back to X: $2,150 / $380,000 = 0.0056579, counted $2,150.00. The year
  of owning it after = the year's total - U + value x share. The share then follows the value, as the page's upkeep always has.
- Ana and Bo (`qa/fixtures/family-plan.mjs`, $380,000): a furnace serviced on 2025-06-12 for $180 (so the list reaches back a
  year), a new water heater on 2026-05-01 for $1,450 and gutters on 2026-09-10 for $700: "In the last 12 months you logged
  $2,150 of work, $1,650 less than the $3,800 a year of upkeep this page counts.", and "Use $2,150 a year" offered.

**Builder's choices.** Upkeep stays a share in the plan (the brief spoke of a yearly figure; the page has always counted a
share of the value), so "Use" writes the share that gives $X today. "About the same" is within 10% (a choice, said here).
"Use" needs two costed jobs in the year (a choice: one large job is compared, not offered; a person whose single job is a
true yearly figure types the share in the home's details). A ticked improvement goes into the one `improvements` figure rather
than being added on top of it in `compute()`, because the retirement projection reads that figure too; a job's Remove takes it
off again so that removing and adding a corrected job never counts it twice. Improvement jobs still count in the upkeep
comparison (the 1% upkeep share is meant to cover a roof spread over its years, as "One year can be uneven" says). No
edit of a job (remove and add again); no categories, no receipts stored (the note can say where the receipt is). The two
hand-written folds ("Update its value", "The home's details") are drawn by `parts()` now, as two rows of one card (importing
the helper makes the page "adopted", and an adopted page draws no `<details>` by hand; R12: no column of folded cards); "Update
its value" says what the value is used for, so the part is worth a tap (R14). The upkeep sentence writes a share under 1% with two
decimals (`sharePct`: "0.57%"; "1.0%" as before from 1%), so the share "Use" sets reads as the figure it gives. To keep the first view's words where they were
(305 for the family), two sentences lost a few words: "to see its growth" (was "to see how it has grown") and "The $7,407 that
pays down the loan" (was "of the mortgage that pays down"). The parts on the first view rose from 2 to 3 (the new row; the
budget is 5). Opt spec C15's whole redesign of this page (a headline sentence, "N more numbers", "How this is worked out",
"N more years") is not done here: with this row it would be six parts, one over the limit, so C15 must merge two first.

**Data.** `property[]` home entry: `jobs?: [{ id, date (YYYY-MM-DD), what, cost? (dollars, null = none), note?, improvement?
(true: counted under Improvements when added) }]` (optional, no version bump; docs/DATA_MODEL.md). Absent = no list, every
figure as before.

**Tests** (`module.test.mjs`): the window (a year ago to the day out, the next day and today in, a later day out); the order;
every case and sentence; "Use" by hand (the share to 7 decimals, $2,150 counted back, none over 10%, at $0, at a value of $0,
when equal, with one costed job, for a list younger than a year); impossible days; Remove of one id-less job; a job from the
form; the improvement tick (added, said, removed with what it added, Undo, refused with no cost, never below $0); invariance over the four fixture plans and the 14 invented households (a list of jobs
changes no figure); the page drawn on the stand-in DOM: the row shut with no status, the form open inside it, opening
writes nothing, S11 (an add keeps only this part open, with its line and "1 job"), remove asked first with Undo, "Use" asked
first with Undo.
