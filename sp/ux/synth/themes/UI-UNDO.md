# UI-UNDO: One tap removes or overwrites with no question and no way back

9 verified findings (each reproduced on screen by an independent skeptic). Scripts and pictures for a finding `<walker>/<id>` are in `$SP/ux/<walker>/` and `$SP/ux/<walker>/verify/`.

## p-cashflow-b-goals/F3 (severity 4, back, scope several-pages, owner claude-b, confirmed)
**'Not a subscription' removes the row with no word and no way back; two quick taps remove two**

- pages: cashflow/subscriptions, cashflow/recurring
- reach: Subscriptions and Bills, whenever bank lines are in
- steps: Family household plus four months of bank lines (verify/tx.mjs). Open cashflow/subscriptions: Streaming (typed), Netflix, Spotify. Tap 'Not a subscription' on Netflix. Then, in a fresh browser, tap that same spot twice (80, 250 or 400 ms apart).
- saw: One tap: Netflix gone in 352 ms, $894 -> $708 a year, no notice, no bottom toast, no Undo, no 'hidden' line; nothing on any page puts it back. It also left Bills and regular payments (Netflix listed before, not after), which the button's words do not say. Two taps: Spotify slides up under the thumb (its button moves from y=467 to y=377) and goes too: $576 a year, 1 subscription, in all three timings. Bills has the same button ('Not a bill', 81x44): same silence; its small print then says '1 hidden so far' and offers no way to bring it back.
- should: After the tap: a green line 'Netflix taken off this list (and off Bills).' with an Undo button; a quiet last row 'Hidden: Netflix. Put back' while anything is hidden; a second tap within about a second of a redraw does nothing.
- why: A slip of the thumb while scrolling (the button is 141x44 beside the amount) hides a real subscription for good, from two pages, and the person is not told. The yearly total they came to read is now wrong and they cannot repair it short of restoring a backup.
- cause: modules/cashflow/subscriptions/view.js:27 and modules/cashflow/recurring/view.js:28: store.update adds the key to plan.recurringIgnored with no pending notice; nothing in the app ever removes a key (grep: only these two writers). The list redraws at once, so the next row takes the tapped place.
- fix: Both views: module-level pending = { text, key }; next render shows ui.notice('ok', ...) with ui.button('Undo', remove the key); a 'Hidden' row listing plan.recurringIgnored names with 'Put back'; ignore a tap that arrives under 700 ms after the last removal.
- evidence: $SP/ux/p-cashflow-b-goals/verify/f3-before.png, $SP/ux/p-cashflow-b-goals/verify/f3-two-taps.png, $SP/ux/p-cashflow-b-goals/verify/f3-bills-after.png

## p-investments/INV-2 (severity 4, back, scope several-pages, owner claude-b pages (holdings, tax-lots, employer-stock, retirement/contributions, taxes/capital-gains, career/business); claude-a for taxes/documents, confirmed)
**Remove deletes at once on these pages: no question, no undo (the rest of the app asks first)**

- pages: investments/holdings, investments/tax-lots, investments/employer-stock, retirement/contributions, taxes/capital-gains, career/business, taxes/documents
- reach: 7 pages remove without asking; 17 other pages already ask through ui.confirm
- steps: Family plus invented holdings (held()): Holdings > tap the BND row > 'Remove this holding'. Tax lots > 'Remove lot' under any lot. Employer stock > '+ Add another grant' > 'Remove' beside the grant. Family: Retirement > Contributions > tap a row > 'Remove this contribution'.
- saw: No question in any of the four (0 dialogs). BND and its 2 lots gone in 388 ms; a lot gone; the grant gone in 421 ms; the contribution gone. Feedback is only '... removed.' in the bottom confirmation, which cannot be tapped (pointer-events: none) and has no Undo. Tax lots shows an outlined 'Remove lot' under every lot (4 on one screen), the same look as any harmless button. On Income and Goals the same action asks first: 'Remove Ana's salary?'.
- should: Ask first, in the app's own way: 'Remove BND and its 2 lots?' / 'Remove this lot (200 shares, 3/10/2021)?' / 'Remove New-hire RSU grant?'.
- why: A thumb that lands on 'Remove lot' while scrolling loses a purchase record that took a brokerage statement to type; there is no way back.
- cause: The handlers call store.update directly: modules/investments/holdings/view.js:62, tax-lots/view.js:67, employer-stock/view.js:146, modules/retirement/contributions/view.js:323, modules/taxes/capital-gains/view.js:67, modules/career/business/view.js:158, modules/taxes/documents/view.js:56. Compare modules/cashflow/income/view.js:112: if (!ui.confirm(`Remove ${name}?`)) return;
- fix: Add the same one-line ui.confirm guard to each of the 7 handlers, naming the thing and what goes with it. No shell change needed. (Seen on screen for the first four pages; the last three by the same code.)
- evidence: $SP/ux/p-investments/verify/inv2-holdings-after-remove.png, $SP/ux/p-investments/verify/inv2-lots-before-remove.png, $SP/ux/p-investments/verify/inv2-es-before-remove.png

## p-cashflow-b-goals/x-4 (severity 3, back, scope page, owner claude-b, confirmed)
**'Use these amounts' rewrites the monthly amount on every goal in one tap, with no way back**

- pages: goals/prioritizer
- reach: goals/prioritizer
- steps: Family household. Open goals/prioritizer. Tap the filled 'Use these amounts'.
- saw: Four goals changed at once: Emergency fund $400 -> $1,189 a month, Replace Bo's car $300 -> $836, Cy's college $250 -> $585, Japan trip $0 -> $673. A green 'Monthly amounts set on your goals.' shows in view. No Undo; the old amounts are shown nowhere afterwards; the button stays filled and offers the same again. Seen twice.
- should: The green line carries Undo ('Monthly amounts set on 4 goals. Undo'), and once the amounts match, the button gives way to 'Your goals already use these amounts'.
- why: 'Putting in each month' is what the household really pays in. One tap on the page's only filled button replaces four of those facts with the page's suggestion. Someone who taps it to see what it does cannot get their own figures back unless they remember them.
- cause: modules/goals/prioritizer/view.js:50-53: store.update overwrites g.monthly for every row; pending holds only the sentence.
- fix: Keep the previous amounts in a module-level variable when the button is used; draw the notice with ui.button('Undo', restore them); draw the button outlined or replace it with the sentence when every row's allocated equals its monthly.
- evidence: $SP/ux/p-cashflow-b-goals/verify/x-pri-0.png, $SP/ux/p-cashflow-b-goals/verify/x-pri-1-after.png

## p-retirement-b/x-3 (severity 3, back, scope page, owner claude-b, confirmed)
**'Plan on $6,600 a month' lowers the plan's retirement spending in one tap, with nothing on the page to take it back**

- pages: retirement/withdrawal-strategy
- reach: withdrawal-strategy, households whose spending is above the careful figure (family)
- steps: family: open retirement/withdrawal-strategy, wait about a second for the button to appear under the first card, tap 'Plan on $6,600 a month'.
- saw: plan.retirement.spendingMonthly 7000 -> 6600 (every retirement page uses it). A green notice in view says 'Your plan now spends $6,600 a month on top of health insurance (it was $7,000)...' and removes itself after 4 s. After that the page says 'You plan $6,600 a month', the button is gone, and the only controls are three 'Use this one' buttons: no Undo, no link, and no mention that the figure lives under Retirement settings on Will the money last?. Reproduced twice.
- should: After the tap the first card keeps an outlined 'Undo: back to $7,000 a month' until the page is left; or at least 'You plan $6,600 a month' is followed by an outlined 'Change it' that opens Retirement settings on Will the money last?.
- why: It is the first button on the page and reads like advice being accepted; a person who taps it to see what happens has changed a figure every retirement page rests on, and the only record of the old figure is a message that is gone in four seconds.
- cause: modules/retirement/withdrawal-strategy/view.js:130-133 (the button writes saveSpendingFigure and sets a 4 s pending notice; nothing remembers the old figure).
- fix: A module-level undo = { was } set in that click handler; when set, the hero draws ui.button('Undo: back to $7,000 a month', ..., { class: 'secondary' }) that writes the old figure back and clears it.
- evidence: $SP/ux/p-retirement-b/verify/planon-0.png; $SP/ux/p-retirement-b/verify/planon-1.png; $SP/ux/p-retirement-b/verify/planon-2.png

## p-taxes/x-4 (severity 3, back, scope several-pages, owner claude-b (capital-gains), claude-a (documents), confirmed)
**'Remove this sale' and a tax paper's 'Remove' delete at once: no question and no undo**

- pages: taxes/capital-gains, taxes/documents
- reach: these two tax pages, seen on screen; by a code search 29 of the 41 page files with a Remove call a confirm and 12 never do (the other ten were not tried on screen)
- steps: family, taxes/capital-gains: add a sale ('Index fund', sold for 12000, cost 9000), tap its row, tap 'Remove this sale'. family, taxes/documents: add a document of your own, then tap its 'Remove'.
- saw: Both are gone at once ('Sale removed.', '... removed from the list.'): no dialog fired, no Undo on the page or in the bottom message. The red 'Remove this sale' sits 12 px under 'Save changes' (tops 542 and 598 px).
- should: Ask first, in the page's words: 'Remove Index fund from this year's sales?' with Cancel, as the other pages do; then the green 'Sale removed.'
- why: One slip of the thumb below Save changes and the sale and its three figures are gone, with no way back.
- cause: modules/taxes/capital-gains/view.js:67 and modules/taxes/documents/view.js:53-57 call store.update straight from the button.
- fix: Wrap both in if (ui.confirm(...)) with the item's name in the question.
- evidence: p-taxes/verify/x3-cg-edit.png (Remove 12 px under Save changes), p-taxes/verify/x3-cg-removed.png; scripts p-taxes/verify/x3.mjs, x4.mjs

## p-transactions-helpers/T11 (severity 3, back, scope page, owner claude-b, confirmed)
**Categorize: one pick files every transaction from that payee and writes a rule, with no way to take it back**

- pages: transactions/categorize
- reach: transactions/categorize.
- steps: H.family(), import chase-checking.csv, wellsfargo-checking.csv and bofa-checking.csv, open transactions/categorize, choose 'Pets' in the Kroger Dayton row (a slip of the thumb), then tap 'File all N suggested'.
- saw: The row is gone at once; the confirmation ('Kroger Dayton filed under Pets (2 transactions).') is shown by the bottom echo, with nothing to tap; census finds no Undo or Change control on the page. A rule '"kroger" -> Pets' was written, the next Kroger line was then suggested as Pets and 'File all' filed it too (Ledger: three Kroger lines under Pets). Getting it back means editing each line in the Ledger and removing the rule on Rules. Movement: when scrolled down the list, the rows jump 87 px down on every pick because the notice is inserted at the top of the page (183 px on the last row); focus goes to the page body. 'File all' asks through the browser's own box (the app's ui.confirm, used 43 times across the app). Two or three filled buttons on screen ('File all', an 'OK' per suggested row).
- should: The filed row stays in place for that visit as one quiet line: 'Kroger Dayton: filed under Pets. Undo'. Undo puts the transactions back to no category and removes the rule it wrote. Nothing is inserted above the list, so nothing jumps.
- why: Reproduced twice. The walker rated the redraw as rough (2); the missing way back is the part that costs a person real work, so 3.
- cause: modules/transactions/categorize/view.js:103 (the select's onChange applies at once), :44-58 (apply() files, renames and writes the rule; only a top-of-page pending line at :20), :60-75 (applyAll through ui.confirm).
- fix: Keep a module-level lastFiled = { payee, ids, before: [{id, category, payee}], ruleId }; in drawList render that group as a done row with an 'Undo' button (store.update restores the fields and drops the rule); drop the top-of-page notice for single picks (the done row is the confirmation).
- evidence: $SP/ux/p-transactions-helpers/verify/x-categorize-mispick.png

## p-transactions-helpers/x-duplicates (severity 3, back, scope page, owner claude-b, confirmed)
**Duplicates: 'Remove the copy' deletes a transaction in one tap, with no question, no message and no way back**

- pages: transactions/duplicates
- reach: transactions/duplicates ('Remove all N copies' does ask first).
- steps: H.family(), import verify/checking2.csv (two Netflix charges of $15.49 a day apart) into Chase checking, open transactions/duplicates, tap 'Remove the copy'.
- saw: The line is deleted at once; no notice, no echo, no dialog. The page then reads 'No duplicates. Exact repeats are already refused when you import; nothing near-identical was found either.', as if nothing had been there. (The Ledger asks 'Delete ...?' before the same deletion.) The walker could not reach this page's buttons: its helper imported every file into the first account and the fixtures hold no near-duplicates.
- should: After the tap the pair stays as one line: 'Removed the copy from 10/7/2026. Undo', until the person leaves the page; the heading counts down. Undo puts the line back.
- why: Two real charges a day apart look exactly like this; a wrong tap silently removes a real transaction and the only way back is to notice and re-import the bank file.
- cause: modules/transactions/duplicates/view.js:27 (store.update filters the transaction out; nothing kept) and :17 (the page returns early with 'No duplicates' once the list is empty).
- fix: Keep the removed transaction in a module-level 'removed' list for the visit; draw a 'Removed ... Undo' row per entry (Undo pushes it back with store.update); show the rows above the early return at line 17.
- evidence: $SP/ux/p-transactions-helpers/verify/x-duplicates-removed.png

## j-first-retiree/R4 (severity 2, touch, scope several-pages, owner claude-b pages, confirmed)
**'I've taken it' is a second filled button on Step 6, and 'Use this one' changes her spending in one tap with no named way back**

- pages: retirement/rmd, retirement/withdrawal-strategy
- reach: Steps 5 and 6 of a retired household's path.
- steps: H.empty() as Ruth to the reveal. Step 5 (retirement/withdrawal-strategy?guide=plan&step=take-out): tap the first 'Use this one'. Step 6 (retirement/rmd?guide=plan&step=rmd): tap 'I've taken it'.
- saw: Narrower than the walker wrote. Step 5: 'Use this one' is outlined, not blue. One tap moves the plan from 'Same spending every year, about $2,500 a month' to 'A share of what is left, about $4,727'; the green line names the old figure; there is no Undo, but 'Use this one' on 'Same spending every year' put it back exactly (I checked the saved plan). Step 6: 'I've taken it' is filled (117x44 at y 909 of a 1,675 px page) and the step's own way on, about 570 px lower, is filled too, so both can be on one screen. One tap records today's date; the card then says 'Marked as taken on November 11, 2026' with an outlined 'Not yet' that puts it back in one tap ('Ruth's 2026 withdrawal is back on the list.').
- should: On a step of the path the Next is the only filled button; the way back is named.
- why: Nothing is lost and both changes can be put back in one tap, so 2, not 3. What makes it rough is elsewhere: the green line leaves after 4 s (x-2) and a double tap flips the choice back (R1).
- cause: modules/retirement/rmd/view.js line 152 (ui.button with no class, so filled) and line 136 ('Not yet'); modules/retirement/withdrawal-strategy/view.js line 196 (one tap, no way back named).
- fix: rmd/view.js line 152: add { class: "secondary" } while the page is drawn as a step of the path; line 136: 'Undo: not taken yet'. withdrawal-strategy: the green line carries a button 'Put it back: Same spending every year'. Keep 'Use this one' and its place on its own line: the owner chose that (docs/DESIGN_LOG.md, 2026-09-16, Pass 4 round 1, Finding 3).
- evidence: $SP/ux/j-first-retiree/verify/g-step6-full.png, g-step5-full.png, t-notice-shown.png (scripts g.mjs, h.mjs, w.mjs)

## p-balance/x-4 (severity 2, back, scope page, owner claude-b, confirmed)
**'Yes, count it as my emergency fund' changes the plan in one tap and the page offers no way to take it back**

- pages: balance/liquidity
- reach: None
- steps: H.family(), balance/liquidity. In 'Your next move', tap 'Yes, count it as my emergency fund'.
- saw: No question. The headline goes from 0.9 to 3 months covered, the whole 'Your next move' card disappears (page 336 px shorter) and the notice 'Done: the "Emergency fund" goal's money now counts as your emergency fund...' is drawn above the screen, with a toast copy at the bottom. Nothing on the page says how to change it back; the only switch is the checkbox 'This goal is my emergency fund' on another page (goals/emergency-fund), which nothing here links to.
- should: The Done line carries an Undo (as Update my balances' notice does after a history fix), or the fund card keeps one quiet line: 'Counting the "Emergency fund" goal's $11,500. Change ›'.
- why: Missed by the walker (the button was tapped, the way back was not looked for). Reproduced twice.
- cause: modules/balance/liquidity/view.js:100-102 sets g.isEmergencyFund = true and keeps nothing to undo with.
- fix: Keep the goal id in pending; the notice (line 52) appends ui.button("Undo", ...) that sets isEmergencyFund back to false. With the B2 shell change the toast would carry that button.
- evidence: $SP/ux/p-balance/verify/lq-after-yes.png, $SP/ux/p-balance/verify/v-lq.mjs, $SP/ux/p-balance/verify/v-fin.mjs

