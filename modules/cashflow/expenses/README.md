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

## Ideas / not yet
- Fill amounts from imported transactions (phase 3): average of the last 3 months per category.
- Per-person expenses for the survivor scenario (phase 8).
