# Pay off debts  (`debt/payoff`)

**Status:** usable (phase 4)
**Purpose:** One plan for every loan and card: the same money each month, highest rate or smallest balance first, and the date each one is gone.

## Inputs
Plan sections read (`needs`): `accounts` and `debts` (through the Debts page compute: a debt needs a rate and a required payment), `debtPlan` (`{ extra, order, customOrder, targets?, lumps?, startedAt? }`). Writes: `debtPlan`.
`debtPlan.lumps` (optional, gap #3, 2026-11-13): one-time payments `[{ id, month: "YYYY-MM", amount, debtId }]`, `amount` > 0 paid
on top that month, < 0 that much less paid that month (a month you can't pay the extra), `debtId` "" for the next debt in the
order. Absent (or empty) changes nothing anywhere.
`debtPlan.startedAt` (optional, gap #29, 2026-11-13): the day the plan started counting, set the first time the plan is saved
here (Save plan, the offer, My own order, a one-time payment) and again only by "Start counting from today".
`compute(plan, { today })`.

## Outputs
`debts[]` (with `required` and `extraSet` beside `minPayment`), `missing[]`, `extra`, `extraSaved`, `order`, `budget`, `required`, `alreadyExtra`, `tie`, `rollover[]`, `plans` (`avalanche`, `snowball`, `custom`: `months`, `endDate`, `totalInterest`, `totalPaid`, `debts[]` with `endDate`, `timeline`), `chosen`, `best`, `plus100`, `baseline`, `hasData`.
Only when a one-time line is saved: `lumps` (the ones still to come, in `payoffPlan`'s form: `{ id, month: the plan's month, amount, debtId }`;
other pages pass them to `payoffPlan`), `lumpLines` (each saved line with its effect, below), `lumpEffect` (`{ monthsSooner,
interestSaved }` of all of them on the chosen order), and each plan's `lumpEffect` and timeline `once`.
Helpers: `lumpMonth(month, today)`, `lumpsOf(plan)`, `lumpLine(...)`, `monthByMonth(x, today)` (the printed sheet's rows), `LUMP_MAX`.

## Formulas
`core/math/payoff.js` `payoffPlan`: each month interest is added (rate / 12 on the opening balance), every debt gets its required payment, and everything left of the budget (required payments + extra, plus payments freed by finished debts) goes to the target debts in order. Avalanche = highest rate first (least interest), snowball = smallest balance first, custom = the owner's order. `plus100` = the chosen order with 100 more a month. Baseline = required payments only.

## Carrying out the Dashboard's next move (2026-11-01, round 2 of the owner's experience list)
The Dashboard's filled "Your next move: Pay down the cards first" opened this page on "$615 required plus $0 extra", a date
years later than Next best action promised and a bare "0" box: the move came without an amount.
- **The offer.** Until an extra has ever been saved here (`extraSaved` false) and Next best action's next step is the costly or
  middling debt, a card offers Next best action's left-over (`spare.monthly`, after tax, bills and saving; floored to $10, at
  least $25): "You have about $4,170 left over each month ... Paid on top of the required payments until it is paid off, the
  Visa card is gone by about January 2027 instead of July 2030, with $3,729 less interest. Then the $4,170 is free again for
  your next step." A filled "Use $4,170 a month" saves `debtPlan = { extra, order, targets }` and confirms in green.
  `offer(plan, { today, amount, stepId })` in compute.js works it out (tested): the step's debts (rate of 10% or more, or 4% to
  10%, mortgages never, as Next best action counts them), the plan run with the extra aimed at them, and null when it would not
  end them sooner (no card then). When the next step is something else (the starter cushion, the match), there is no offer.
- **An aimed extra** (`debtPlan.targets`, 2026-11-01): the extra goes to those debts only, in the chosen order, and stops once
  they are paid off; the payments of finished debts still roll on to the next debt (`core/math/payoff.js` `takesExtra`). Before,
  the offer saved a plain extra, which kept paying $4,170 a month after the card was gone, until the mortgage ended in 2030, while
  the offer had only talked about the card and Next best action had moved on to the next step. The hero says "$2,580 a month
  (the required payments), plus $4,170 more on the Visa card until about January 2027"; the plan card says where the extra goes
  and offers "Keep it going to the next debts" (drops `targets`). Once they are all paid off (`targetsDone`), `extra` is 0, the
  amount is kept (`extraTyped`) and the card offers "Put $4,170 a month on the other debts". The Timeline and Net worth
  projection read the same plan, so they show the card paid off in January 2027 and the mortgage on its own schedule.
- **Live preview.** `params.extra` and `params.order` run the plan with another extra or order without saving; the Extra box (a
  money box: "$2,680") and the order redraw the date at the top as you type, marked "With what you typed below. Save the plan to
  keep it." Saving is still the Save plan button.
- **What the payment is made of.** `required` = the minimums, `alreadyExtra` = extras set on the Debts page (`debts[].extra`),
  `extra` = this page's. The hero reads "$2,790 a month ($2,580 required, $210 extra set on the Debts page)"; it used to say
  "$2,790 required plus $0 extra". Each debt's line reads "$190 a month required plus $210 extra".
- **Roll-over.** `rollover[]`: with no extra chosen here, a debt whose end in the plan is earlier than on its own payment (the
  Debts page's `payoffDate`) gets a line: "Mortgage: March 2039 here because, as the other debts are paid off, their payments
  move to it. On its own payment it ends January 2046, the date on the Debts page." The two pages gave the two dates silently.
- **Ties.** `tie` when every order ends the same month at the same interest (to the dollar): one sentence replaces the three
  equal rows and the trophy. When only some orders tie for least interest, each gets "least interest" and there is no trophy.
- The "$100 more a month" line stays (design log pass 2, round 10) except while the offer is shown, whose amount replaces it.

Pay from savings first (2026-11-02): when Next best action's expensive-debt step has `fromSavings` (cash above the full
cushion), a card at the top says how much and what cash stays, with "I moved it: update my balances"; the monthly offer
waits until then.

## Edge cases
Debts without a rate or payment are listed as missing and left out. A plan whose payments do not cover the interest reports "never" and the debts concerned. Dates need `today`.

## Tests
`tests/payoff.test.mjs` (the math against nper), `tests/debt-pages.test.mjs` and `module.test.mjs` (the page on the shared household; the payment split, the preview overrides, the roll-over and the tie; its S11 test: a lump sum's save opens only One-time payments, Save plan moves no part, and an empty or zero amount says "Type the amount, like 2,500." ("Type how much less, like 300.") at that box, the shut part around it opens and nothing is saved, through a recording stand-in for `ui.fieldError`, whose own opening of a shut section is tested in `tests/ui-kit-helpers.test.mjs`). The math itself is unchanged and still matches the frozen key `tests/golden/debt/payoff.csv`.

## Both dates (`twoDates`, round 4, 2026-11-02)
`twoDates(plan, { today })` lists each debt the plan finishes at least a month sooner than its own payment does: `own` (the Debts page's date, its payment alone), `plan` (this page's: finished debts' payments move onto it, plus any extra), and `from` (the debts finished first, whose payments move onto it). Debts, Mortgage, the Timeline and the Plan summary use it to show both dates and why, so the family's mortgage reads "January 2046 on its own payment, March 2039 on your payoff plan" instead of one date on some pages and the other elsewhere.

## The saved extra, read once (`savedPlan`, review 2026-11-02, round 5)
`savedPlan(plan, { today })` -> `{ extra, ids, names, until, months, ends }` | null: the saved extra a month (`extra`, 0 once
the debts it was aimed at are paid off, then null), the debts it goes to (`ids`: its targets, or every debt when it is
aimed at none, as it rolls from one to the next), when the last of them is gone (`until`, `months`; null when one never
ends) and the chosen order's row for each (`ends`). Next best action's left-over figure and Budget (50/30/20) both take
the extra from it (it was Next best action's own code), so the two pages leave the same money. Test: `module.test.mjs`.

## What is typed moves the whole page (round 8, 2026-11-06)
Typing an extra (or picking another order) redrew only the headline: "When each debt ends", "The three orders, same money"
(and "My own order") stayed on the saved plan, so with $150 typed over a saved $50 the headline said December 2029 and
$5,865 while the list said July 2030 and the orders $7,799. All of them are now drawn by one `drawLists(x)` from the same
live `compute(plan, { today, extra, order })` as the headline, on every keystroke and order change; nothing is saved until
"Save plan", and the headline keeps "With what you typed below. Save the plan to keep it." No formula changed. Check by hand
(an independent loop, interest monthly on the opening balance, required payments, then all spare to the highest rate): the
invented renter (`qa/fixtures/renter-debt-plan.mjs`: $4,500 at 29% / $150, $2,000 at 27% / $70, $3,300 at 24% / $100,
$14,000 at 9% / $350) with $150 extra ends the Visa in month 19 (June 2028), the store card 23, the Mastercard 29 and the
car loan 37 (December 2029), $5,864.75 of interest; smallest balance first $6,058.08. Test: `module.test.mjs` ("round 8"),
the page typed into through `qa/fixtures/fake-dom.mjs`.

## Ideas / not yet
- A payoff timeline drawing (designer), pausing a debt (0% promo). Payments made against the plan (gap #29, batch 5).

## What "nothing extra" means (round 8 review, 2026-11-06)
The last line of "The three orders" said "With the required payments only: 4 years 2 months and $9,623 of interest", which read
as paying the bank's shrinking minimum (Credit cards says that takes 16 to 19 years for one card). It is `baseline`: today's
payments on each debt with no extra, each finished debt's payment moving to the next (`payoffPlan(debts, { extra: 0 })`). It
now says so: "If you pay nothing more than today's required amounts (each finished debt's payment moving to the next): 4 years
2 months and $9,623 of interest" ("today's payments" when the Debts page has an extra on a debt). The rollover note says "If
you keep paying just its own payment, it ends ..." for "On its own payment it ends ...". Test: `module.test.mjs` ("review UX").

## Touch and input stress test (2026-11-11, claude-g)
- **Up keeps what you chose** (j-debt-fixer x-1, D8): Up on "My own order" saves the order together with "My own order" and the
  amount typed above (when it reads as an amount), and says "Visa card moved up to 3rd. Plan saved with this order." under the
  list (not above it, so the rows do not slide under the thumb); the moved row carries a "moved" pill. The sentence says "Tap Up
  to move a debt earlier" (there is no arrow).
- **Save plan checks the box** (D2, DP-4): the money box's own message ("Type an amount in numbers, like 4,500.", "Use 0 or more.",
  "Use 1,000,000 or less.") holds the save; "50..", "abc" and "-50" were saved as $0 under "Plan saved.". The preview reads an
  empty box as $0, as the save does, and a box it cannot read as the saved amount. The cap of $1,000,000 a month is ours (a slip
  guard, not a rule); the green line names what was saved.
- **An extra already set on Debts** (DP-8): the box's label says "on top of the $2,790 you pay now", so it is not typed twice.
- **Debts left out** (D1): each debt with no rate or payment gets its own button to its form (`#/balance/liabilities/<id>`);
  `compute` returns `missingRows: [{ id, name }]` beside `missing`.
- **Follow-ups from two testers (2026-11-11):** the moved debt stays under the thumb after Up (the page scrolls by the row it
  climbed and its Up takes the focus), so two quick Ups move it two places instead of putting the order back. "My own order"
  starts from the order shown before (the saved order, else highest rate first) and a debt the own order lacks goes in at its
  place there; before, unsorted debts fell into A to Z order (`compute`'s `customOrder` is that full order). An extra of $0 is an
  empty box with a grey 0.

## One-time payments, and the page simple first (gap #3, 2026-11-13; opt C9 for this page)

**What a person sees by default.** The same answer as before: "Debt-free by March 2039", its sentence (the money a month, the
order, how long and the interest) and the "$100 more a month" line; the "Your plan" card (the extra box, the order, Save plan);
"When each debt ends", now one line per debt with its month (six, then "N more debts", a debt that never ends always shown);
the roll-over note. Then one card of quiet rows: **"One-time payments · none yet"** ("2 set by you" once saved) and **"How this is
worked out · 3 orders"**, and "More on this" with the two questions that fit these debts (paying only a card's minimum, paying the
mortgage faster, how a lender sees them). First view counted outside shut parts (fake DOM, all three choices of the Order box
counted, a phone shows one): family 263 -> 175 words and 24 -> 7 figures; renter 239 -> 140 and 26 -> 6; the empty plan
unchanged (44, 0). One filled button: Save plan, or the pay-from-savings / offer card's button with Save plan outlined.

**On request.**
- "One-time payments": the saved lines, each one sentence with its effect ("$1,000 in March 2027: debt-free by January 2029
  instead of August 2029, about $519 less interest.") and Remove (with Undo). "Put a lump sum on a debt": When (chips "Next
  month", "March (a tax refund)", "December (a bonus)", soonest first, a chip that is next month not shown twice, and "Type my
  own": months from now), How much, and under "More details (optional)" which debt ("The next one in your order", or one
  debt). "A month you can't pay the extra": When and How much less. Neither amount is a `required` box: only its own
  optional form asks for it, inside a shut part, and the answer never needs it (docs/OPTIONAL.md R9 item 9); an empty one is
  held at the box with the same words ("Type the amount, like 2,500.", `ui.fieldError`), the part opening around it, and
  nothing is saved. The part's title is pinned in the first-view check (a name for the person's saved one-off payments,
  which "Set my own numbers" would not give). With lines saved both forms wait behind outlined buttons
  ("+ Add another lump sum", "A month you can't pay the extra"). A save keeps the part open and the green line names the new
  answer in one sentence per case: "Saved. Debt-free by January 2029 now, instead of August 2029." (then the line's own
  sentence in the list); a remove says "Removed: ... Debt-free by August 2029 now." with Undo ("Put back: ... Debt-free by January 2029 now.").
- "How this is worked out": the four steps in plain words, "Each debt" (its balance, rate, payment, interest to come and "gone
  in ...", moved here from the first view), "The three orders, same money" and the "nothing more than today's payments" line
  (moved here, unchanged), and **"Print the month-by-month plan"** (outlined, Q8): a sheet from `modules/reports/report-kit.js`
  (month, paid, interest, one-time money, each debt's balance, left to pay) drawn for the printer only and printed in place.

**Formulas** (`core/math/payoff.js` `payoffPlan(debts, { ..., lumps })`; `compute.js`):
- Month: `lumpMonth("YYYY-MM", today)` = (year x 12 + month) of the line less that of today. 1 is next month, the plan's first
  payment month. 0 (this month) counts with that first payment, month 1 (cautious: one month's interest on it is counted).
  Below 0 is past: left out of the math, with its own sentence.
- In month m, after interest (balance x rate / 12 on the opening balance, unchanged), the debts' own payments, the extra and
  the payments freed by finished debts:
  - amount > 0: paid to `debtId` while it still owes, else to the first debt in the chosen order; what is left rolls on to the
    next debt in the order. More than all debts owe ends them that month.
  - amount < 0: that month pays min(|amount|, what it would pay above the debts' own payments) less. The debts' own payments
    are always paid.
- `lumpEffect` = the same plan with no lines: months sooner = months without - months with; interest saved = interest without -
  interest with (null where either never ends).
- Each saved line (`lumpLine`): the chosen plan with every line against the same plan without that line, so every line names the
  headline's month. Its kind is the first that applies: past; after (the plan without it is over before its month); never (the
  plan never ends); ends (it ends only with this line); sooner; later; same (same month, $1 or more of interest either way);
  nothing (same month, under $1). One written sentence per kind (`lumpSentence` in view.js), each tested.
- Every plan the page computes (the three orders, the $100 more, the offer) carries the lines; "nothing more than today's
  payments" (`baseline`) does not, and the roll-over note is not given with a line (it would give one reason of two).
- Hand-worked checks (module.test.mjs; by hand and by an independent loop written outside the repo, not this code): $5,000 at 20% with $200 a month: 33 months and $1,522.10 of interest; with $1,000 in month 3
  25 months and $979.56 ($542.54 less, 8 months sooner), the balance $3,644.13 after month 3 by hand (4,883.33, 4,764.72). With
  $150 required + $50 extra and $50 less in month 3: 34 months, $1,554.27. Two debts ($300 at 10% / $100, $2,000 at 15% /
  $100): 13 months, $195.95; $500 in month 6 on the first (gone in month 4) rolls to the second: 10 months, $159.59; $5,000 in
  month 2 ends both that month ($53.25). $10,000 at 24% and $150 never ends; $6,000 next month ends it in 41 months.

**One date across pages (R4-18).** Every page that shows the debt-free month reads this compute (Debts and Mortgage through
`twoDates`, the Timeline, Plan summary, Quick answers, Next best action and Budget through `savedPlan`), so they carry the
lines. Life insurance needs calls `payoffPlan` itself and now passes `pay.lumps` (one line,
`modules/insurance/life-needs/compute.js`). Net worth ahead (`balance/projection`, claude-a's) needs the same line: hand-over.

**Invariance.** With no line saved (absent or `[]`) every compute gives the same output and no new key (module test over the
four fixture plans, the empty plan and the 14 qa households). One-off sweep, base `c5779a2` against this commit, over 1,404 plans
(the fixtures and every qa household with every pack): Pay off debts' compute, `savedPlan`, `twoDates`, `offer`, Consolidation
and Next best action, 8,424 results byte-identical; Life insurance needs, Net worth ahead, Plan summary and the Timeline,
5,616 results byte-identical.

**Sources** (read 2026-11-13):
- Undebt.it, "How Debt Snowflakes Can Help Your Debt Snowball" (undebt.it/blog/using-debt-snowflakes/): a snowflake is a one-time
  amount in a month, on top of the snowball payment; "snowflakes can be positive or negative": $400 of extra Christmas spending
  lowers that December's snowball payment from $500 to $100. Design reference only: no code was read or copied.
- IRS, 2026 filing season statistics (irs.gov newsroom, weeks ending March 13, March 27 and May 8, 2026): 50,391,000 refunds by
  March 13, 62,957,000 by March 27, 99,138,000 by May 8 (page updated 2026-05-18). Half of the season's refunds were paid by
  mid-March and about two in three by the end of March, hence the chip "March (a tax refund)".
- The interest convention (balance x rate / 12 on the opening balance) is the page's own, unchanged; the golden key
  `tests/golden/debt/payoff.csv` still passes (it has no lines).

**Builder chose** (the spec left these open):
1. **March, not April, for the tax refund chip**: the IRS's own counts above (the design said April).
2. **A month that pays less** takes the amount from everything paid above the debts' own payments that month (the extra, then the
   payments freed by finished debts), not from the extra alone: "how much less" is what the person will pay less, and Undebt.it's
   negative snowflake lowers the whole snowball payment the same way. It never goes below the debts' own payments.
3. **This month** counts with the plan's first payment (next month), the cautious side; a month before is past.
4. **Each line's effect is marginal**: the plan with every line against the plan without that one, so each line's "debt-free by"
   is the headline's.
5. **"Type my own" is months from now** (1 is next month), because the helper's box is a number box; the chosen month is written
   under the chips ("In March 2027.") and a typed one shows as "Yours: June 2027".
6. **When the chips go**: they sit at the top of their form (`choice()` is not a kit field), the amount under them, the debt under
   "More details (optional)".
7. **The first view** keeps one line per debt with its month only; each debt's balance, rate, payment, interest to come and how
   long moved to "Each debt" in "How this is worked out", with "The three orders, same money" and the baseline line (opt spec 6.1:
   "How this is worked out (the three orders, same money)"). "More on this" has two rows so the first view stays short.
8. **Save plan is outlined** while the pay-from-savings card or the offer card holds the page's one filled action (R18).
9. **The printed sheet** prints the saved plan, not what is typed in the box.
10. **The last line removed** removes `debtPlan.lumps` itself (no empty list is kept).

Tests: `module.test.mjs`, "gap #3" (math, compute, every sentence, the page's saves through a live store, one filled button, the
invariance, one date on Pay off debts, Debts and Life insurance needs). Failing first: the final tests against the base code
(`c5779a2`) with only the new helpers added so the file loads: 17 of 31 fail (every math, compute, sentence and page
case); 14 pass: the 12 earlier tests but round 8 (its rows moved into "How this is worked out"), the invariance guards and
"a bigger lump is never later" (true of code that ignores lumps; they guard, they do not prove).

## Against your plan (gap #29, 2026-11-13)
Other debt apps show how you are doing against your plan as you pay (Undebt.it's progress against the schedule; design only,
no code taken). Here it is one quiet row, **"Against your plan"**, after "How this is worked out", only once a month has gone by
since the plan started counting (`debtPlan.startedAt`) and a debt in the plan has a balance from on or before that day. Before
then nothing on the page changes. Its few words: "2 months ahead", "on track", "1 month behind", "owe more", or "update
balances" while no debt has a balance dated after the start.

Opened: "You owe $4,000. Your plan said $4,302 by now: about 1 month ahead." With two or more debts, a record for each: what
you owe and on what day, what the plan said, ahead or behind. Debts with no balance from the start day (added later) are named
as not counted. A last line says what is counted, and an outlined **"Start counting from today"** sets the start again (after a
big change of plan, a new debt, a refinance).

`against(plan, { today })` (pure, compute.js):
- The balance on the start day: the account's history point (or its balance on file) dated on or nearest before
  `startedAt`. What you owe now: its latest point, which must be dated after the start.
- The plan's path: `payoffPlan` (core/math/payoff.js) run from those start-day balances with the plan saved now (extra,
  order, own order, the debts an extra is aimed at, one-time payments placed by months from the start month, as
  `lumpMonth(month, startedAt)`) and each debt's payment today.
- By now: m = whole months from the start to the newer balance's day (`monthsBetween`); the plan's balance by then is its
  month-m balance (month 0 is the start balance; after the plan's last month, 0).
- Ahead or behind: the month t the plan's balance comes down to what is owed now, read in a straight line between the plan's
  months either side of it; ahead = round(t - m) (above 0 ahead, below 0 behind). Within ON_TRACK_DOLLARS ($1, ours: balances
  are typed to the cent) of the plan's balance is on track; under half a month either way rounds to on track. More owed than
  on the start day: "more than at the start", no month count.
- All together: the same on the plan's total of the debts with a newer balance, at the latest of those days.

By hand (module.test.mjs): $10,000 at 12% with $500 a month: 9,600, 9,196, 8,787.96, 8,375.84, 7,959.60 after months 1 to 5. Four
months in, $8,375.84 is on track; $8,000 is month 4.90, 1 ahead; $8,700 is month 3.21, 1 behind; $9,300 month 1.74, 2 behind; $0 is
the plan's last month, 23, so 19 ahead; $10,500 is more than at the start. A $1,000 one-time payment in September (month 2 from
July) makes the path 9,600, 8,196, 7,777.96, 7,355.74.

Choices (owner: decide sensibly and note it): the plan compared is the one saved now, not a copy kept from the start day (one
saved plan, no history of plans to store); today's payments are used for the whole path; a debt paid off since the start
stays in (its newer balance is $0). A month is the least gap worth a row.

Tests: `module.test.mjs`, "gap #29" (on track, ahead and behind by hand, owe more, waiting, no row, a one-time payment in the
path, the start day stamped once and again only on request, the page's row, its words and its button).
