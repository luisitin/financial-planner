# Sharing costs as a couple  (`cashflow/shared-costs`)

**Status:** usable (gap design #22, built 2026-11-13)
**Purpose:** How two people who share costs split them: by what each takes home, half each or your own split, and what
each keeps for themselves.

## Inputs
Plan sections read (`needs`): `household.people` (who the couple is), `income` (each person's pay), `expenses` (the costs),
`debts` (payments the Expenses month adds from the Debts page), and through the Paycheck page's `takeHome()` the
`retirement.contributions`, `taxes`, `accounts` and `whatIfs.paycheck` / `whatIfs.benefits` it reads; `whatIfs.shareCosts`
(this page's own choices).

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
| one adult (also the empty plan) | Sharing costs as a couple | This is for two people who share costs. (+ outlined "Add a partner on People") |
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
`module.test.mjs`: the formulas (60/40 example; shares add to 1, percents to 100, dollars to the shared costs, for every
method; take-home equals the Paycheck page's per item; household income half each, a child's and a third adult's left
out; `leaveOut` excluded, a Debts payment and a yearly bill counted, taxes and one-time costs not; own shares; the largest
remainder); one test per sentence case and per alarm (with "you" and "your spouse"); invariance over the qa households,
every pack and the fixture plans (an empty `whatIfs.shareCosts` gives the same result; Budget (50/30/20) and Expenses give
the same with a choice saved here); the page under the fake DOM: what is outside the parts, the three chips, a chip saves
and the green line, "Our own split" and its box, unchecking a cost (the part stays open, the next draw shuts it), the empty
states, the alarm outside the parts, and Budget (50/30/20)'s row.

## Ideas / not yet
- More than two adults sharing (roommates, a parent living with you): each adult's share by income.
- A joint account: what each should move into it each payday.
- Settling up: who paid what this month from the bank files, and who owes whom.
