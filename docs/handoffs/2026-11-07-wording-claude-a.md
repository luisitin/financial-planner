# Wording sweep: what is left in claude-a's pages (claude-b -> claude-a, 2026-11-07)

The owner asked (2026-11-07): "Does any page have any wording error?", for example "insurance cover" where
US English says "coverage". claude-b swept every string people read and fixed its own pages. These items are
in your 13 folders, so they are left for you. Every file and line below was checked at c804ed0; your files
have not changed since the sweep began, so the line numbers hold until you edit them.

## How to work through it

- Change only the words people read (string and template literals). Never change identifiers, data keys,
  CSS classes, route segments or `aria-labelledby` values.
- "cover" as a verb is fine ("Social Security covers your spending"). Only the insurance noun is wrong in US
  English: write "health insurance", "life insurance" or "coverage" (the IRS terms are "self-only coverage"
  and "family coverage").
- Update the assertions in your `module.test.mjs` files that pin the old words. Never edit `tests/golden/**`.
- `tests/wording.test.mjs` lists your folders in `CLAUDE_A_LANE` and shows each file as a todo test with its
  count of slips (24 slips in 12 files today). When a folder is clean, delete it from `CLAUDE_A_LANE` so the
  check covers it from then on. The test only catches spellings and set phrases; the plain-words items below
  are for you to read and fix by hand.
- Shared helpers you can use: `withA` in `core/words.js` ("an 8.5%", "an $11,000", "a $3,000"), and
  `fmt.money`, which no longer prints "-$0".

## First: two page titles

Each one needs the `module.js` title, the row in `docs/MODULE_CATALOG.md` (a test now checks that the catalog
titles match the menu titles) and `npm run registry`.

1. **goals/emergency-fund: "Emergency fund" -> "Emergency fund goal".** Two pages are titled "Emergency fund"
   today, so the menu, search and All pages list it twice. balance/liquidity keeps "Emergency fund" (the
   Dashboard tile, the path step and the alerts open it).
   - `modules/goals/emergency-fund/module.js:7` title.
   - `modules/goals/emergency-fund/view.js:59` the link "Cash and how fast" -> "Emergency fund" (it opens
     balance/liquidity).
2. **taxes/state: "State" -> "State tax".** claude-b's pages already say "the State tax page" (13 places),
   so those links read wrong until this title changes.
   - `modules/taxes/state/module.js:7` title.

## Page by page

### balance/projection
- `compute.js:76, 77, 82`, `module.js:17`, `view.js:38, 39, 45, 50`: "today's money" -> "today's dollars"
  (25 other pages say "today's dollars"; it is the usual US term).
- `view.js:46`: `"Today's money" takes out 3.0% a year of rising prices, so a figure buys what it would today.
  In money of the day, 2065's $1,394 is $4,416.` -> `"Today's dollars" take out 3% a year of price increases,
  so each figure shows what it would buy today. In 2065's own dollars, that $1,394 would be $4,416.`
- `view.js:71`: "All in today's money. ... Debts follow the payoff plan on Debts." -> "All in today's
  dollars. ... Debts follow your plan on Pay off debts."
- `view.js:29`: "...debts paid down, and retirement spending it again." -> "...debts paid down, and then
  retirement drawing it back down."
- `view.js:78` (help): "empty: to five years after retirement (N now)" -> "leave blank for five years after
  retirement (N now)".
- `view.js:79` (help): "about prices plus half a point over the long run" -> "about inflation plus half a
  percentage point over the long run".
- `view.js:80` (label): "Cars lose each year" -> "Cars lose value each year".
- `view.js:86`: the card heading "Next" -> "More on this" (the page's own links; "Next" is the path bar's
  word, DESIGN_LOG 2026-11-06).

### balance/statement
- `compute.js:15`: "Saved for later: tax or a penalty to take out early" -> "Retirement savings (tax, or a
  penalty, to take out early)".
- `compute.js:16`: "Home, cars and things: months to sell" -> "Home, cars and belongings (months to sell)".
- `view.js:68`: "Joint: accounts with no single owner on the Accounts page." -> "...no single owner on Net
  worth." (accounts are added on Net worth).
- `view.js:73`: "Cash covers 11.0 months of spending" -> "Cash covers 11 months of spending" (whole months,
  one decimal only under 2: DESIGN_LOG round 13), and "Three to six months is the usual cushion." -> "...the
  usual emergency fund."
- `view.js:74`: "Cash and investments you can sell in days are 0.3 times what falls due within a year." ->
  "Cash and investments you can sell within days would pay 0.3 times (30% of) what you owe in the next year."
- `view.js:78`: "Values as entered on Accounts." -> "Values as entered on Net worth."

### cashflow/statement
- `view.js:16`: "what living brings in after tax and costs" -> "what your pay and other income bring in after
  tax and living costs".
- `view.js:34`: "From living, after tax" -> "Everyday money, after tax".
- `view.js:41`, `view.js:60`: "Cash from living" -> "Everyday cash (pay in, bills out)".
- `view.js:64`: "categorised" -> "categorized".
- `view.js:65`: "From the Income, Expenses, Contributions and Debts pages" -> "...Expenses, Retirement
  contributions and Debts pages", and "Amounts in brackets go out." -> "Amounts in parentheses are money going
  out."

### debt/consolidation
- `compute.js:46` and `view.js:41`: "Keep paying as now" -> "Keep paying as you do now"; `view.js:41` "...
  against paying as now" -> "..., compared with paying as you do now".
- `module.js:17`: "...or a home-equity line against paying as now." -> "...or a home-equity line, compared
  with paying as you do now."
- `compute.js:52`: "At the same payment it is not paid off in the 18 interest-free months; 185 a month would
  clear it." -> "At your current payment it would not be paid off in the 18 interest-free months; $185 a month
  would clear it." (the "$" is missing today).
- `compute.js:55`: "The home secures it: card debt that could be settled becomes debt the house answers for."
  -> "Your home backs this loan: card debt you might have settled for less becomes debt you could lose your
  house over."
- `view.js:33`: "Add your cards and loans on Accounts" -> "Add your cards and loans on Net worth".

### debt/student-loans
- `view.js:30`: "Add the loans on Accounts as \"Student loan\"" -> "Add the loans on Net worth as \"Student
  loan\"".
- `view.js:37, 42`: "in today's money" -> "in today's dollars"; `view.js:43`: `"In today's money" counts...`
  -> `"In today's dollars" counts...`.
- `view.js:38`: "(adjusted gross income, growing with pay)" -> "(your adjusted gross income, line 11 of Form
  1040, growing with pay)".
- `view.js:56` (help): "empty: the Federal estimate's $X" -> "leave blank to use the Federal estimate's $X".
- `view.js:61`: the card heading "Next" -> "More on this", and its link "Pay off debt" -> "Pay off debts"
  (the page's title).

### goals/charitable
- `view.js:33`: "0% comes back as lower tax" -> "0% of it comes back to you as lower tax".
- `view.js:38`: "It would cost about $240 more: even $9,000 in one year does not beat the standard deduction,
  and the $1,000 / $2,000 deduction for cash gifts is used only once instead of every year." -> "Bunching
  would cost you about $240 more: even $9,000 in one year is less than the standard deduction, and you would
  get the $1,000 deduction for cash gifts ($2,000 on a joint return) once instead of every year."
- `view.js:39`: "of a ${money(d.yearly)} gift" reads "a $11,000 gift" or "a $8,000 gift": use
  `withA(money(d.yearly))` so it reads "an $11,000 gift".
- `view.js:46` (help): "empty: $X from the Federal estimate page" / "empty: an example of $3,000" -> "leave
  blank to use $X from the Federal estimate page" / "leave blank for an example of $3,000".
- `view.js:48` (label): "Share of shares' value that is growth" -> "Part of the shares' value that is
  growth".
- `view.js:53`: the card heading "Next" -> "More on this".

### goals/emergency-fund (after the retitle above)
- `compute.js:18`: "needs a bigger cushion" -> "needs a bigger emergency fund".
- `compute.js:55`: "so it does not count toward the cushion. If that goal is your emergency fund, tick it
  below." -> "so it does not count toward your emergency fund. If that goal is your emergency fund, check it
  below."
- `view.js:47`: "If this goal is the emergency fund itself, tick it: its money then counts as the cushion." ->
  "If this goal is the emergency fund itself, check it: its money then counts as your emergency fund."
- `view.js:36`: "full in about 58 months (2031-09)." -> "full in about 58 months (September 2031)."
  (`readyDate` is built as "YYYY-MM" in `compute.js:49`).
- `view.js:44`: "Your target already is 6 months (Assumptions)." -> "Your target is already 6 months
  (Assumptions)."
- `view.js:55`: "A high-yield savings or money-market account at an insured bank: reachable in a day, earning
  interest." -> "A high-interest savings account or money-market account at an FDIC-insured bank: you can get
  the money in a day, and it earns interest."
- Hold, not now: `view.js:17` rounds a month of bills to $10 ("6 months of $4,770") while Emergency fund,
  Budget 50/30/20 and Disability show the dollar ($4,768). claude-b's pages that round to $10 (Next best
  action, Your plan, Monthly review) were not changed either; one rule for both lanes needs a design review.

### goals/travel
- `view.js:19` (label): "Flights per person (return)" -> "Flights per person (round trip)".
- `view.js:44`: "A holiday, a wedding, a big birthday" -> "A vacation, a wedding, a big birthday".
- `view.js:67`: the row button "Change" -> "Edit" (DESIGN_LOG rounds 14-16: "Edit" on row buttons).
- `view.js:77` (placeholder): "e.g. Mum's 70th" -> "e.g. Mom's 70th".
- `view.js:90`: the page shows the word "null" under the form: `formHost.append(..., editing ? ... : null)`
  appends the text "null" when nothing is being edited. Leave the null out of `append`.
- `view.js:100`: the card heading "Next" -> "More on this", and its link "Sinking funds" -> "Irregular
  expenses" (that page's title).

### goals/vehicle
- `view.js:48`: "At least 20% down: 0% down." -> "At least 20% down: yours is 0%."
- `view.js:49`: "A loan of at most 4 years: 5 years." -> "A loan of at most 4 years: yours is 5 years."
- `view.js:50`: "Car costs under 10% of gross income: $500 a month (...) is 4%." -> "Car costs under 10% of
  income before tax: yours, $500 a month (...), are 4%." (and "of gross income" -> "of income before tax" in
  the first branch).
- `view.js:54, 60, 61` (help): "empty: ..." -> "leave blank to use ..." ("leave blank to use the \"Car\"
  goal's target by its date", "leave blank to use the car goal on Goals", "leave blank to use the car goal's
  monthly amount").
- `view.js:68`: the card heading "Next" -> "More on this".

### taxes/documents
- `compute.js:32`: "marketplace health cover, if you bought it there" -> "marketplace health insurance, if you
  bought it there".
- `compute.js:36`: "the starting point, and the adjusted gross income to sign this one" -> "the starting point;
  you also need its adjusted gross income (line 11) to sign this year's return online".
- `module.js:17`: "and a tick as each comes." -> "and a check mark as each comes."
- `view.js:28`: "Tick each one as it comes." -> "Check off each one as it comes."
- `view.js:31`: "an extension gives until October, but not more time to pay" -> "an extension gives you until
  October to file, but not more time to pay".
- `view.js:48`: "ticked as received." -> "checked off as received."
- `view.js:66`: "an account on Accounts" -> "an account on Net worth".
- `view.js:78`: the card heading "Next" -> "More on this", and its link "Federal tax estimate" -> "Federal
  estimate" (that page's title).

### taxes/filing-status
- `view.js:40`: "Separately can pay off when one of you has large medical bills (the floor is a share of that
  person's income alone) or an income-driven student loan." -> "Filing separately can pay off when one of you
  has large medical bills (only the part above 7.5% of that person's own income counts) or an income-driven
  student loan."

### taxes/self-employment
- `module.js:17`: "what each extra $100 keeps" -> "how much of each extra $100 you keep".
- `compute.js:87`: "The Income page's amount is treated as profit." -> "This page treats the amount on the
  Income page as profit."
- `view.js:47`: "A SEP-IRA takes 20% of the profit after half the self-employment tax." -> "A SEP-IRA lets you
  put in up to 20% of the profit, after taking off half the self-employment tax."

### taxes/state (after the retitle above)
- `view.js:43`: "...and the adjusted gross income on last year's federal return below" -> "...and the adjusted
  gross income (line 11 of Form 1040) on last year's federal return below".
- `view.js:51, 53`: "× (adjusted gross income $75,000 − about $16,100 of deductions and exemptions)" -> "×
  (your income before deductions, $75,000, minus about $16,100 of deductions and exemptions)".
- `view.js:57`: "Credits and phase-outs are left out." -> "Credits are left out, and so are the breaks that
  shrink as income rises."
- `view.js:66`: the button "Use $X on Federal" -> "Use $X on Federal estimate".
- `view.js:94, 95` (help): "empty to work it out" -> "leave blank to work it out"; "empty for the usual ones"
  -> "leave blank for the usual ones".
- `view.js:104`: the card heading "Next" -> "More on this", and its link "Federal tax estimate" -> "Federal
  estimate".

## Frozen files (list only, do not edit)
`tests/golden/property-goals/RULES.md` and `renovations.csv` say "today's money" and "cushion" in their notes;
they are answer keys, so they stay as they are.
