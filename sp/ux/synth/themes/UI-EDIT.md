# UI-EDIT: Tapping a row opens its form far away; Save or Cancel does not return to the row; focus is left nowhere; a stray tap on another row swaps the form

5 verified findings (each reproduced on screen by an independent skeptic). Scripts and pictures for a finding `<walker>/<id>` are in `$SP/ux/<walker>/` and `$SP/ux/<walker>/verify/`.

## p-transactions-helpers/T9 (severity 4, back, scope several-pages, owner claude-b, confirmed)
**Tapping a row to edit it throws the page to a form far away, and Cancel or Save leaves you there, not at the row**

- pages: transactions/ledger, transactions/categories, transactions/rules
- reach: Measured: ledger, categories, rules. Same code (formCard/formHost.scrollIntoView) in 19 more pages: cashflow/expenses, cashflow/income, cashflow/budget, balance/net-worth, balance/liabilities, household/people, goals/goals, goals/travel, insurance/policies, insurance/health, estate/inheritance, estate/digital, estate/legacy, estate/gifting, retirement/contributions, retirement/annuities, retirement/pensions, investments/holdings, taxes/capital-gains. Spot checks outside this group: cashflow/expenses jumps 572 px on a row tap, household/people 534 px.
- steps: Ledger: H.family(), import a 150-line bank file (verify/big150.csv; any 3-month bank file is this long), open transactions/ledger, tap 'Show more', scroll to the 120th row, tap it, then tap Cancel (or change the category and tap 'Save changes'). Categories: H.family(), transactions/categories, tap 'Pets', then Cancel. Rules: with 12 rules on file tap the first rule, then Cancel.
- saw: Ledger, 150 rows: the tap scrolls the page UP 8,075 px to the form above the list; after Cancel the page stays at scrollY 483 and the row is 8,501 px below (ten screens). With 16 rows: jump of 758 px, row left 375 px under the fold; after 'Save changes' the screen is pixel-identical to the one after Cancel (no notice, changed row off screen). Categories: tapping Pets (row at y=427) scrolls 1,399 px DOWN to a form at the end of the 2,390 px page; Cancel leaves scrollY 1546 with Pets 568 px above the screen, in the 'Money in' list. Rules, 12 rules: form opens 1,068 px below the row; after Cancel the row is 177 px above the screen. For comparison the phone's Back does restore the scroll position on these pages (7 pages, 2 rounds).
- should: The form opens directly under the row that was tapped (the row stays where it is, nothing scrolls). Cancel closes it in place. After Save the row is still where the thumb was, showing its new value, with the confirmation beside it.
- why: Reproduced on three pages. Fixing three categories in a long ledger means finding your place three times; after Save there is nothing on screen to show that the change took.
- cause: One shared form card at a fixed spot plus scrollIntoView: ledger/view.js:79-80,119,134-135 (form card above the list; onCancel at :98 only redraws the form), categories/view.js:25,72,84,88-89 (form card appended at the end of the page), rules/view.js:70,77 (form after the list). Nothing remembers the row or the scroll position.
- fix: Smallest: in the row's onClick move formHost into the list right after the tapped <li> (list.insertBefore(formHost, li.nextSibling)) instead of scrollIntoView; on Cancel put it back. After Save the shell already keeps scrollY (core/app.js show(), keepScroll), so the row stays put. A small ui helper (e.g. ui.openUnder(li, formEl)) would let the 19 other pages with the same code use it.
- evidence: $SP/ux/p-transactions-helpers/verify/t9-ledger-after-cancel.png

## j-keyboard-reader/K4 (severity 3, focus, scope shell, owner shell (core/ui/dom.js and core/app.js); pages are claude-b's and need no change, confirmed)
**Opening, saving or cancelling a form leaves the focus nowhere, and a row's edit form opens far from the focus**

- pages: cashflow/income, cashflow/expenses, goals/goals, balance/net-worth, household/people, balance/liabilities
- reach: every page with a list and an add or edit form; keyboard and screen-reader users, phone width and desktop
- steps: family household, 1280x800 (and 390x844), keyboard. Income: Tab to '+ Add another income', Enter, type 'Side gig'. Then fill What is it and Amount, press Enter. Then focus the first row, Enter, and count Tabs to the form's first box. Then Tab to Cancel, Enter. Repeat the open and the row steps on Expenses, Goals, Net worth, People, Debts.
- saw: Income: Enter on '+ Add another income' opens the form and the focus is on nothing; the typed 'Side gig' went nowhere (What is it stayed empty) and its space bar scrolled the page 679 px instead. After the save ('Side gig added.' in view) the focus is on nothing again and the next Tab lands on the first row of the list. Enter on a row opens its edit form 677 px down (792 at phone width) while the focus stays on the row, now off screen; reaching the form's first box took 4 Tabs on Income, 13 on Expenses, 8 on Goals, 4 on Debts, 3 on People. Cancel: focus on nothing. Opening the add form drops the focus the same way on Expenses, Goals, Net worth and People ('typed x went nowhere' on all four). In Chrome one Tab after opening does reach the first box, which is why this is 3 and not 4.
- should: Opened with the keyboard: the cursor is in the form's first box. Saved, cancelled or removed: the focus is on the confirmation or back on the button or row that opened the form, never on nothing.
- why: Someone working by keyboard presses Enter, starts typing, and nothing appears; after each save they start again from the top of the list. With a thumb nothing is lost (you tap the box you want), so this is hesitation for keyboard and screen-reader users.
- cause: Pages: the opener is destroyed when the form is drawn (for example modules/cashflow/income/view.js:83-87 drawForm(), and :154 the row's onClick calls drawForm() and scrolls without moving the focus); no page focuses anything when a form opens. Shell: core/app.js:208 (root.innerHTML = "" in show()) rebuilds the page after every store.update and never puts the focus back.
- fix: Two shared changes, no page edits. (1) core/ui/dom.js form(): when a form built by ui.form is put on the page within half a second of Enter or Space being pressed (one keydown listener in the kit records the time) and the focus is not already in a box, focus its first box. Touch opens are left alone, so the phone keyboard never pops up by itself. (2) core/app.js show() with keepScroll: if the focus was inside #content before the redraw and is on nothing after it, focus the fresh confirmation (the `fresh` notices it already finds at line 258; give it tabindex="-1") or else the page container, with preventScroll.
- evidence: verify/k4.mjs, verify/k4b.mjs, verify/k4c.mjs, verify/k4-phone-form-open-no-focus.png (the add form is open and nothing on the screen has the focus), verify/k4-desk-row-enter.png

## p-balance/B3 (severity 3, back, scope several-pages, owner claude-b, confirmed)
**Edit on a long list throws you a screen and a half away, and neither Save nor Cancel brings you back to the row**

- pages: balance/net-worth, cashflow/expenses, balance/projection
- reach: the long list pages: Net worth (10 accounts) and Expenses (13 bills). Not Debts, Income or People with this household: those pages are short, so the row is back in view. Projection's Assumptions save is the mild case.
- steps: H.family(), balance/net-worth. Scroll until Ana's 401(k) (second row) is mid-screen and tap its Edit. Tap Cancel. Again: Edit on Chase checking, type 1.2k in Current balance, tap Save changes.
- saw: Edit: the screen moves 1,318 px down to a form under the tenth account; the row is now 930 px above the screen. Cancel: the form goes, the page is 516 px shorter and the screen is left at the very bottom (Car loan, Visa card, Over time); the row is 655 px above the screen, layout shift 0.33, no cue. Save changes on Chase checking: same landing; the changed row ($1,200) ends under the top bar (bottom edge at y 10) and only the toast 'Chase checking saved.' shows for 3.6 s. Expenses: tap Mortgage payment: 1,449 px down; Cancel: row 497 px above the screen; Save changes on Groceries: row 413 px above. Projection, Save in Assumptions with Years to show 20: the fold closes, the page shrinks 890 px and the screen lands at the page bottom; the fold's summary shows '20 years' and the toast says Saved. Not reproduced: 'Delete: scroll jumps 740'. With a tap at the button's position the scroll did not move (0 px on Chase checking, Brokerage and House); the 740 was the kit's tapText scrolling the button into view first.
- should: After Save changes or Cancel the screen goes back to the row you were on (in the upper half of the screen); after a save the row flashes once, or the toast names the new value: 'Chase checking is now $1,200'.
- why: Measured in a fresh browser with position taps on two pages. Severity 3, not 4: same page, a toast confirms the save, one flick up finds the row; but it happens on every edit.
- cause: modules/balance/net-worth/view.js:110 edit() draws the form after the whole list and scrolls to it; save() (lines 68-88) and onCancel (line 106) set editing = null and redraw without going back. modules/cashflow/expenses/view.js:337 and :306 do the same. There is no shared helper in core/ui.
- fix: A small helper in core/ui/dom.js, for example ui.backTo(el): scroll el to about a third of the way down the screen and give it a 'just-saved' class for 1.5 s. Both pages call it: on Cancel with the row's li; on save, keep the row id in the module-level pending and call it for that row on the next render (the shell already lets a page that scrolls itself while drawing win, core/app.js:193). Edit and Delete stay on the rows (design log 2026-09-15).
- evidence: $SP/ux/p-balance/verify/nw-edit-open.png, $SP/ux/p-balance/verify/nw-after-save.png, $SP/ux/p-balance/verify/m1-after-cancel.png, $SP/ux/p-balance/verify/b7-proj-20.png, $SP/ux/p-balance/verify/del-before.png, $SP/ux/p-balance/verify/v-nw.mjs, $SP/ux/p-balance/verify/v-miss1.mjs, $SP/ux/p-balance/verify/v-b3w.mjs, $SP/ux/p-balance/verify/v-del.mjs

## p-investments/INV-5 (severity 3, focus, scope page, owner claude-b pages, confirmed)
**Holdings: tapping a fund jumps a screen or more to the form, and Cancel or Save leaves you there, away from the fund**

- pages: investments/holdings
- reach: every edit of a fund that is not in the last account card
- steps: held(): Holdings > scroll to Ana's 401(k) > tap the FXAIX row > 'Cancel'. Repeat and change Shares to 1600 > 'Save changes'.
- saw: FXAIX row at y 400 (page at 298). Tap: the page moves 1,003 px to 'Edit: FXAIX' below every account; the row is 603 px above the screen; focus stays on the row, no box is focused. Cancel: the page rests at 821, the row at y -123 (off screen). Save: page at 968, row at -124, only 'FXAIX saved.' at the bottom. Narrower than reported: a fund in the last account (BND) does stay in view after Save (y 343, new figure visible). Income and Contributions use the same tap-to-edit and do return to the row after Cancel; Holdings does not because of the cards under the form.
- should: The form opens under the tapped row inside its account card (as the owner chose for Debts, 2026-09-15), with the first box focused; Cancel and Save bring that row back into view.
- why: After Cancel or Save the person is looking at a different account and has to scroll back to see whether the change took.
- cause: modules/investments/holdings/view.js:72 (formCard.scrollIntoView), :79-80 (one form card after all account cards), :61 (Cancel only redraws the form).
- fix: Move formHost into the tapped row's card, or keep a module-level lastId and scroll that row to the middle of the screen after Cancel and after the save's redraw. Page-level.
- evidence: $SP/ux/p-investments/verify/inv5-after-cancel.png, $SP/ux/p-investments/verify/inv5-after-tap.png

## p-transactions-helpers/x-halfform (severity 3, back, scope page, owner claude-b, confirmed)
**Ledger: a tap on any row while 'New transaction' is half typed replaces the form and throws the typing away**

- pages: transactions/ledger
- reach: transactions/ledger; transactions/categories shares the code (add form open, then a row tap).
- steps: H.family(), import chase-checking.csv, transactions/ledger, 'Add a transaction by hand', type Who = 'Farmers market', Amount = '-23.75', Note = 'cash, paid for the apples and eggs', then tap the first row of the list (it starts about 200 px under the 'Add transaction' button). Separately: type the same, open another page from the menu, press Back.
- saw: The form becomes 'Edit: Amazon Mktpl Amzn' filled with that row's values; the three typed values are gone, nothing was saved, nothing was said. Cancel then closes the form. Leaving the page and coming Back: the form is closed and empty.
- should: With typing in the form, a row tap asks first in the page ('Finish or cancel the new transaction first'), or the edit form opens under the row and the new-transaction form stays as it is (the T9 fix gives this for free).
- why: Reproduced. The list sits directly under the form, exactly where a thumb rests while checking an earlier amount.
- cause: modules/transactions/ledger/view.js:119 (row onClick sets editing and redraws the one shared form) with the single form host at :79-105.
- fix: With the T9 fix (edit form under the row, its own host) the add form is no longer overwritten. Until then: in the row's onClick, if editing && !editing.id and any box in the form has a value, show a notice at the form and return.
- evidence: $SP/ux/p-transactions-helpers/verify/x-ledger-halfform-after.png

