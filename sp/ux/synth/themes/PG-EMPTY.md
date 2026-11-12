# PG-EMPTY: First-open dead ends: the one button leads to a page that does not show what it promised; $0 answers with nothing to tap; lists with no way to change a row

13 verified findings (each reproduced on screen by an independent skeptic). Scripts and pictures for a finding `<walker>/<id>` are in `$SP/ux/<walker>/` and `$SP/ux/<walker>/verify/`.

## j-debt-fixer/D1 (severity 4, next, scope several-pages, owner claude-b, confirmed)
**Debts and Credit cards have no way to add a debt, and no words that lead to where one is added**

- pages: balance/liabilities, debt/credit-cards, balance/net-worth, debt/payoff
- reach: Every household with a debt: Debts and Credit cards (no add), Net worth (add with no follow-up), Pay off debts (the 'Not in the plan' line).
- steps: H.renterDebt(), open balance/liabilities and look for anything about adding. Open the menu and search 'add a debt', then 'credit card'. Go to balance/net-worth, scroll to '+ Add another account' (y=1395), Type 'Credit card', name 'Capital One', balance 1850, Add account. Open balance/liabilities, then debt/payoff.
- saw: Debts with 4 debts: no add control, the word 'add' is nowhere on the page, no filled button (filledOnScreen empty); the only link is 'Open my payoff plan'. Credit cards: no add either. Menu search 'add a debt' returns only 'Cash-flow statement'; 'credit card' returns Debts, Transfers, Credit cards, none of which can add one. The only add is on Net worth, below 8 accounts at y=1395, in a Type list of 19 kinds. After Add the notice is 'Capital One added.' with no link. Two corrections to the walker: the new card is not left out silently. Debts shows a blue notice '1 of your debts has no rate or payment yet. Tap it below to add them.' and the row says 'needs details' (y=1262, under three amber notices); Pay off debts says 'Not in the plan (no rate or payment yet): Capital One.' at y=257, as plain text with no link.
- should: Debts ends its list with an outlined '+ Add a loan or card' that opens a short add form (name, kind, what you owe). After a card or loan is added on Net worth the green notice reads 'Capital One added. Next: its rate and payment ›' and links to #/balance/liabilities/<id> (that address already opens the debt's form). On Pay off debts the 'Not in the plan' line links to the same place.
- why: Someone with a fourth card who opens Debts or Credit cards cannot add it there, and nothing on either page or in search names the page where it is done; 'Net worth' is not a word a person in debt would try.
- cause: modules/balance/liabilities/view.js:33-40 draws 'Add a loan or card' only when d.count === 0; the page with data (lines 43-119) has no add and no link to Net worth. modules/balance/net-worth/view.js:69 says '<name> added.' for every kind. modules/debt/payoff/view.js:50 prints the missing debts as plain text.
- fix: liabilities/view.js: after the list, ui.row(a.btn.secondary '+ Add a loan or card' -> #/balance/net-worth?add=credit); net-worth/view.js: when ctx.route.query.add is set, open the add form with that Type chosen and scroll to it; in save(), when the new account is a debt, the pending notice carries the link to #/balance/liabilities/<id>; payoff/view.js:50: make each missing name a link. Keeps 2026-09-15 (form inside the list card, add form folded once there is data).
- evidence: $SP/ux/j-debt-fixer/verify/v1-debts-full.png, $SP/ux/j-debt-fixer/verify/v3-nw-after-add.png, $SP/ux/j-debt-fixer/verify/v3-debts-after-add.png, $SP/ux/j-debt-fixer/verify/v24-search-add-a-debt.png

## p-debt-property/DP-3 (severity 4, next, scope several-pages, owner claude-b (balance/net-worth, debt/mortgage, debt/refinance, debt/credit-cards, property/home); claude-a (debt/student-loans), confirmed)
**The one button on an empty debt or home page lands on a page that does not show the form it promised**

- pages: debt/mortgage, debt/refinance, debt/credit-cards, debt/student-loans, property/home
- reach: Five empty states. Worse than the walker wrote for anyone who already has accounts. debt/payoff is fine ('Add your debts' opens Debts, which says 'Then come back'). debt/consolidation's 'Debts' button opens Pay off debts, a milder case of the same.
- steps: H.sam() (a renter with four accounts), open debt/mortgage, tap the filled 'Add the mortgage'. Then H.sam(), property/home, tap the filled 'Accounts'. Then H.empty(), debt/mortgage, 'Add the mortgage', add 'Home loan' as Mortgage with 265,000.
- saw: Sam, Mortgage: lands on Net worth at scroll 0 showing four tiles and the account list; no form on screen, '+ Add another account' is at y=951, below the 844 px screen. Sam, Your home (and Student loans): the page says 'Add the home on Net worth as Real estate' but the button is called 'Accounts' and opens Account detail, showing his Checking account and a balance-history form; that page has no way to add an account. Empty plan: Net worth's form is open but Type is 'Checking', nothing mentions the mortgage; after 'Home loan added.' the filled button is 'Save today's totals' and nothing says to give it a rate and payment or links back. The phone's Back does return to Mortgage (scroll 0), which then asks for 'the rate and payment'. Reproduced twice.
- should: The button opens Net worth with the add form open, the type already chosen and the cursor in the name box; after the save a 'Back to Mortgage' button. On Your home and Student loans the button says what it does ('Add your home', 'Add a student loan') and goes to that same form.
- why: The person tapped 'Add the mortgage' and sees no place to add it, or a page about their checking account. They do not know which type to pick, what comes after, or how to get back.
- cause: Plain links: modules/debt/mortgage/view.js:31, refinance/view.js:14 and credit-cards/view.js:76 go to #/balance/net-worth; student-loans/view.js:31 and property/home/view.js:38 go to #/balance/accounts (Account detail). modules/balance/net-worth/view.js:54 and 62 open the form only when there are no accounts (`showForm = empty`) and always start at `type: 'checking'`; it never reads ctx.route.query. The 2026-09-16 design log line 'Mortgage and Refinance empty states read fine' was about the wording, not the landing, so nothing here undoes a choice.
- fix: The router already carries a query inside the hash. Links become #/balance/net-worth?add=mortgage&back=debt/mortgage (credit, student, real-estate likewise). net-worth/view.js reads ctx.route.query.add: showForm = true, values.type = that type, scroll the form into view and focus 'Account name'; its 'X added.' notice gets a 'Back to Mortgage ›' link built from `back`. Rename the two 'Accounts' buttons.
- evidence: $SP/ux/p-debt-property/verify/v4b_sam_landing.png, $SP/ux/p-debt-property/verify/v4c_sam_property_home.png, $SP/ux/p-debt-property/verify/v4_mortgage_landing.png, $SP/ux/p-debt-property/verify/v4b_after_add.png

## p-investments/INV-1 (severity 4, next, scope page, owner claude-b pages, confirmed)
**'Add holdings' on six pages leads to a Holdings page that cannot add anything until an investment account exists**

- pages: investments/holdings, investments/allocation, investments/rebalance, investments/fees, investments/dividends, investments/asset-location, investments/tax-lots
- reach: every household without a brokerage, 401(k), IRA, Roth, HSA or 529 on file (4 of the 14 test households), from 6 sender pages
- steps: Any household with no investment account: H.empty(), H.blank(), and also the finished households sam (young renter) and jordan (single parent). Investments > Allocation > tap the filled 'Add holdings' (same from Fees, Dividends, Asset location, Tax lots; Rebalance's filled button says 'Holdings').
- saw: Holdings shows the hero, then an empty white card 34 px high with nothing in it, then the path row. No filled button, no form, no import. The only way on is the inline link 'Net worth page', 95x16 px (rule is 44). Performance, by contrast, sends its empty state straight to Net worth with a filled button.
- should: With no investment account, Holdings shows one filled button 'Add an investment account' (to Net worth) with the words 'First add the account itself (brokerage, 401(k), IRA), then come back and list the funds in it', and no empty card.
- why: I tapped 'Add holdings' and there is nowhere to add a holding. The page looks broken; the tiny link in grey small print is easy to miss, and Net worth then opens at its top with no hint which button to use.
- cause: modules/investments/holdings/view.js:32 (the only instruction is an inline <a> in a small muted paragraph), :48-51 (drawForm returns nothing when there are no accounts), :79-80 (the empty formCard is appended anyway), :88 (the import fold is dropped). Senders hard-code #/investments/holdings: allocation/view.js:17, rebalance/view.js:14, fees/view.js:14, dividends/view.js:12, asset-location/view.js:12, tax-lots/view.js:14.
- fix: In holdings/view.js: when !accounts.length, put ui.row(a.btn 'Add an investment account' -> #/balance/net-worth) in the hero in place of the small paragraph, and do not append formCard. One change fixes the dead end for all six senders. The page still ends with its one way on (design log 2026-11-06).
- evidence: $SP/ux/p-investments/verify/inv1-holdings-empty.png, $SP/ux/p-investments/verify/inv1-holdings-sam.png

## j-one-answer/A8 (severity 3, understand, scope page, owner claude-b, confirmed)
**Federal estimate on an empty plan shows four zero tiles instead of saying what to type first**

- pages: taxes/federal, taxes/withholding
- reach: taxes/federal and taxes/withholding with no income on file.
- steps: H.empty() -> open taxes/federal from the menu (or step 3 of the taxes guide).
- saw: Hero 'Federal tax for 2026', an info notice 'Nothing on the Income page yet: the estimate is built from what you type below.' with no button, then tiles '$0 Federal tax', '0.0% Of your income', '0% On the next dollar', '$0 Taxable income'. No filled button on the screen; the first box is 1,300 px further down (y 1,733). taxes/withholding does the same ('$0 Tax for the year', '$0 Withheld by December') though its box is on the first screen. The other empty answer pages follow the rule: retirement/projection, debt/payoff ('Add your debts'), insurance/life-needs, overview/benchmarks, retirement/fire, goals/house (an example home, labelled).
- should: With no income and nothing typed: no tiles; under the hero one box 'Your pay this year, before tax' with a filled 'Show my tax'. The tiles appear once there is a figure.
- why: Reproduced by two routes. A layperson reads '$0 federal tax' as an answer.
- cause: modules/taxes/federal/view.js:76-96 draws the hero and tiles whether or not there is income; the only box for pay is inside the fold at :178.
- fix: An empty state in taxes/federal/view.js (and withholding) that writes the same wages figure the fold's box writes. This is AGENTS.md rule 14 ('empty states explain what to do first instead of showing zeros').
- evidence: $SP/ux/j-one-answer/verify/v12-empty-taxes_federal.png; v12-empty-taxes_withholding.png (script v12.mjs)

## p-balance/B4 (severity 3, next, scope several-pages, owner claude-b, confirmed)
**Buttons that promise one job ('Add a loan or card', 'Add a card', 'Add the mortgage', 'Update this balance') all land on the general Net worth form set to Checking**

- pages: balance/liabilities, balance/assets, balance/accounts, debt/credit-cards, debt/mortgage
- reach: every link to #/balance/net-worth that names one job; investments/holdings and retirement/contributions link there too ('Net worth page')
- steps: H.empty(), balance/liabilities. Tap the filled 'Add a loan or card'.
- saw: Lands on Net worth (title and big heading 'Net worth', then 'Add an account') with Type set to Checking and the name hint 'e.g. Chase checking'; Credit card is the 15th of 19 choices in the list. After adding a card there the page offers '+ Add another account', 'Save today's totals' and 'Continue your plan', but no way back to Debts (the phone's Back works and shows the new debt). Same landing with Type = Checking from Credit cards 'Add a card', Mortgage 'Add the mortgage' and Asset register 'Add a home or car'. Account detail's 'Update this balance on Net worth' (on Bo's Roth IRA) lands at the top of Net worth with no form open; that account's row is 829 px down.
- should: The form opens as what the button promised: heading 'Add a loan or card', Type already Credit card (or Mortgage, Real estate), a matching name hint; 'Update this balance' opens that account's edit form; after the save the green line ends with 'Back to Debts ›'.
- why: Reproduced from five pages in fresh browsers.
- cause: modules/balance/net-worth/view.js never reads the address query; line 61 always starts a new account as { type: "checking" }. The links are bare '#/balance/net-worth': liabilities/view.js:37, assets/view.js:37, accounts/view.js:42 and :60, debt/credit-cards/view.js:76, debt/mortgage/view.js.
- fix: net-worth/view.js reads ctx.route.query (the shell already passes it; overview/setup uses it): ?add=<type> sets the Type, the heading and the name hint and opens the form; ?edit=<account id> opens that account's form and scrolls to it; ?from=<group/id> adds 'Back to <page title> ›' to the saved notice. The five links pass them with router.href(...).
- evidence: $SP/ux/p-balance/verify/b4-liab-empty.png, $SP/ux/p-balance/verify/b4-landed.png, $SP/ux/p-balance/verify/b4-after-add.png, $SP/ux/p-balance/verify/l-update-this-balance.png, $SP/ux/p-balance/verify/v-b4.mjs, $SP/ux/p-balance/verify/v-b4b.mjs, $SP/ux/p-balance/verify/v-miss3.mjs

## p-cashflow-a/CF-1 (severity 3, next, scope page, owner claude-b, confirmed)
**'Import a bank file', the one filled button on seven first-time pages, ends in an amber box whose only way on is a 70 x 19 px link called 'Net worth'**

- pages: transactions/import, cashflow/recurring, cashflow/spending, cashflow/subscriptions, cashflow/income-statement, transactions/ledger, transactions/categorize, transactions/reconcile, cashflow/budget
- reach: anyone without an account yet (H.empty(), jordanMidSetup: 0 accounts); households that finished Get started have 2 to 12 accounts and never see it
- steps: H.empty(), open cashflow/recurring, tap the filled 'Import a bank file'. Then tap 'Net worth', add an account, and look for the way back to Import.
- saw: Lands on #/transactions/import: the hero, then an amber notice 'Add the account first (the checking account or card the file belongs to): Net worth'. No filled button on the screen (filledOnScreen []); the only control is the inline link, 70 x 19 px. The link works: Net worth opens with 'Add an account' open. After 'My checking added.' nothing on Net worth leads back to Import (census: no link); the phone's Back does return to Import, which now shows the form. The same filled button is the first-time action on Where the money goes, Subscriptions, Income statement, Ledger, Categorize and Check a statement. Empty Budget says 'Import a bank file first and the page will suggest amounts' as plain text, no link.
- should: The Import page says what to do first with a button: 'First, add the account this file comes from (your checking account or card).' and a filled 44 px 'Add the account' button; after the account is added, 'Now import the bank file' leads back.
- why: Walker gave 4; I set 3. It is not a dead end (the link works and Back returns), but the main button of seven pages answers with a warning, the next step is a 19 px target named after a page, not an action, and after adding the account the person is not led back.
- cause: modules/transactions/import/view.js:26: `if (!d.accounts.length) { root.append(ui.notice('warn', ... ui.h('a', { href: '#/balance/net-worth' }, 'Net worth'))); return; }`. One line; the seven pages only link to it.
- fix: In import/view.js:26 draw a small card instead of the notice: the sentence above plus ui.h('a', { class: 'btn', href: '#/balance/net-worth?from=import' }, 'Add the account'); on balance/net-worth, when ?from=import and an account was just added, the green notice carries a secondary button 'Now import the bank file'. On cashflow/budget make 'Import a bank file' in the empty lede a link. Fixes all nine entry points from one page.
- evidence: $SP/ux/p-cashflow-a/verify/cf1-rec-empty.png, $SP/ux/p-cashflow-a/verify/cf1-import-noaccount.png, $SP/ux/p-cashflow-a/verify/cf1-networth.png, $SP/ux/p-cashflow-a/verify/cf1-after-add-account.png (scripts v1.mjs, v1b.mjs)

## p-cashflow-a/CF-5 (severity 3, navigate, scope several-pages, owner claude-b, confirmed)
**Bills and regular payments, Subscriptions and Irregular expenses list what you typed with nothing to tap: no way to change a bill, and 'Import a bank file' is gone once one bill is typed**

- pages: cashflow/recurring, cashflow/subscriptions, cashflow/sinking-funds
- reach: every household with typed bills and no bank file (family, ruth, renterDebt, demo: all of them)
- steps: H.family(), open cashflow/recurring; tap 'Mortgage payment'. Then open cashflow/subscriptions and cashflow/sinking-funds.
- saw: Bills: 15 rows, no control inside the page (census: 0); a tap on a row does nothing (nothingHappened true). The hero tells a household with no transactions at all 'Nothing regular found in the transactions yet: it takes two or three occurrences of the same payee to be sure'. The only link on the screen is the path's 'Continue your plan: step 2 of 8'. ruth 9 rows, renterDebt 8, demo 15: the same. Subscriptions: 1 row ('Streaming'), 0 controls. Irregular expenses: 2 rows, each 'date unknown', 0 controls. The Budget page draws the same row and there it is tappable (CF-8), so one look means two things.
- should: Under the list: 'Change these on Expenses' and 'Change what comes in' buttons; with no bank file on record the hero offers 'Import a bank file' and says these are the bills you typed.
- why: A person who sees a wrong bill, or 'date unknown', has no way from here to fix it and no hint where it is fixed; the page's main first-time action (Import) has disappeared.
- cause: modules/cashflow/recurring/view.js:38-44 draws plain <li> rows with no link; the two buttons exist only in the empty state (line 17); the hero sentence at line 22 does not tell 'no transactions' from 'nothing regular'. Subscriptions and Irregular expenses draw their rows the same way.
- fix: recurring/view.js: after the list, ui.row(a.btn.secondary 'Change these on Expenses' -> #/cashflow/expenses, a.btn.secondary 'Change what comes in' -> #/cashflow/income); when the plan has no transactions the hero reads 'These are the bills you typed. Import a bank file and this page also finds the ones you forgot.' with the filled 'Import a bank file'. One 'Change it on Expenses' button under the list on Subscriptions and Irregular expenses.
- evidence: $SP/ux/p-cashflow-a/verify/cf5-recurring-family-top.png, $SP/ux/p-cashflow-a/verify/cf5-recurring-family-end.png, $SP/ux/p-cashflow-a/verify/cf5-cashflow-subscriptions-family.png, $SP/ux/p-cashflow-a/verify/cf5-cashflow-sinking-funds-family.png (scripts v5.mjs, w1.mjs, w2.mjs)

## p-cashflow-b-goals/F2 (severity 3, next, scope several-pages, owner claude-b (sinking-funds, subscriptions, recurring, forecast); claude-a (cashflow/statement), confirmed)
**Irregular expenses, Subscriptions and Bills list what you typed with no way to change it or add to it**

- pages: cashflow/sinking-funds, cashflow/subscriptions, cashflow/recurring, cashflow/forecast, cashflow/statement
- reach: the read-out pages of Cash flow, whenever they have data
- steps: Family household. Open cashflow/sinking-funds ('Summer trip $3,000 once a year · date unknown'), cashflow/subscriptions ('Streaming typed'), cashflow/recurring (15 typed rows). Tap a row. Look for any button or link.
- saw: Zero controls inside all three pages (census: only the shell's 'Continue your plan' row). Tapping the Summer trip row changes nothing (same address, same height, no chevron). 'date unknown' appears on both irregular costs with nothing to set a date. The link to Expenses exists only in the empty state. Bills says in words 'the bills typed on Expenses are listed below' but gives no link; Forecast names 'the Expenses and Income pages' with no link; Cash-flow statement has only Print.
- should: Under each list one outlined button 'Change these on Expenses' (to #/cashflow/expenses); a typed row is a link there; 'date unknown' becomes 'no date yet: add one on Expenses'.
- why: The rows look like the tappable rows elsewhere in the app. A person who sees a wrong amount or 'date unknown', or wants to add one more yearly cost, has to guess that the answer is another page and find it in the menu.
- cause: modules/cashflow/sinking-funds/view.js:19-35 and modules/cashflow/subscriptions/view.js:18-29: the link to Expenses is drawn only in the empty branch (lines 16 and 15); rows are plain <li>. modules/cashflow/recurring/view.js:38: typed list with no link.
- fix: Add ui.row(ui.h('a', { class: 'btn secondary', href: '#/cashflow/expenses' }, 'Change these on Expenses')) under the list on the three pages; sinking-funds line 31: ' · no date yet' and make the row an <a>. It sits inside the card, so the page still ends with its one way on (design log 2026-11-06).
- evidence: $SP/ux/p-cashflow-b-goals/verify/f2-family-cashflow_sinking-funds.png, $SP/ux/p-cashflow-b-goals/verify/f2-family-cashflow_subscriptions.png, $SP/ux/p-cashflow-b-goals/verify/f2-family-cashflow_recurring.png

## p-taxes/T3 (severity 3, next, scope several-pages, owner claude-b, confirmed)
**With nothing entered yet, five tax pages show $0 answers and say 'add it on the Income page' with nothing to tap**

- pages: taxes/federal, taxes/withholding, taxes/estimated, taxes/capital-gains, taxes/brackets
- reach: these five only. taxes/state is narrowed out (no figure until a rate is typed); taxes/self-employment, taxes/filing-status, taxes/projection and eight pages elsewhere do it right
- steps: H.blank() (same with H.empty()): open taxes/federal, then taxes/withholding, taxes/estimated, taxes/capital-gains, taxes/brackets.
- saw: Federal estimate: tiles '$0 Federal tax, 0.0% Of your income, 0% On the next dollar, $0 Taxable income' and a ladder of $0 rows (8 times '$0' on a 3,191 px page). Withholding: '$0 Tax for the year, $0 Withheld by December'. Estimated payments: four $0 tiles. Capital gains: three $0 tiles and 'With your income, $65,550 of long-term gain would be taxed at 0%'. Bracket explorer: '$0 Extra tax ... You keep $10,000'. The hint 'No income on file yet: add it on the Income page or type it on the Federal estimate page.' is plain text: none of the five pages has one link in its content, and federal, withholding and estimated have no filled button on the first screen. With the same empty plan cashflow/paycheck, debt/payoff, cashflow/forecast, retirement/projection, insurance/life-needs and investments/fees show no tiles and one filled button ('Open Income', 'Add your debts', 'People').
- should: With no income counted: the heading, one plain line ('Add what you earn first, then this page works out your tax.'), one filled button 'Add your income' (to Income), no tiles and no ladder. Federal estimate keeps its 'or type it here' section below.
- why: 'My tax is $0, so I am done?' or 'it is broken'. The page names the next step but the person has to open the menu and find Income by themselves.
- cause: The views draw their stat rows whatever the plan holds: modules/taxes/federal/view.js:96, modules/taxes/estimated/view.js:64, modules/taxes/capital-gains/view.js:36-41, modules/taxes/withholding/view.js (the stat card after the notes), modules/taxes/brackets/view.js:37-43. The hint is a text note from compute (withholding/compute.js:385, estimated/compute.js:108, federal/compute.js:622) shown through ui.notice.
- fix: In each of the five views: when compute reports no income (hasIncome false / nothingCounted), skip the stat card (and Federal's ladder) and follow the note with ui.h("a", { class: "btn", href: "#/cashflow/income" }, "Add your income"). No shell change.
- evidence: p-taxes/verify/t3-federal.png, p-taxes/verify/t3-withholding.png, p-taxes/verify/t3-estimated.png, p-taxes/verify/t3-capital-gains.png; scripts p-taxes/verify/t3.mjs, t3b.mjs

## p-transactions-helpers/T2 (severity 3, next, scope several-pages, owner claude-b, confirmed)
**With no account yet, the first step is the least visible thing on the screen (narrowed: it is not a circle)**

- pages: transactions/ledger, transactions/import, transactions/categorize, transactions/reconcile
- reach: Four pages above. Duplicates and Transfers on an empty plan only say 'Import a bank file first' in text, with no link.
- steps: H.blank() (same with H.empty()), open transactions/ledger, tap the filled 'Import a bank file', then the 'Net worth' link.
- saw: Ledger: two filled buttons ('Import a bank file', 'Add a transaction by hand') and the real first step, 'Add an account first', outlined between them. Import: an amber line 'Add the account first (the checking account or card the file belongs to): Net worth'; the only control is that inline link, 70 x 19 px. The link works: Net worth opens with its 'Add an account' form on the first screen and the phone's Back returns to Import, so nobody is trapped. Categorize and Check a statement lead with a filled 'Import a bank file' to the same amber line. 'Add a transaction by hand' opens a form whose Account box is empty (0 choices) and saves a line that belongs to no account. ai/categorizer and transactions/statements, which the walker listed, are not offered on a phone without the computer (see T10).
- should: No account yet: one filled button on each of these pages, 'Add your checking account or card first', at least 44 px, going to the add-account form; the sentence says why ('The app needs to know which account the file is from'). Import and by-hand are outlined or held back until an account exists.
- why: Reproduced. Narrowed from the walker's 'sent in a circle' (4): one detour through a 19 px link named after a page, not a loop.
- cause: ledger/view.js:51 (filled Import, outlined 'Add an account first'), :83 (by-hand button filled while the list is empty), :16 (Account options empty); import/view.js:26 (notice with an inline link); categorize/view.js:25 and reconcile/view.js:45 (link to Import whatever the accounts).
- fix: import/view.js:26: replace the inline link with ui.row(ui.h('a', { class: 'btn', href: '#/balance/net-worth' }, 'Add the account')). ledger/view.js:51: when plan.accounts is empty make 'Add an account first' the filled button and Import secondary; :83 always secondary while the hero shows a filled button, and not offered with no account. Same one-line swap in categorize:25 and reconcile:45 when there is no account.
- evidence: $SP/ux/p-transactions-helpers/verify/t2-blank-import.png

## p-debt-property/DP-7 (severity 2, next, scope page, owner claude-b (debt/ratios), confirmed)
**What lenders see, on an empty plan, shows $0 tiles and dashes and has no button, only two links inside sentences**

- pages: debt/ratios
- reach: This page with no income and no debts on file.
- steps: H.empty(), open debt/ratios.
- saw: No filled button on the screen (state().filledOnScreen is empty). Two $0 tiles and four rows ending in '-' fill the page (1261 px). The ways on are 'enter it on the Income page' (291x36, wrapped over two lines) and 'Add them on the Debts page' (176x16) inside small grey sentences. Both links work and Back returns to the page at scroll 0.
- should: With no income: the hero, one filled 'Add your income' button, an outlined 'Add your debts', and no tiles or rows until there is a number.
- why: It breaks the app's own rule 14 (an empty state says what to do first instead of showing zeros and empty tables) and the next step is a 16 px high phrase. Lowered from 3: the hero does say what to do and the links work.
- cause: modules/debt/ratios/view.js:11-33 always draws the tiles and the rows; the only actions are inline <a> at lines 14-15.
- fix: In view.js, when !d.hasIncome: append ui.row(a.btn 'Add your income' to #/cashflow/income, a.btn.secondary 'Add your debts' to #/balance/liabilities) to the hero and return before the tiles. The 2026-09-16 choices for this page (spelled-out words, empty icon box) are untouched.
- evidence: $SP/ux/p-debt-property/verify/v8_ratios_empty.png

## p-insurance-estate/x-4 (severity 2, next (empty state), scope page, owner claude-b, confirmed)
**Estate tax on first open shows '$0 Your estate today' and a verdict instead of saying what to do first**

- pages: estate/estate-tax
- reach: 1 page of the 15 (the other 14 open with an intro and a first step when the plan is empty)
- steps: First open (no plan). Open estate/estate-tax.
- saw: Two figures, '$0 Your estate today' and '$15,000,000 Room under the exemption', then 'Federal estate tax is very unlikely to touch this estate.' No intro, no filled button. 'Set your state on People...' is plain text, not a link. The only way on is the quiet 'Start your plan' row at the bottom.
- should: With nothing owned on file: a short intro ('Estate tax only matters for very large estates. Add what you own and the page checks yours.') and one filled 'Add what you own'; 'People' in the state line is a link.
- why: AGENTS.md rule 14: an empty page explains what to do first instead of showing zeros. A verdict about a $0 estate reads as a real answer.
- cause: estate/estate-tax/view.js:20-26 draws the stat row and verdict unconditionally; :41 writes the People hint as text.
- fix: view.js: when d.estateToday is 0 and there are no accounts, draw a hero with the intro and a filled link to the page where accounts are added, and skip the stats; make 'People' an <a href="#/household/people">.
- evidence: $SP/ux/p-insurance-estate/verify/m3-empty-estate-estate-tax.png ; $SP/ux/p-insurance-estate/verify/m3.mjs

## p-retirement-b/RB2 (severity 2, next, scope several-pages, owner claude-b, confirmed)
**Empty retirement pages send a first-time person to another empty page that repeats the same list**

- pages: retirement/withdrawal-strategy, retirement/withdrawal-order, retirement/roth-conversions, retirement/cash-flow, retirement/buckets, retirement/sequence-risk, retirement/monte-carlo, retirement/historical
- reach: 8 retirement pages, empty or part-filled plans only
- steps: empty (first open): open retirement/withdrawal-order. Tap the filled 'Open Will the money last?'.
- saw: The page lists three things it needs as plain text (no links), then one filled button 'Open Will the money last?' (222x44) and the quiet row 'Start your plan: a few easy questions >'. The button lands on retirement/projection, which lists the same three things again, this time with buttons (People filled, Accounts, Expenses). So: one extra screen and a re-read before anything can be typed. Not a dead end: both ways lead somewhere useful, Back returns to the page at scroll 0.
- should: The page's own button goes where the first missing thing is typed, as Will the money last? already does: 'People' filled, 'Accounts' and 'Expenses' outlined, in place of the text list and the detour. The quiet 'Start your plan' row stays as it is.
- why: Reproduced on all five pages in empty and blank plans, and the same detour is on sequence-risk, monte-carlo and historical; fire, longevity, debt/payoff and investments/allocation send the person straight to the page where the missing thing is typed. Lowered from 3 to 2: it costs one tap and a re-read, nobody is stuck. The walker's fix ('drop the second row') must not be done: that row is the owner's path rule (design log 2026-11-06, 'one quiet Continue your plan row').
- cause: Each view's !d.ready branch prints d.missing as a text list and links to #/retirement/projection: withdrawal-order/view.js:13, withdrawal-strategy/view.js:29, roth-conversions/view.js:18, cash-flow/view.js:15, buckets/view.js:35. projection/view.js:46-48 has the three buttons.
- fix: One small helper in modules/retirement (for example needsButtons(ui, d.missing), the three links projection draws) used by the eight empty branches. No shell change; the frame's quiet row is untouched.
- evidence: $SP/ux/p-retirement-b/verify/rb2-empty-withdrawal-order.png; $SP/ux/p-retirement-b/verify/rb2-empty-projection.png

