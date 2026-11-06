# Income statement  (`cashflow/income-statement`)

**Status:** usable (phase 3)
**Purpose:** What came in, what went out and what you kept, month by month, from your real transactions; next to what the Income and Expenses pages say should happen.

## Inputs
Plan sections read (`needs`): `transactions`, `categories`, `income`, `expenses` (the last two through their computes). Writes nothing.
`compute(plan, { months = 12, today })`.

## Outputs
`rows[]` newest first: `{ ym, label, in, out, net, rate, count, uncategorised, complete }`; `totals` and `average` (complete months only); `planned` (`{ in, takeHomeIn, takeHome, out, net }` per month from the Income/Expenses pages, or null), `inGap`, `inShort`; `byCategory.in[]` / `.out[]`; `hasData`.

## Formulas
- Transfers (`isTransfer`) are excluded.
- A transaction counts as income if its category's kind is income, as spending if the kind is expense; uncategorised lines go by sign (money in = income). A refund filed under a spending category reduces that month's spending.
- Net = in - out; rate = net / in when in > 0.
- `complete` = the month is before the month of `today`; averages use complete months only so the current month does not drag them down.
- Plan versus real, money in (2026-11-01, round 2 of the owner's experience list): the bank sees pay after tax, so the plan's money in is compared at take-home, `takeHomeIn` = `cashflow/paycheck` `takeHome().monthly` (each salary at its earner's take-home share, other income as typed). `inGap` = average money in over complete months - `takeHomeIn`; `inShort` when it is below by more than `IN_BAND` = 10% of `takeHomeIn` (and $50). The band is my choice: pay every two weeks puts two paychecks in most months, 12/13 of the average month (7.7% below), so a tighter band would call ordinary months short. Before, the page compared pay before tax with deposits, showed the sample family "Income page says $14,250 a month; the bank shows $10,318" in red and said "Fix whichever is wrong", which invited typing take-home pay over the salary and breaking tax and retirement everywhere.
- The plan's sentence in the empty state uses Next best action's own figures, so it adds up: "$14,250 a month comes in before tax; about $2,385 goes to tax, $5,426 to spending and $2,268 to saving, so about $4,170 a month is left" (tax = `federalTax + payrollTax`, saving = `retirementSaving + goalSaving`, left = `spare.monthly`, the Dashboard's figure). It names the tax rather than an "after tax" amount ($11,865), which sat next to the Income page's take-home ($11,398, which also takes out the 401(k) and health cover) as a second figure for the same thing. The Paycheck page's take-home is kept for Plan versus real, where it meets the bank's deposits. `planned.net` (before tax) stays in the output for the reports that read it.

## Bank versus plan (round 4, 2026-11-02): `bankVsPlan`
What the bank files show going out, on average over the whole months they cover (the last 6 at most, at least 2: a month
is whole when the files reach within 3 days of each end, ledger `monthCover`), against what Expenses lists, plus a saved
Pay off debts extra. Transfers between your own accounts and taxes are left out on both sides. `over` when the bank
shows at least $200 a month and 10% more (`BANK_OVER`, my choice: below that, a quarterly bill or a busy month explains
it). That direction is safe: a card or account whose file is missing makes the bank show less, never more. `lines`: each
kind of spending the bank shows $50 a month or more above Expenses, largest first; `unfiled`: bank spending not filed
under a kind yet. Read by the Dashboard (setup `standing`: headline, an amber left-over row, first move "Add what your
bank shows to Expenses"), Expenses (a card with "Add $X" for each kind) and Needs attention (`bank-over`). Before, every
figure came from the typed Expenses only, so a household whose bank showed it short was told "Your month works".

Rows of ours (smart guesses C3 review, D3, 2026-11-06): one of Get started's spending rows whose amount is still our guess
holds several kinds at once (Expenses' `ROW_HOLDS`: "Eating out and fun" holds fun, subscriptions and pets), so the bank is
compared with the row as a whole: one line named as the row (bank = the bank over all the kinds it holds, plan = Expenses
over the same kinds), with `ours: { id, amount, to, parts }`, where `to` = the row's amount + bank - plan, to $10: the
figure that makes the plan's kinds what the bank shows, and `parts` = the same kind by kind (the bank's figure for each kind
less what is typed beside the row in it, never below 0). Expenses' "Use $X" writes `parts` and clears the guess
(`addFromBank`): the row keeps its own kind and each other kind gets a bill of its own, because once the row is the
person's this card compares it kind by kind (a whole `to` in the row left the phone in "Utilities and phone" to be offered
again; C3 verify). Only a plan with such a row gets these lines; every other plan's lines are as before. Tests: setup
`module.test.mjs` "C3 review D3" and "C3 verify: 'Use' on a row of ours that holds two kinds ...".

## A card whose file is missing, and holes between files (2026-11-02)
The sample family's Visa card had no lines and its autopays from checking were filed as transfers, so the page said "Kept
$26,784, 61%" with about $2,700 a month of card purchases missing; and the typical month averaged August, which is missing
the mortgage of Aug 2 and a paycheck of Aug 1 (no Chase lines from 7/31 to 8/2).
- Rows add `allUnimportedCardLines(plan)` (Transactions > Ledger): each payment to a card with no lines of its own that month
  counts as money out, in `cards` too, and on the out side as one entry per card, "Visa card, details not imported yet"
  (`unimported: true`, not a bank line, so `count` and `uncategorised` leave it out). Once the card has a line in the month it
  is gone. The family: out $26,131.74 (was $17,450.45), kept $18,102 (41%).
- `holes` per row (`monthHoles`: holes in any account's files reaching into the month), `whole` = complete with no hole; the
  `average` (the typical month) is over whole months only, so a month missing a paycheck and the mortgage no longer pulls it.
  The family: September and October, $11,762 in, $8,090 out, $3,672 kept (was four months, $5,572 kept).
- `bankVsPlan`: whole months now also need no hole in any account's files; the card stand-ins count in `bankOut` and in
  `cards` (a month), never in a kind's `lines` (they are no kind yet). The old note ("a missing file makes the bank show less,
  never more") was the reason the Dashboard said "Your month works": the family now reads $8,090 a month out against $5,826
  listed, `over`, so the Dashboard says "Your bank shows about $2,260 a month more going out than your plan lists".
- Review (2026-11-02): `whole` = complete and Ledger `monthGaps().whole` (no hole, no account whose lines stop early or start
  late: a Visa file from 8/20 leaves August out); rows carry `missing` (the gaps in short words) and `cardsBy` (the stand-ins
  per card), and `leftOut: [{ yms, why }]` groups the complete months left out of the typical month by their first gap
  (plan3: July and August, "Chase checking has no lines from 7/31 to 8/2"). A card's stand-in line names its months when it
  is not in every month that is over: "Visa card (July), details not imported yet" once the Visa's file is in from August.
- `bankVsPlan` (re-check 4, 2026-11-02, decision 5): whole months by Ledger `wholeMonth`. A card whose own file is missing
  is never in `bankOut`, `gap` or `over`: nobody has seen what its payments bought, so Expenses can offer no kind for them and
  "add what your bank shows" could never be finished (after every Add, plan3 still read over). They are `cards` (a month)
  and `cardsUnfiled: [{ accountId, name, monthly }]`; `gapWithCards` = `gap` + `cards`; `cardsGap` when not `over` but
  `gapWithCards` would be; then `cardFile` = `{ accountId, name, title: "Bring in the Visa file", the: "the Visa card",
  monthly, href: "#/transactions/import?accountId=a-visa" }`. plan3: `bankOut` $5,294.90 (was $8,090.33 with the card),
  `gap` -$531.43, `cards` $2,795.43, `gapWithCards` $2,263.99, `over` false, `cardsGap` true. The Dashboard's next move,
  Get started's tile (setup `standing`: "Bring in the Visa file", "About $2,800 a month went to the Visa card, but its own
  file isn't in, so what it bought can't be checked against your plan yet."), Needs attention (`bank-card`, opening that
  card's import) and Expenses ("Bring in the Visa file before adding more here", with the button) say so. After tapping
  every Add on Expenses: `gap` -$1,351.43, `gapWithCards` $1,443.99, still "Bring in the Visa file".
- `unsure: [{ ym, text }]` and the rows' `unsure`: a month with a payment counted for neither of two cards (Ledger
  `unsureCardPayments`) is not whole, left out of the typical month and bank versus plan with the one sentence ("$2,610
  went to one of your Chase cards in October; bring in the card files to see what it bought"); a row with only that gets the
  pill "a card's file missing". With every month like that there is no typical month: the page says so and why.
- A card's line in a month before its first line reads "Visa card (July), before its file starts on 8/1" (Ledger
  `beforeLabel`), the same words as Spending, Budget and the Monthly review.
- Re-check (2026-11-02, rule 6): `whole` = complete and Ledger `wholeMonth` (the files together reach both ends, and no
  account's files have a hole in it, stop early or start late), the same question bank versus plan and Budget ask. It had
  asked `monthGaps().whole` only: plan3 from 8/1 with Ally interest on 7/31 averaged a July of $12.50 in and $0 out, so the
  typical month read $5,473.76 out; now August to October, $7,298.34, the same as bank versus plan. A household whose typical
  month counted a month the files only partly span (dc6e73c averaged every month that was over) now leaves it out too.
  Rows carry `why` (the first gap, or "your files start on 7/31"), which `leftOut` groups by.
- `average.cards` and `average.cardsBy: [{ cardId, name, monthly }]`: of the typical month's money out, what went to cards
  whose own file isn't in. The page says "the bank shows $8,090, of which $2,795 went to the Visa card, whose file isn't in",
  and when the gap left without them is $50 or less: "Most of the gap in money out is what went to the Visa card: what it
  bought isn't in yet. Bring in the Visa file. Then compare again before adding anything to Expenses." with the button, the
  figure not marked bad. The months left out are said under the totals ("July and August 2026 are left out of the typical
  month: Chase checking has no lines from 7/31 to 8/2."); a month with days missing gets a "days missing" pill and its
  reasons; the card's line reads "4 payments to the card · tap to bring in its file" and opens the card's import.

## Re-check 4 figures (2026-11-02)
plan3 unchanged: July $4,189.71, August $5,714.38, September $8,727.03, October $7,453.62, November $46.80 out; typical month
September and October, $8,090.33 out. One checking file a month (8/3-8/29, 9/1-9/26, 10/1-10/31, no card): no hole, three
typical months of $4,205.78 (as dc6e73c), bank versus plan $4,205.78 against Expenses, -$1,220.55.

## The bank's mortgage line (smart guesses C7, 2026-11-06)
A mortgage counted from Debts (none typed under housing on Expenses: Expenses' `fromDebts`) is often paid from checking
and filed by the bank under housing. `bankVsPlan` now compares such a line (a housing line named mortgage or mtg, or
within 10% of the mortgage's payment, Expenses' own test for a typed one) with loan payments, where the plan counts it.
Before, it read as that much more spent on the home ("Home costs: $1,600 more") and "Use" on Get started's home-costs row
(our guess) set the row to the mortgage plus the upkeep, counting the payment twice. `bankOut`, `planOut` and `gap` do
not move; only the kind a line is compared under. Test: module.test.mjs "C7: the bank's mortgage line ...".
C7 review M2: the servicer's lines are Expenses' `mortgageLines` (also a servicer under another name, "MR COOPER", found
by its line in every month near the same amount and at least half the payment). Each servicer line is split: up to the
payment on Debts still owed that month goes under loan payments, the rest (its tax and insurance, or a payment typed
low) stays under housing, so the gap is the same and a payment typed lower than the bank's shows as home costs, not as
nothing.

## Edge cases
No transactions: empty state, plus the planned figures if entered. Months with only transfers do not appear.

## Tests
`module.test.mjs`: empty and planned, month rows and completeness, uncategorised money in as income, totals/averages, category lists, the `months` cap; money in compared at take-home (exact, 8% below, 20% below). The card stand-in on the sample family (October out $4,843.32 + $2,610.30, the year's four payments, the typical month over September and October only, bank versus plan over and the Dashboard's headline) and on a small plan where it goes once the card has lines (out $2,140 -> $1,590) (2026-11-02). Re-check: finding 5 (rule 6: August to October, $7,298.34 out, the same as bank versus plan, July left out as "your files start on 7/31"), finding 4 (quarterly savings and no card: bank versus plan and the typical month over 3 months, $4,617.99), and the typical month's card part on plan3 ($2,795.43 of $8,090.33). Re-check 4: money 1 (one file a month: 3 months, $4,205.78, bank versus plan -$1,220.55), money 2 (a Discover savings transfer: the typical month stays $8,090.33), money 4 (a payment for one of two Chase cards: no typical month, each month's sentence, no bank check), pages 1 (the next move and Needs attention are the Visa file, before and after every Add) and pages 4 ("Visa card (July), before its file starts on 8/1").

## The planned sentence adds up (review 2026-11-02)
Before a bank file is imported, the sentence from the Income and Expenses pages names every line Next best action takes
off the month: business costs, tax (federal, Social Security and Medicare, and the state's), spending, saving, the extra on
debts, and side income above what you count on (after its tax) "kept as a bonus to save when it comes", each only when it
is $1 or more, so pay before tax minus the lines is the "left" or "short" figure. Before, state tax and the part held back
were missing: a freelancer read "$7,100 comes in; $1,488 to tax and $4,180 to spending, so $770 is short" (those lines
leave +$1,432).

## Ideas / not yet
- Yearly view and year-over-year; export to CSV; budget lines next to actuals (phase 4).

## Recheck 2026-11-05
- **Two cards at one bank, no file for either.** No month is whole (a payment went to one of the two and is counted for
  neither), so `bankVsPlan` returned null and the Dashboard said "Your month works". Now, when there are fewer than
  `BANK_OVER.minMonths` whole months, the months whole but for those payments (no hole, no account stopping early or
  starting late) are looked at too; the payments counted for neither card join `cards` (they went to one of the cards).
  When `gapWithCards` is over (the same test as one card's), it returns `months: 0`, `over: false`, `lines: []`,
  `cardsGap: true` and `cardFile` = { title "Bring in the card files", the "your Chase cards", monthly, months (looked at),
  whole: false, plural: true, href to the first card }; otherwise null. Freedom and Sapphire at Chase on plan3: September
  and October, bank $5,294.90 a month against Expenses' $5,826.33 (-$531.43); with (2,980.55 + 2,610.30) / 2 = $2,795.43 a
  month to the cards, $2,263.99 over: "About $2,800 a month went to your Chase cards". One card's `cardFile` gains
  `months` (2), `whole` (true) and `plural` (false); several cards standing in now read "Bring in the card files" too.
- **The months left out are named newest first.** `leftOut` is ordered by each group's newest month, newest first; the
  page names the first two, which were July and August on that plan and are now October and September.
- Tests: bank versus plan for Freedom and Sapphire (months 0, the gap, `cardFile`, the two unsure months), the Dashboard's
  first move, headline and Needs attention for them, one card's words unchanged, `leftOut` newest first; the round-4 test
  that expected null now expects the card files.
- **Verification (same date): a gap the bank's own lines already show is never hidden behind the card files.** In a month
  whole but for payments counted for neither card, checking's lines are a floor: what the cards bought only adds to them.
  So `over` is the same test as in whole months, and when it holds `bankVsPlan` returns `months` n, `over: true` and its
  `lines` (with `unsure` and `cards` as before) instead of `months: 0` and the card files. Freedom and Sapphire at Chase with
  Expenses listing $4,073.00: bank $5,294.90, $1,221.90 more, over $407.30: the Dashboard says "Your bank shows about $1,220
  a month more going out" (it said "your bank can't be checked against your plan yet"). Test: "verify 5, D".
