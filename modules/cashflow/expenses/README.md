# Expenses  (`cashflow/expenses`)

**Status:** usable (phase 2)
**Purpose:** Records your expenses by category, amount and frequency, whether each is essential and whether it rises with inflation.

## Inputs
Plan sections read (`needs`): `expenses`, `income` (for "left over"), `household` (through the income compute).
`compute(plan, { today })`: `today` decides which expenses are active.

## Outputs
`items[]` (each expense plus `categoryLabel`, `icon`, `periodLabel`, `monthly`, `yearly`, `active`, `upcoming`, `ended`, `essential`, `inflates`, `oneTime`), `active[]`, `count`, `monthly`, `yearly`, `essentialMonthly`, `optionalMonthly`, `inflatingMonthly`, `oneTime`, `byCategory[]` (`category`, `label`, `icon`, `monthly`, `share`), `income` (`{ monthly, yearly }` or null), `leftOver`, `savingsRate`, `warnings[]`.

## Formulas
- Monthly and yearly amounts: `core/math/periods.js` (`perMonth`, `perYear`); one-offs count only in `oneTime`.
- Essential: the expense's own flag, else the category default in `CATEGORIES` (housing, utilities, groceries, transport, insurance, health, debt, childcare, phone, taxes are must-pay by default).
- Inflates: `inflates !== false` (older items default to rising with prices).
- Category share = category monthly / total monthly.
- Left over = income monthly (from `cashflow/income` compute, same `today`) - expenses monthly. Savings rate = left over / income monthly. Both null without income. This is pay **before tax** minus spending.
- `overspend` (2026-11-01): the before-tax "You spend $X more each month than comes in" sentence on its own (it is also in `warnings`). When Next best action's after-tax figure is ready the view drops it and says "About $X a month more goes out than comes in, after tax and what goes to saving" from `spare.monthly` instead, whichever way it falls: on a household $875 short after tax the page said "$682 more" under the $875 tile, and on one short only after tax it said nothing.
- Loan payments from Debts (F-019 fallback, and the check against them, 2026-11-01): a mortgage whose payment is already filed under housing (an active housing expense whose name says "mortgage", or within 10% of the mortgage's payment) is not added again from Debts; before, it was counted twice whenever no expense was filed under loan payments. Set up my plan's "Home costs" (besides the mortgage) is not the payment, so there the mortgage still comes from Debts. The check accepts filed loan payments that match Debts with or without the mortgage, and says whether a payment seems missing here.
- Your bank shows more going out (round 4, 2026-11-02): when income-statement's `bankVsPlan` is `over`, a card lists each kind the bank shows more of, with "Add $X" (a monthly expense named after the kind, or "Groceries: the rest the bank shows" when some is listed already; must-pay as its kind is), and a link to file what is not filed yet.
- A debt paid off (round 4, 2026-11-02): its listed payment is matched first, by name or its typed payment (`typedPayment` on Debts), and returned in `ended` ([{ debtId, debtName, id, name, monthly }]); it still counts until stopped (the household may still be paying), never stands in for another debt's missing payment, and the page shows "Car loan is paid off" with "Stop Car payment from today" (the expense's end date becomes yesterday) or "It is something else" (opens it). Needs attention and Update my balances say it too.
- Each debt matched to its own expense (round 4, 2026-11-02, `matchDebts`): before, one expense under "Loan and card payments" stopped every Debts payment from counting, so listing the car payment dropped the card's ($400 a month for the family) from spending, the must-pay bills, the cushion target and the left-over figure on every page. Now each debt with a payment (the mortgage left out when it is filed under housing, as above) is matched to an expense under loan payments: first by a word of its name ("Visa payment" for "Visa card"; words every loan shares, such as loan, card, payment, do not count), then by amount within 10% of its payment or its required minimum, the closest pairs first. A debt with no expense is counted from Debts: `debtFromDebts` = the unmatched debts' payments less what is filed but matches no debt (one line for several, or the part of a matched expense more than 10% over its debt's payment), never below 0. `fromDebts` names each one (when nothing filed is left over to cover them) and the page says "Counted from the Debts page...: Visa card $400 a month". Its required minimum is a must-pay (`debtRequired`); an extra set on Debts is a nice-to-have, so must-pay plus nice-to-have is the total. The check compares filed loan payments with the Debts payments they stand for. `qa/households/lib/expect.mjs` (the tester's independent oracle) still has the older rule; no household there lists one loan payment and not another, so the two agree.
- The page's "Left over" tile (2026-11-01, one left-over figure across the app) shows Next best action's `spare.monthly` instead: pay minus federal and payroll tax, spending, retirement saving and goal saving, the same figure as the Dashboard and Set up my plan. Before, the tile showed the before-tax figure as "Left over ... 62% of income", about twice the real amount for the sample family ($8,824 against $4,170). When the tax cannot be worked out yet, the tile is labelled "Before tax" and says tax and saving are not taken out. The next-year sentence no longer adds the before-tax "leaving ..." amount. Needs attention's overspending alert uses the same after-tax figure.

- `closeGap(items, gap, { goalSaving })` (2026-11-01): when the month is short after tax and saving (Next best action's `spare.monthly` below zero), the page shows a "Close the gap" card right under the totals instead of a one-line warning. It names the fewest nice-to-have expenses that close the gap: the largest ones until one of the rest covers what is left, then the smallest of those (so a $400 cut is never offered when a $120 one does it); the last one says how much trimming is enough ("trimming it by $30 is enough") when that is less than the whole. When every nice-to-have together is not enough, it says how much is still short and names the three biggest must-pays. When money goes to goals, it says pausing some of it closes the gap or part of it, with a link to Goals. Each row opens that expense's form. Next best action's first step ("Spend less than comes in") links here, so the step now lands on what to change. The trim is said in the expense's own terms, the amount its form asks for (`trimTo`, rounded down to $5): "$360 once a year instead of $3,000 is enough" for a yearly trip, "trimming it by $30 a month" for a monthly one; each row says "a month" under its amount. When the nice-to-haves are not enough, the biggest must-pays are rows too, so they can be tapped and changed. My choice: fewest items first, because one or two changes are more likely to happen than many small ones; ended, not-yet-started and one-time expenses are never offered.

## Edge cases
No income entered: the income comparison is hidden (null), never shown as 100% savings. Spending above income: a warning sentence. Unknown category: "Other". Amount 0 or missing: warning. End before start: warning.

Retired and drawing from savings as the plan intends (Next best action's `drawing`): the stat reads "From savings ... as your
retirement plan intends" and a calm "Drawn from savings" card replaces Close the gap (2026-11-02).

## Tests
`module.test.mjs`: totals and split, category shares and override of the essential default, income comparison and shortfall warning, upcoming/ended/one-off handling.

## Short on the careful month (review 2026-11-02)
With Side income's "count on" (Next best action's `spare.held` above $0.50), a short month comes from counting uneven pay
at what you can count on. The left-over tile then reads "Short ... in a lean month; when all your uneven pay comes in, $X
is left" (X = `spare.monthly + spare.held`, or "it is still $X short"). The Close the gap card's notice says it counts
uneven pay at what you can count on (Side income) and what a month that brings the Income page's amount leaves; when that full month leaves money (monthly + held ≥ 0) it still lists the
nice-to-haves that make a lean month safe but no longer says "The rest has to come from a must-pay" or lists must-pays:
good months make up for lean ones, with the cash cushion in between. Before, a freelancer whose full month leaves $1,197
was told to cut her rent.

## Is something missing? (smart guesses C7, 2026-11-06; spec 11.6)
When every bill is typed (none our guess, not one rough total), the typed month (bills and loan payments) is under
exp(-2.33 x 0.25) = 0.5585 of what households like this spend (overview/guesses `spendMissing`), and no bank files cover
two whole months, one card under the tiles: "Households like yours usually spend about $5,300 a month. You've listed
$2,565." (the list to the dollar, as the tile above), a "Not listed yet" record (our guesses for Get started's rows with
no bill of their main kind; a row with bills under its other kinds is offered less them, "Utilities and phone, besides
the $95 you listed"; then "With these, your list comes to about $5,000"), "Add our guesses for the rest" (filled; writes
those rows as Get started does, each our guess; "Added our guesses for what wasn't listed: about $2,460 a month. Change
any of them in the list below when you know the real figure.", with an outlined Undo) and "That's everything"
(outlined; `guide.spendComplete`, which ends the question). While the card is up the left-over tile waits ("Depends on
your spending. Your list may be missing about $2,460 a month. See “Is something missing?” just below."; C7 UX review
2). After "That's everything", while the list is still under the line, one muted line under the tiles: "You said this
list is everything." with an outlined "Ask me again" (`spendAskAgain`). Nothing is written before a tap; the notice is
kept in a module-level `missingSaid` for the next render. With two or more whole months of bank files, the rows that
are our guesses become the bank's monthly average instead (R12, overview/guesses README "Spending"), so the bank card
below has nothing to add for them; while bank files are in but set no row yet, one muted line under the tiles says
why and what to do (overview/guesses `spendBankNote`: a card's file missing, a card not in the plan, no checking file,
lines with no kind ("12 bank lines still need a kind. File them, ... Categorize ›"), files over a year old).
Such a row is the person's own months: its ledger spread is `BANK_SPREAD` (0.15, the spending guesses' declared spread
for a row read from the bank), and `guessedMonthly` / `guessedShare` leave it out, so the left-over figure, the cushion and
Next best action no longer wait on it ("Type what you really spend" was asked of someone whose figures were their bank's).
A row whose bank figure equals its earlier survey figure is the bank's all the same (core/estimate `settle` refreshes the
entry's spread when the figure is unchanged; C7 review M9).

**Nothing listed yet** (C7 UX review 8): with the guesses page on and income on file, the empty page offers the same
card as the Dashboard (overview/guesses `fillCard`, all of `fillOffers` with `ignoreLater`). With the spending alone it
is "Not sure what you spend?": "Households like yours (one parent of two owning their home in Ohio on about $58,000 a
year) spend about $3,520 a month. Use our guesses to start, and type your own figures as you learn them.", question 6's
open questions as chips, "Use these guesses" (filled; the spending alone, `only: "spend"`) and "I'll type mine"
(outlined; writes nothing, scrolls to the form). With a debt left out too it is the Dashboard's "Fill in what you
skipped" with the same figures, and "Not now" there does not hide it here.

**The mortgage's servicer** (`mortgageLines(lines, months, pay)`, C7 review M2): of the housing lines in the months
read, those that are the mortgage's: named mortgage or mtg, or within 10% of the payment on Debts (`mortgageFiled`'s
test), or, when none is, the largest payee whose line is in every month, within 10% of the same amount each month and at
least half the payment ("MR COOPER" beside a $1,300 payment typed on Debts). overview/guesses R12 and the Income
statement's bank card use it, so a servicer under another name is the loan's, not "home costs".
Known limit (not changed here): a car payment typed under "Car, gas and transit" is not matched to the car loan on
Debts (`matchDebts` matches only "Loan and card payments" bills), so it counts twice; the guesses no longer add a car
loan beside one (overview/guesses M5).

## Ideas / not yet
- Fill amounts from imported transactions (phase 3): average of the last 3 months per category.
- Per-person expenses for the survivor scenario (phase 8).

## Average markets, said so (round 5, 2026-11-02)
"Drawn from savings": "If markets do as well as average, your plan can carry $X a month of spending and the money lasts; less in
a bad run of years (Will the money last? shows how much less)". The figure is the projection's average-market one.

## Review 2026-11-02, round 5
The full-month figure on the left-over tile ("when all your uneven pay comes in, about $X is left") and in Close the gap is
Next best action's `spare.fullAbout` (to the nearest $10), the one number every page says; the tile used to say "$1,197"
where Next best action said "about $1,200". Test: `module.test.mjs` (the page drawn with a stand-in UI kit, read back as text).

A full month within $5 of $0 (review 2026-11-02, round 5, second review): `spare.fullKind` (cashflow/budget-percent `fullKind`: "ahead", "even" within $5 of $0, "short") decides the words, so it reads "only just about breaks even" instead of "leaves about $0" or "is still about $0 short". The tile reads "when all your uneven pay comes in, it only just about breaks even", Close the gap "Even a
month that brings the Income page's amount only just about breaks even. This is the first thing to fix.", and the must-pays
are offered, as for a short month. Test: `module.test.mjs`.

## Recheck 2026-11-05
The "Bring in ... before adding more here" card reads `bankVsPlan`'s `cardFile` words: its title ("Bring in the card files"
for two cards at one bank with no file for either, as for several cards standing in), "over the last 2 months" (not "whole"
when the months are whole but for those payments) and "their own files aren't in, so what they bought" for several cards.

## Our guesses in the month (smart guesses C3, 2026-11-06)
Get started can leave a bill blank and let the guesses fill it (`plan.guesses`, `core/estimate`; the figures and their
sources are in `modules/overview/guesses/README.md`, "Spending"). Only when the plan holds a guess ledger, `compute()`
adds:
- `guessedMonthly` = the monthly amount of every active bill whose `expenses[id].amount` is a guess, plus every Debts
  payment counted here whose `debts[id].minPayment` is a guess;
- `guessedShare` = guessedMonthly / monthly; `guessedEssential` = the must-pay part of it (a guessed debt payment counts
  at its required payment); `guessedEssentialShare` = guessedEssential / essentialMonthly; `guessedCount`.
A plan with no ledger (every plan made before C3) gets none of these keys, so it computes exactly as before. The view
(designer lane, words only) says "Depends on your spending" in the left-over tile and drops the over-spending warning
while half or more of the month is ours, shows "about $X of it our guesses for now" under Per month, marks each guessed
row "Our guess for now: tap to type yours", and saving a row makes it the person's (`clearGuess`). Tests:
`module.test.mjs` "C3 guessedMonthly and guessedShare".

After the C3 reviews (est/c3/c3-fix.md):
- `ROW_HOLDS`: what each of Get started's rows holds, by category. A row's own categories (setup's `covers`) plus what the
  Consumer Expenditure Surveys put inside it: entertainment (streaming and other subscriptions, pets) in "Eating out and
  fun", personal care in "Shopping and everything else". A bill typed under one of them comes off that row's guess
  (overview/guesses spend.js), and the bank card compares the row with all of them at once (D3, D5). Gifts, travel and
  "other" are in no row.
- `guessedSetupRow(plan, x)`: a `setup-x-*` row whose amount is still our guess (only a path the ledger holds). Such a row
  is never taken for the mortgage's payment, whatever its name or amount, so the mortgage counts from Debts (D1, D1b), and
  at $0 (a typed bill took its place) it is not "has no amount" (D6).
- `addFromBank(draft, line, id)`: the bank card's tap. A line for a row of ours (`line.ours`, from income-statement's
  `bankVsPlan`) makes the plan list what the bank shows for everything the row holds, less what is typed beside it (each
  kind to $10), and clears the guess: the figures are the person's, from their own bank. Before, a bill was added beside
  our guess and the next save took it back off the guess (D3). Each kind is written on its own (`line.ours.parts`): the
  row keeps its own kind, and each other kind it held that the bank shows gets a bill of its own named as the kind
  ("Phone and internet"; the row is then named for its own kind, "Utilities", so nothing reads as the phone twice). A row
  with nothing of its own kind gives way to those bills. The card compares a row of the person's kind by kind, so writing
  the row's whole figure into it made the card offer "Add $170" for the phone the "$390" already held (C3 verify).
  `fromBankWords(said)` is the notice: "Groceries is now $1,020 a month, from your bank." or "From your bank: Utilities
  $220 and Phone and internet $170 a month." Any other line adds "the rest the bank shows" as before.
- The view: "Where it goes" names a kind that is only Get started's rows as the row ("Eating out and fun", "Home
  costs") and draws a kind that is only our guesses with the calm bar and "our guess" (UX 9); "all of it our guesses for
  now" when the whole month is ours; next year to three figures while our guesses are in it; saving a row of ours says
  "Changes saved: Groceries is your figure now."; the list's help line says our other guesses may adjust as you type yours
  (R10).
Tests: setup `module.test.mjs` "C3 review D1", "D1b", "D3", "C3 verify: 'Use' on a row of ours that holds two kinds ..."; this
module's "C3 review D6" and "C3 verify: the bank card's notice names what was written ...".

## Opens short (path part 3, 2026-11-06)
With bills on file the top is the month's total, what is left over and "Next year about ... once prices rise". The rest (must pay and
nice to have, where it goes, the list, the add and edit form) folds under one outlined "See or change each bill", closed when there
are more than 5 bills and half or more of the month is our guesses, open otherwise. Every action that needs the list (a Close-the-gap
row, "It is something else", tapping a row) opens it first. "Debts >" is a 44 px link. Young renter, all guesses: the page body 1,999 px -> 338 px (plus the step card). Nothing in compute changed.

## Path part 3, review fixes
- The bill list opens by **bills typed, not dollars** (`billsFoldOpen` in compute.js): 5 or fewer bills, or at least half listed by the person here. Rows Get started wrote (ids `setup-x-...`, from one total or a split) and rows that are our guesses do not count as typed, so a plan fresh from Get started opens short.
- The tiles read "Bills you have to pay" and "Could be cut"; each bill's note says "a bill you have to pay" or "could be cut".
- "Where it goes" is left out when it would only repeat the list (one row per kind, as Get started writes them).
- When our guess is more than comes in, the left-over tile says so plainly ("probably too high") instead of "about $X short".

## The Debts payments the month carries (round 8 batch 6 review, 2026-11-06)
`debtsCounted: [{ id, monthly }]`: each Debts row (by its account id) whose payment is in `monthly`, and how much of it: a row
matched to a bill at the bill's amount, any other row with a payment at that payment (added from Debts, or covered by a
filed line that matches no debt). A mortgage dropped because a housing bill is the mortgage is listed only when those housing
bills add up to all the mortgages' payments (within 10%), each at its payment: a bill for one of two mortgages drops both from
Debts, and which one it stands for cannot be told. Will the money last? reads it to give a rental's loan payment back after
the loan is paid off only when, and as much as, today's bills hold it. Nothing else here changes. Test: "batch 6" in
`module.test.mjs` (the landlord plan with no loan bill, a bill of $900 for the condo's loan, a "Mortgage payment" bill of
$2,350 for the home alone, one of $3,200 for both).
Known, not changed here: a housing bill for one mortgage drops every mortgage from Debts, so the landlord with "Mortgage
payment" $2,350 has the condo's $851 in no bill (the month is $851 short). Left for the month's owners (batch report).

## Set your month in one number (owner's request, 2026-11-07)
A folded card under the totals: two choices, "I know what's left over" and "I know what I spend" - what is left over each month (how much checking goes up before anything is moved to savings; a minus sign if it goes down) or what you spend each month in all. The other is worked out and written into Get started's spending rows (`overview/setup` `applyLeftOver` / `applyMonthTotal`; formulas, the pay-changes decision and the `guide.setup.spendLeft` note are in that README). The bills listed on this page stay as typed; the rows are what is not listed here. "In all" counts every bill and the Debts payments, so a typed total of $4,200 makes this page's per-month figure $4,200 exactly. If the bills here already add up to more than the figure leaves room for, the card says so (never a negative) and nothing is written. With a note on file the card opens and says when the spending was worked out and, when pay or bills have moved the left-over by $10 or more, what it reads now.

The left-over box asks the phone for the keyboard with a minus sign (`inputmode="text"`, as Get started's box): an iPhone's number pad has none, so "-200" could not be typed (verify 2026-11-07).

## Opened at one expense (2026-11-11, claude-g)
`#/cashflow/expenses?edit=<id>&back=<group/id>` opens that expense's form, once per address, in view (Bills, Subscriptions and
Irregular expenses link their typed rows here). After the save the green line is drawn where the form was and carries "Back to
<that page> ›" (it stays until the next tap instead of leaving after 4 seconds).
