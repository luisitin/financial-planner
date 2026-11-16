# Sharing costs as a couple  (`cashflow/shared-costs`)

**Status:** usable (gap design #22, built 2026-11-13; bills split with others, gap list next 60 item 17, built 2026-11-16)
**Purpose:** How two people who share costs split them: by what each takes home, half each or your own split, and what
each keeps for themselves. One quiet row also keeps bills split with others (roommates, friends, a trip) and who owes
whom (section "Bills split with others").

## Inputs
Plan sections read (`needs`): `household.people` (who the couple is), `income` (each person's pay), `expenses` (the costs),
`debts` (payments the Expenses month adds from the Debts page), and through the Paycheck page's `takeHome()` the
`retirement.contributions`, `taxes`, `accounts` and `whatIfs.paycheck` / `whatIfs.benefits` it reads; `whatIfs.shareCosts`
(this page's own choices); `splitBills` (bills split with others, read only by `split.js`).

`whatIfs.shareCosts?: { method: "income" | "equal" | "own", own: { [personId]: fraction }, leaveOut: [cost id] }` (optional,
no version bump, `docs/DATA_MODEL.md`): a what-if, never counted in the plan. A cost id is an expense id, `debt:<id>` for a
payment the Debts page adds to the month, or `debts` when those payments are counted together. Absent: by income, every
cost shared.

Parameters accepted by `compute(plan, params)`: `today` (ISO date; which income and costs are going now).

## Outputs
`{ ready: false, why: "one-adult" }` with fewer than two adults. Otherwise:
- `case`: which sentence the page says (`no-costs`, `none-shared`, `no-income`, `one-earner`, `income`, `equal`, `own`).
- `method` (as worked: "own" without usable shares is "income"), `asked` (as saved), `basis` ("take-home" when any of the
  couple's income is the Paycheck page's take-home, else "income": as typed).
- `costs` `[{ id, name, category, monthly, fromDebts, shared }]` (largest first), `count`, `sharedCount`, `shared` (a month),
  `taxes` (taxes not withheld on Expenses, left out).
- `people` `[{ key, id, income, gross, scaled, share, percent, part, dollars, keeps }]` for the two adults.
- `total`, `household`, `leftOut`, `others`, `byIncome`, `byIncomeDollars`, `over`, `short` (see `compute.js`).
Names are not in the result (the view reads them from the plan), so "Explain this page" sees only ids.

## Formulas
- **Shared costs** = Σ over the costs checked as shared of each cost a month: `amount × times a year ÷ 12`
  (`core/math/periods.js`: weekly 52, every two weeks 26, twice a month 24, monthly 12, quarterly 4, yearly 1; a one-time
  cost is not monthly). The costs are the Expenses page's month (`cashflow/expenses` `compute`): every bill going on
  `today`, plus each Debts payment that page adds (a debt with no bill of its own). Taxes not withheld are left out (they
  come off the income of whoever earns it, as Budget (50/30/20) leaves them out).
- **Each person's income** a month = Σ of their going income lines (`personId`) × the Paycheck page's take-home share
  (`cashflow/paycheck` `takeHome().ratio`: a salary × its earner's take-home over pay, after tax withheld, Social Security,
  Medicare, the 401(k) and benefits; a bonus × (1 − 22% − 6.2% − 1.45% − the state's share); every other kind as typed)
  + ½ × the household's own income (lines tied to no one, or to someone no longer in the plan). A child's or another
  adult's income is left out. The design asked for Budget (50/30/20)'s per-person taxes "where it splits them, else gross
  pay": that page works out the household's taxes as one, so the Paycheck page's per-earner take-home is used (the figure
  Forecast and the Income statement already use); with no paycheck to work from it is the income as typed, and the page
  says "the same shares as your income" instead of "take-home pay". "How this is worked out" says which.
- **Shares.** By income: `shareᵢ = incomeᵢ ÷ (income_a + income_b)` (one earner: 1 and 0; neither: none). Half each: ½ and ½.
  Your own: as typed (`ownShares`: both typed are scaled to add up to 1; one typed, the other has the rest; nothing usable
  splits by income).
- **Parts.** `partᵢ = shareᵢ × shared`; on screen whole dollars by the largest remainder (`dollars()`), so the two add up to
  the shared costs to the dollar; percents the same way (`hundred()` from the Paycheck page), adding up to 100.
- **What each keeps** = `incomeᵢ − partᵢ`.
- **Alarms** (amber, never folded): shared costs more than both incomes by over $0.50; else, half each or your own split,
  neither has pay (all of the shared costs come from savings: "Neither of you has pay on Income, so all $3,900 a month of
  shared costs has to come from savings.") or one person's part more than their income.
- Example (tests): Ana $6,000 and Bo $4,000 a month, costs $2,400 + $225 a week + $525 = $3,900: 60% and 40%, $2,340 and
  $1,560. The family fixture: $5,826 of costs, take-home $6,257 and $5,142, so 55% and 45%, $3,198 and $2,628.
- **Sources** (read 2026-11-13). The arithmetic is the method itself; no outside figure is used.
  - National Bank of Canada, "How to split expenses as a couple" (page title "Sharing Expenses as a Couple: What Approach
    to Take?", dated 04 October 2023),
    https://www.nbc.ca/personal/advice/budget/sharing-expenses-as-a-couple-what-approach-to-take.html, read 2026-11-13:
    "First, you calculate what percentage of the total household income each partner earns. You then apply these
    percentages to the total monthly budget." Their example: $60,000 and $40,000 a year are 60% and 40%; "Since 60% of
    $5,000 is $3,000 and 40% is $2,000, you have to transfer $3,000 a month into your joint account." On half each: "While
    this technique may be the simplest approach, it's only fair if both partners have similar incomes." and "If there's a
    significant difference between your incomes, the best strategy is to split expenses proportionately."
  - Splitwise Help Center, "What are different ways I can split an expense?",
    https://kb.splitwise.com/balances-and-expenses/what-are-different-ways-i-can-split-an-expense, read 2026-11-13 (the
    old address, splitwise.uservoice.com article 77463, now leads here): "Equally: The default.", "By percentage: Enter the
    percentage of the total each person should pay.", "By shares: Assign a number of shares to each person."; a design
    reference for "Our own split".

## First view and parts
Simple first (`docs/OPTIONAL.md`), an answer page.

First view, in order:
1. The headline and its one sentence (`answerFor`, one per case, each tested):

| case | headline | sentence |
|---|---|---|
| one adult (also the empty plan) | Split a bill with friends or roommates (`SOLO` in `split.js`; `answerFor` still says "Sharing costs as a couple" / "This is for two people who share costs." for any other reader) | Add each bill you share, and this works out who owes whom. (+ filled "Add a bill", which opens "Bills split with others" at its add form, and the quiet line "Sharing costs with a partner? Add them on People") |
| no costs | No costs to share yet | List the bills you pay each month on Expenses, and this page splits them between you. (+ filled "Open Expenses") |
| none checked | No costs are checked as shared | Check the ones you share under "Which costs are shared" below. (that part opens) |
| neither has pay | Neither of you has pay on Income yet | Add what each of you earns on Income to split by it, or pick Half each. (+ filled "Open Income") |
| one earner | Splitting by income: Ana covers all $3,900 a month. | Bo has no pay on Income, so Ana covers it all. Or pick Half each. |
| by income | Splitting by income: Ana puts in $2,340 a month, Bo $1,560. | That is 60% and 40%, the same shares as your take-home pay. (or "... as your income.") |
| half each | Half each: Ana and Bo each put in $1,950 a month. (or "Ana puts in $1,951 a month, Bo $1,950.") | Split by income, Ana would put in $2,340 and Bo $1,560. (or "That splits $3,901 of shared costs a month down the middle.") |
| own split | Your own split: Ana puts in $2,535 a month, Bo $1,365. | That is 65% and 35% of $3,900 of shared costs a month. |

   "Me" reads "you", "My spouse" "your spouse" (`core/words.js`).
2. Three chips (`choice()`): "By income" (default), "Half each", "Our own split". "Our own split" starts from the split on
   screen (to the whole percent, so nothing jumps) and shows one box in place: "Ana's share of the shared costs" (%),
   "Bo puts in the rest: 40%." A chip tap or the box's change saves; the green line under the chips names the new answer
   ("Saved. Half each: Ana and Bo each put in $1,950 a month.").
3. The alarm, if any (amber).
4. One parts card:

| part | kind and title | holds | status |
|---|---|---|---|
| `keeps` | more, "4 more numbers" (what each keeps for themselves: the rest of the figures, so the vocabulary's title, R24; the design called it "What each keeps for themselves"). N is the figures it adds to the first view, two a person: what each takes home and what is left (each one's part is in the answer already; it said "2", the people, until integ2-fix3) | each person: what they take home, what they put in, what is left | - |
| `costs` | own, "Which costs are shared" (pinned in the first-view check's list: ticks, not numbers, so not "Set my own numbers") | one checkbox per cost, largest first, with its amount a month; Save "Save the shared costs" | "all 13 shared" / "12 of 13 shared" |
| `bills` | own, "Bills split with others" (pinned; section "Bills split with others") | who owes whom, the open bills, "+ Add another bill" (the form open while the list is empty), the settled history | nothing; "Sam owes you $42"; "2 payments open"; "all square" |
| `how` | how, "How this is worked out" | the shared costs, each income and where it comes from, the shares with the figures, the parts, the sources | "5 steps" |

   After Save the costs part stays open with the green line naming the new answer; no other part moves (R7, R17).
5. "More on this": "How much of your take-home goes to needs, wants and savings?" (Budget (50/30/20)), "What do you
   spend each month?" (Expenses), "What does each paycheck keep after tax?" (Paycheck), "What does each of you bring in?"
   (Income).

Reached from Budget (50/30/20)'s "More on this" (a couple only): "How should you two split the costs you share?", with this page's
answer under it ("Ana $3,198, Bo $2,628 a month").

No filled button on the first view of a couple with costs and pay: the chips are the action.

Builder chose (the design left these open):
1. Take-home is the Paycheck page's per earner (see Formulas); income as typed when there is no paycheck.
2. The couple is the adult marked "Me" and the partner (else the first two adults); a third adult and their income are
   left out and "How this is worked out" says so; income of the household's own counts half each.
3. Payments the Debts page adds to the Expenses month are costs too (id `debt:<id>`), so a mortgage kept only on Debts is
   shared; taxes not withheld are left out.
4. "Our own split" is a chip, as the design names it, and shows its one box in place (R23), instead of the helper's
   "Type my own" chip, whose box takes a figure, not a way to split.
5. A choice for a cost not on the list today (ended, or not started) is kept on Save while the bill still exists.
6. The status of "Which costs are shared" says "12 of 13 shared" rather than "1 set by you": the count says more.

## Edge cases
Fewer than two adults or the empty plan: the one sentence. No costs, all left out, no pay, one earner: their sentences.
A partner with no name with a first adult with none either: "your partner". Own shares that do not add up to 100%:
scaled; junk: by income. Costs above both incomes: the amber line. People with no id: the own split cannot be kept.

## Tests
`module.test.mjs`, bills split with others (split #17): an even split ($90 three ways; $100 three ways with the odd cent
to the payer; a payer not in the split); shares (2:1:1, 1:1:1, 1:2 of $10, a 0 and a blank share, all 0); exact amounts that
add up and that do not (both figures in the error); every other plain error; three people netted to the fewest payments
(four debts to two; a chain to one); the exact search beating largest-to-largest (+6 +4 −3 −3 −4: three, not four), 300
random groups settled in no more than largest-to-largest, 13 people still settled; settling (payments, the square point,
the history), and Undo; one test per sentence (status, lines, green lines, Undo's words, the questions); who is who; the
page: the row shut on the first view, the intro and the open form, Add with the green line and Undo, exact amounts refused
and by shares saved, Remove asked (No keeps it), Change in place, Mark as settled with Undo and the history; S11; one adult
and the empty plan; invariance (no bills, an empty list and a full list give byte-identical `compute()`, Budget (50/30/20)
and Expenses over the qa households and fixtures). The w1 fixes: a bill written by id stays with the same people when
another adult is marked "Me" or People is reordered (M1); a bill too small to split, the $1,000,000,000 cap, shares too
large to be exact and days not on the calendar (M2 to M4); one adult's hero and its "Add a bill" opening the row at its
add form, with bills too (P1); "Bills and payments" (P2); the help line and example names (P4, P5). Before that,
`module.test.mjs`: the formulas (60/40 example; shares add to 1, percents to 100, dollars to the shared costs, for every
method; take-home equals the Paycheck page's per item; household income half each, a child's and a third adult's left
out; `leaveOut` excluded, a Debts payment and a yearly bill counted, taxes and one-time costs not; own shares; the largest
remainder); one test per sentence case and per alarm (with "you" and "your spouse"); invariance over the qa households,
every pack and the fixture plans (an empty `whatIfs.shareCosts` gives the same result; Budget (50/30/20) and Expenses give
the same with a choice saved here); the page under the fake DOM: what is outside the parts, the three chips, a chip saves
and the green line, "Our own split" and its box, unchecking a cost (the part stays open, the next draw shuts it), the empty
states, the alarm outside the parts, and Budget (50/30/20)'s row.

## Bills split with others (gap list next 60, item 17)
Costs shared with people outside the couple: roommates, friends, a trip. A short list of bills (what, the day, the amount,
who paid, how it splits) and who owes whom, netted to the fewest payments, with "Mark as settled". The math is
`split.js` (pure), read only by `view.js`: `compute()` above and every other page are unchanged by it (tested), and the
names typed here are kept only in the plan (no page result, no helper prompt and no shared link carries them).

**Data.** `splitBills?: [bill | payment]` in the order typed (`docs/DATA_MODEL.md`; optional, no version bump):
- a bill `{ id, what, on, amount, paidBy: who, split: "even" | "shares" | "exact", among: [{ who, share?, amount? }] }`;
- a payment `{ id, kind: "paid", on, from: who, to: who, amount }`, written by "Mark as settled";
- `who`: `"person:<id>"` (a person in the plan; the first adult is "you" when unnamed, else their name, as everywhere on
  this page), `"me"` (the first adult, written only while the plan has no adult with an id), `"name:<as typed>"`
  (someone outside it). A typed name is compared without case or extra spaces, and one that is a plan person's name (or
  "me", "you") is that person (`canon`). The form writes everyone in the plan by id (`storeKey`), the first adult too, so
  marking another adult "Me" on People, or putting the people in another order, never moves a bill to someone else (it
  did before the w1 fix: a bill "you" paid became the new "Me"'s). A stored `"me"` still reads as the first adult.

**Formulas** (whole cents throughout: `A = round(amount × 100)`; the parts of every bill add up to `A` exactly). A bill or
payment is at most `AMOUNT_MAX` = $1,000,000,000: far above any bill shared with friends, and small enough that every sum
of cents stays an exact whole number (JavaScript's `Number.MAX_SAFE_INTEGER` is about $90 trillion in cents); a stored one
above it, or shares so large a part is not a whole cent, is left out and said ("1 to fix"):
- **Evenly** between `n` people: each person other than whoever paid owes `floor(A ÷ n)`; whoever paid has the rest,
  `A − Σ others`. **Rounding: the odd cents go to whoever paid.** Example: $100 three ways is $33.33, $33.33 and $33.34 for
  the payer. A payer who is not in the split keeps only the odd cents ($100 for Sam, Lee and Kim: $33.33 each, 1 cent stays
  with the payer).
- **By shares** `s_i` (`S = Σ s_i > 0`; a blank share is 1, a 0 owes nothing): each other person owes
  `floor(A × s_i ÷ S)`; whoever paid has the rest. Example: $100 at 2 : 1 : 1 is $50, $25, $25; $10 paid by Sam at
  Sam 1 : Lee 2 is Lee floor(1,000 × 2 ÷ 3) = 666 cents, Sam 334.
- **Exact amounts**: as typed, to the cent; they must add up to the bill, or the form says "These add up to $85.00, but the
  bill is $90.00. Change them so they add up to $90.00." (whoever paid has the rest of a stored bill, so a hand-edited one
  still adds up; one whose others add up to more than the bill is left out and said, "1 to fix").
- **Balance** of a person = Σ bills they paid − Σ their parts + Σ payments they made − Σ payments they received. The
  balances add up to zero (each bill adds `A` and takes away parts adding up to `A`).
- **Fewest payments.** A set of payments that brings everyone to zero joins people into groups (who pays whom); each group
  must add up to zero, and a group of `k` people needs at least `k − 1` payments to be joined. So `n` people with a balance
  need at least `n − g` payments, where `g` is the most groups the balances can be split into that each add up to zero; and
  `n − g` is reached: within each group whoever owes most pays whoever is owed most, as much as either needs, which clears
  at least one person each time and two only on the last (else a smaller group would add up to zero). `fewestPayments`
  finds `g` by trying every subset (3^n steps) for up to 12 people with a balance (`EXACT_MAX`); above 12 it uses the same
  largest-to-largest rule over everyone (at most `n − 1` payments, perhaps not the fewest). Example: +$6, +$4, −$3, −$3,
  −$4 is three payments ({+4, −4}, {+6, −3, −3}); largest-to-largest over everyone would take four.
- **Settled.** After an entry where every balance is zero, every entry up to it is settled history ("Settled", read only);
  the rest are open. Settling writes a payment and never deletes a bill.
- **Example** (tests): you pay $90 for dinner for you, Sam and Lee; Sam pays $30 for a cab for the three. Four debts (Sam
  and Lee owe you $30 each; you and Lee owe Sam $10 each) net to two payments: Lee owes you $40, and Sam owes you $10.

**Where this comes from.** The arithmetic above is the method itself and uses no outside figure, so nothing here needs a
date. The three ways to split are the ones Splitwise's help center names ("Equally", "By percentage", "By shares"; cited
under Sources above, read 2026-11-13); on 2026-11-16 this session's network refused kb.splitwise.com, so it was not read
again, and no code or text of theirs is used. Netting to the fewest payments is written out above instead of cited.

**First view.** For one adult and the empty plan the hero is this row's (w1 fix P1; it said "Sharing costs as a couple /
This is for two people who share costs." above the row, so a person with roommates read that the page was not for them):
"Split a bill with friends or roommates", "Add each bill you share, and this works out who owes whom.", one filled "Add a
bill" (it opens the row, with its add form open, and brings it under the top bar; nothing is written), and the quiet line
"Sharing costs with a partner? Add them on People" (a link, 44 px tall). The row then skips its own intro (the hero says
it). This also gives the empty plan its filled way to start, which the browser check missed before. One row in the parts card, after "Which costs are shared" and before "How this is worked out": kind
`own`, title "Bills split with others" (pinned in `PINNED_TITLES`: the page's second `own` part, and its only part for one
adult), status: nothing while the list is empty; the one payment when it fits in 20 characters ("Sam owes you $42");
"2 payments open"; "all square"; "1 to fix" (opens the row). It shows in every state the page draws: for one adult and the
empty plan under the one sentence, and with no costs under "Open Expenses" (a single person with roommates is who splits
most bills; the brief put it on the couple's page only). For the invented households (no bills) the first view gains the
row's four words and one row: 86 to 90 words and 3 to 4 rows (empty plan 18 to 22 words, 0 to 1 row), inside the answer
budget (160, 5); `tests/first-view.known.json` has no entry for this page, so nothing is raised there.

**Inside the row:**
1. The green line after a change, naming who owes whom now, with Undo: `Added "Pizza night". Sam owes you $30, and Lee
   owes you $30.`, `Saved ...`, `Removed ... Everyone is square.`, `Settled: Sam paid you $30. Lee owes you $30.`; three
   payments or more: `3 payments settle it.` Undo: `Undone: "Pizza night" is off the list.` / `is back as it was.` /
   `is back on the list.` / `Undone: Sam owes you $30 again.`
2. Empty list: "For costs you share with roommates, friends or on a trip: add each bill, and this works out who owes
   whom." and the add form, open (R20).
3. Otherwise "Who owes whom": one record per payment, the first adult's first, then the largest ("Sam owes you" $30), each
   with an outlined "Mark as settled" (asks "Mark it settled: Sam paid you $30? The bills stay in your history."); or
   "Everyone is square."
4. "Bills" ("Bills and payments" when a payment marked settled is among them, until everyone is square): the open entries, newest first, each with the line "Nov 14 · you paid · evenly between you, Sam and Lee" (or
   "by shares: you 2, Sam 1", "exact amounts: you $50.50, Sam $39.50", "all of it for Sam"); outlined "Change" (the bill's
   form in its row) and "Remove" (asks "Remove "Pizza night" ($90)? Who owes whom is worked out again without it."). A
   payment: "Sam paid you" $30, "Nov 16 · marked settled", Remove.
5. "+ Add another bill" (outlined); the form: "What was it" (e.g. Pizza night), "How much", "Who shares it" (a check box per
   person known: you, the plan's other adults, each name used before; ticked as on the last bill, the first time you
   only; under its label "Check who shares it, and type anyone else below.") with "Add people" ("For example: Robin, Dana.
   Names stay in your plan only."; names in none of the invented households, so the example never reads as someone in
   the plan), "Who paid" (everyone known and every
   name typed); "More details (optional)": "Day" (empty: today) and "How it splits" (Evenly, By shares, Exact amounts),
   which shows a box per person ("Shares for Sam", 1 each to start; "Sam's part"). Its Save is the row's one filled button.
6. "Settled": one muted line per settled entry, newest first ("Nov 14 · Pizza night · $90 · you paid", "Nov 16 · Sam paid
   you $30"), read only.

Errors (red above the form's buttons, the form kept as typed): "Type how much the bill was.", "Type an amount up to
$1,000,000,000.", "Check or type who shares it.", "Check or type at least one other person to split it with.", "Give
someone other than whoever paid a part of it.", "This bill is too small to split: each part would be less than a cent."
(someone else is in it, but every part of theirs rounds to 0 cents: $0.005 between two), "A share is 0 or more.", "Give at
least one person a share.", "An amount is 0 or more.", the exact-amounts line above. A day is kept only when it is a day of
the calendar ("2024-02-30" or "2026-13-40" in a hand-edited plan shows no day).
"How much" is not a `required` box: a required box may not sit in a shut part (R9), so Save says it instead.

**Builder chose** (the brief left these open, or was wrong about the code):
1. The row shows in every state, one adult included (see First view).
2. "Mark as settled" is per payment line and writes a payment, so one of three people can settle and Undo takes back just
   that; the brief's "keeps the history" is the settled list.
3. `compute()` is not touched: the bills live in `split.js`, read only by the view, so "Explain this page" and every
   other page see exactly what they saw before (the invariance test), and typed names never leave the plan.
4. Payments are stored, never worked from the bank files (a later idea).
5. History is read only: a settled bill cannot be changed (changing it would reopen what was settled); a payment can be
   removed while it is open.
6. A typed name that matches a plan person's is that person; the same name in any case is one person, shown as last typed
   with a capital.
7. (w1 fix) Everyone in the plan is written by id, the first adult too (M1); one adult's hero is about this row (P1); a
   payment among the open bills heads them "Bills and payments" (P2); "Who shares it" has a one-line help and the example
   names are in no invented household (P4, P5); a bill too small to split, an amount above $1,000,000,000 and a day not on
   the calendar each have their own handling (M2 to M4). Not changed: a tap on "+ Add another bill" within 800 ms of
   "Add the bill" is dropped by the shell's tap guard (`core/taps.js`: the new button is drawn under the thumb that just
   saved, so it reads as a double tap); a tap from about 900 ms on lands, and nothing on the page scrolls after the save.

## Ideas / not yet
- More than two adults sharing (roommates, a parent living with you): each adult's share by income.
- A joint account: what each should move into it each payday.
- Settling up from the bank files: who paid what this month, matched to the bills here.
