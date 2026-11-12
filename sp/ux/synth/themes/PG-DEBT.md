# PG-DEBT: Debt and property pages (page-specific)

6 verified findings (each reproduced on screen by an independent skeptic). Scripts and pictures for a finding `<walker>/<id>` are in `$SP/ux/<walker>/` and `$SP/ux/<walker>/verify/`.

## j-debt-fixer/x-1 (severity 4, back, scope page, owner claude-b, confirmed)
**Pay off debts: tapping Up before Save plan throws away the order you chose and the amount you typed**

- pages: debt/payoff
- reach: Pay off debts, for anyone who picks 'My own order' and reorders before saving (the natural order of taps).
- steps: H.renterDebt(), debt/payoff. Order: pick 'My own order' (the 'My own order' card appears). Optionally type 200 in 'Extra each month'. Do not tap Save plan. Tap 'Up' on any row of 'My own order'.
- saw: Twice in fresh browsers: the page redraws, the Order box is back on 'Highest interest rate first', the amount is back to $50, the whole 'My own order' card is gone (page 396 to 414 px shorter), the headline is back to 'Debt-free by July 2030', and there is no notice. The plan file got customOrder but kept order 'avalanche' and extra 50.
- should: Up keeps the screen as it is: the order stays 'My own order', the typed amount stays, the row moves and a green line says 'Visa card moved up to 3rd.' Either Up saves the order with it, or nothing is saved until Save plan and the list reorders on screen only.
- why: The person did exactly what the card asked (move a debt up) and the card vanished with their typed amount; nothing says why or that anything was kept.
- cause: modules/debt/payoff/view.js:104: the Up button's store.update writes only debtPlan.customOrder; the shell then redraws the page from the saved plan (core/app.js:385-387), which still has the old order and extra, so the unsaved select and box are reset.
- fix: payoff/view.js:104: write order: 'custom' and the typed extra (when readable) together with customOrder and set pending = '<name> moved up to <n>.'; or keep a module-level draft order and redraw the lists without store.update until Save plan.
- evidence: $SP/ux/j-debt-fixer/verify/v9-custom-unsaved-before-up.png, $SP/ux/j-debt-fixer/verify/v9-custom-unsaved-after-up.png

## j-debt-fixer/D5 (severity 2, choreography, scope page, owner claude-b, confirmed)
**Refinance: Compare gives no sign of its own, the answer is split above and below the form, and an old answer stays up while you type a new offer**

- pages: debt/refinance
- reach: Refinance. Consolidation's Compare has the section-closing problem (x-3); Mortgage's 'What if' is x-4.
- steps: H.jordan(), debt/refinance. Tap Compare with the rate empty. Type 5.5 in 'Offered rate per year', press Enter. Scroll 124 px, change the rate to 4, tap Compare.
- saw: Narrower than reported. Empty Compare: the browser's 'Please fill out this field.' at the rate box and focus moves to it, which is fine. Enter with 5.5: the page redraws in under a second, the headline changes from 'Refinance' to 'Worth it' at the top of the screen (visible at scrollY 0), the form slides down 76 px (form top 256 to 332), the four result tiles appear below the fold (first at y=816 of 844), focus goes to the page body, no notice. Second Compare (rate 4): the headline word stays 'Worth it' and is off screen; only the tiles under the button change ($1,022 to $859) with nothing saying 'updated'. Between typing 4 and tapping Compare the old $1,022 answer stays on screen unmarked. Compare does respond every time (it was not a dead control).
- should: The whole answer (verdict sentence and tiles) sits in one card directly under Compare, a green line confirms each compare ('Compared: $859 a month, $641 less than now.'), and the answer updates as the boxes change, as Pay off debts does.
- why: On the second offer the person taps Compare and the part of the answer in view barely changes, with no confirmation; they are unsure the new rate counted.
- cause: modules/debt/refinance/view.js:24-33: the verdict is drawn in the hero above the form and the tiles after it; the submit handler (line 31-33) only calls store.update, with no pending notice (the rule that every save confirms itself).
- fix: refinance/view.js: move the tiles' card to follow the form directly and repeat the verdict sentence at its top; add a module-level pending shown as ui.notice('ok', ...) under the button; optionally redraw on input.
- evidence: $SP/ux/j-debt-fixer/verify/v8-refi-after-enter.png, $SP/ux/j-debt-fixer/verify/v8-refi-stale.png

## j-debt-fixer/D8 (severity 2, understand, scope page, owner claude-b, confirmed)
**'My own order' says to move a debt 'with the arrow'; the buttons say 'Up', give no confirmation, and the row under the thumb changes**

- pages: debt/payoff
- reach: Pay off debts, 'My own order' only.
- steps: H.renterDebt(), debt/payoff, Order 'My own order', Save plan, tap 'Up' on row 4 (Visa card).
- saw: The card reads 'Top gets the extra first. Move a debt up with the arrow.' and each row from the second has a button labelled 'Up'; there is no arrow. After Up: Visa card is row 3, Store card is row 4, no notice (newNotices empty), scroll unchanged; the spot just tapped (y=434) now holds Store card's Up, so a second tap there puts the order back. There is no Down.
- should: 'Top gets the extra first. Tap Up to move a debt earlier.' After a move: green 'Visa card moved up to 3rd.' and the moved row briefly marked.
- why: The person looks for an arrow, then cannot tell from the screen that the move was saved, and a second tap to move the same debt further undoes the first.
- cause: modules/debt/payoff/view.js:101 (the sentence) and :104 (the Up button: store.update with no pending notice).
- fix: payoff/view.js:101: change the sentence; :104: set pending = `${y.name} moved up to ${i}.` before store.update (the page already shows pending under Save plan; show it in this card instead). Do together with x-1.
- evidence: $SP/ux/j-debt-fixer/verify/v9-custom-after-up.png

## j-debt-fixer/x-4 (severity 2, input, scope page, owner claude-b, confirmed)
**Mortgage 'What if': typing changes nothing until the box is left, in bare number boxes, and the answers use 'yr', 'mo' and '/mo'**

- pages: debt/mortgage
- reach: Mortgage, the 'What if' card and its tiles.
- steps: H.jordan(), debt/mortgage, tap 'Extra each month', type 200 and wait. Then press Enter (or tap elsewhere). Type 20,000 in 'One lump sum'.
- saw: With 200 typed and the box still focused the tile below reads 'no change · Extra $0 a month · type an extra amount above'. After Enter or leaving the box it becomes '3 yr 1 mo sooner · saves $23,320 of interest; ends 1/11/2040'; focus drops to the page body. There is no button. The two boxes are plain number boxes with no $ sign (placeholder 'e.g. 20000'), unlike every other money box. The lump sum tile reads '$1,331/mo'. The owner chose spelled-out words on 2026-09-16 (Pass 2 round 10: '3 years 10 months', '$75 a month', 'July 2030'); this page was only reviewed empty. What to check on a real phone: the iPhone number pad has no Enter key, so the tile changes only after 'Done' or a tap elsewhere.
- should: The tiles follow each keystroke, as the headline on Pay off debts does; the boxes are the kit's money boxes ($ in front, commas); the answers read '3 years 1 month sooner', '$1,331 a month', 'ends January 2040'.
- why: The tile says 'type an extra amount above' while the amount is already typed; the person waits, then wonders what to tap.
- cause: modules/debt/mortgage/view.js:92-93: ui.input({ type: 'number', onChange }) redraws on change, not on input; the tiles (lines 98-101) use the short monthsText, '/mo' and fmt.date.
- fix: mortgage/view.js:92-93: use ui.moneyBox and listen to 'input' (redraw only the tiles so the box keeps focus); lines 98-101: the long month words and 'a month', month-year dates.
- evidence: $SP/ux/j-debt-fixer/verify/v16-mortgage-typed.png, $SP/ux/j-debt-fixer/verify/v16-mortgage-after.png

## p-debt-property/DP-8 (severity 2, understand, scope page, owner claude-b (debt/payoff; the walker named claude-a, but this page is not on claude-a's list), confirmed)
**Pay off debts: the top says $210 extra is already counted while the 'Extra each month' box shows $0**

- pages: debt/payoff
- reach: Households that set an extra payment on the Debts page (H.family()).
- steps: H.family(), open debt/payoff, read the top card and the first box.
- saw: Top: '$2,790 a month ($2,580 required, $210 extra set on the Debts page)'. Directly under it: 'Extra each month, on top of the required payments' with $0. Typing 1,200 makes it '$2,580 required, $210 extra set on the Debts page, $1,200 more from this plan'. The walker's 'two screens of text away' is wrong: both are on the first screen (hero at 87 px, box at about 380 px).
- should: When an extra is already set elsewhere, the label says so: 'Extra each month, on top of the $2,790 you pay now'.
- why: Someone who really pays $210 extra may type 210 again and count it twice; the label does not say the box is on top of the $210. Lowered from 3 because the sentence above it does spell out the split.
- cause: modules/debt/payoff/view.js:86: the field label is fixed text; d.alreadyExtra is used only in the hero.
- fix: Line 86: when d.alreadyExtra > 0 use `Extra each month, on top of the ${fmt.money(d.required + d.alreadyExtra, cur)} you pay now`.
- evidence: $SP/ux/p-debt-property/verify/v5_payoff_abc.png

## p-debt-property/x-5 (severity 2, understand, scope page, owner claude-b (debt/mortgage), confirmed)
**Mortgage still says '3 yr 8 mo sooner', '$1,830/mo' and 'ends 5/11/2042'**

- pages: debt/mortgage
- reach: The Mortgage page's What if tiles. The owner already chose the spelled-out form for the other debt pages.
- steps: H.family(), debt/mortgage, type 250 in 'Extra each month' and 20000 in the lump sum, look at the tiles.
- saw: '3 yr 8 mo sooner', '2 yr 7 mo sooner', 'ends 5/11/2042', '$1,830/mo'. Pay off debts, Credit cards and What lenders see say '12 years 4 months' and 'March 2039'.
- should: '3 years 8 months sooner', '$1,830 a month', 'ends May 2042'.
- why: The design log already settled this (2026-09-16, Pass 2 round 10, finding 1, option A: '3 years 10 months', '$75 a month', 'Debt-free by July 2030'); this page was not in that round and never got it.
- cause: modules/debt/mortgage/view.js:24 (`yr`, `mo`), line 99 (fmt.date for the end) and line 101 (`/mo`).
- fix: Use the monthsText and monthYear wording of modules/debt/payoff/view.js in those three places.
- evidence: $SP/ux/p-debt-property/verify/v15_mortgage_tiles.png

