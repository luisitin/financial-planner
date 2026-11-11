# PG-TAXINV: Tax and investment pages (page-specific)

10 verified findings (each reproduced on screen by an independent skeptic). Scripts and pictures for a finding `<walker>/<id>` are in `$SP/ux/<walker>/` and `$SP/ux/<walker>/verify/`.

## p-insurance-estate/IE-3 (severity 4, next, scope page, owner claude-b, confirmed)
**Term vs permanent: 'Comparison saved.' with nothing compared, and when it does compare the answer is above the screen**

- pages: insurance/term-vs-permanent
- reach: 1 page
- steps: Household family. Open insurance/term-vs-permanent. Type Death benefit 500,000, Whole-life premium 6000, Term premium 600, leave 'Illustrated cash value' empty, scroll to Compare and tap it. Then type 150000 in 'Illustrated cash value' and tap Compare again.
- saw: First tap: green 'Comparison saved.' toast, no result anywhere; the screen stays at the form (scrollY 848). The only line that says what is missing ('To compare, fill in: ...') is in the intro card at the top of the page, about 500 px above the screen; the toast is gone after 4.5 s. Second tap: the result is drawn and the form folds away, the screen stays at scrollY 829: the answer's heading 'After 20 years' is 677 px above the top of the screen and the person is looking at 'What this leaves out' and a closed 'The figures' fold. With every box empty the same 'Comparison saved.' appears.
- should: Compare with a needed figure missing says so at the button, in words ('To compare, still needed: the illustration's cash value after 20 years.'), marks that box, and never says 'saved' as if it were done. A successful Compare brings 'After 20 years' to the top of the screen.
- why: The button says Compare, the app says saved, and there is no comparison in sight: it reads as broken. When it works, the person still has to guess that the answer is somewhere above.
- cause: insurance/term-vs-permanent/view.js:68-69: the submit handler always sets pending = 'Comparison saved.' and saves, whatever is missing; the missing-figures line exists only in the hero (:31-34). After the redraw the shell keeps the old scroll offset (core/app.js:205, keepScroll), which now points below the new result cards (:36-41).
- fix: In view.js: mark deathBenefit, wholePremium, termPremium and cashValue required; in the handler, when the saved figures would not be ready, set pending to an amber line listing d.missing and draw it beside the button; when ready, set a module-level flag and, on the next render, call scrollIntoView({ block: 'start' }) on the 'After N years' card (the shell lets a page that scrolls itself during the redraw win).
- evidence: $SP/ux/p-insurance-estate/verify/v3-tvp-first.png ; $SP/ux/p-insurance-estate/verify/v3-tvp-saved-no-answer.png ; $SP/ux/p-insurance-estate/verify/v3-tvp-after-compare.png ; $SP/ux/p-insurance-estate/verify/v3.mjs

## p-insurance-estate/IE-7 (severity 3, next, scope several-pages, owner claude-b, confirmed)
**Health and Legacy show two filled buttons at once, and Health asks for the plan's figures before the question they depend on**

- pages: insurance/health, estate/legacy
- reach: 2 pages (Legacy added by me: 'Add' and 'Save' are 206 px apart)
- steps: Household family (or first open). Open insurance/health and scroll to about 880 px. Open estate/legacy and scroll to about 330 px.
- saw: Health: 'Add plan' (filled, y 1181) and 'Save' (filled, y 1571) are on the screen together; the Deductible help reads 'for the coverage you choose below', and that choice ('Coverage for: Just me / Me and family') is in the second card with the second button. Legacy: 'Add' and 'Save' (for one checkbox about the home) are both filled on one screen. The walker's other claim does not hold: the page does not end with only two links; it ends with 'Continue your plan: step 2 of 8' like the rest.
- should: One filled button per screen. On Health, 'Coverage for' and 'Medical bills in a usual year' come first while there are no plans; their Save is outlined once a plan exists. On Legacy the home checkbox saves when it is ticked, with a green line, and has no button.
- why: Which button finishes this? The person either presses Save expecting it to add the plan (and loses the typing, x-1) or adds a plan with the wrong deductible because the coverage question came after.
- cause: insurance/health/view.js:72-107 draws the add form first and the settings fold second, open while d.count is 0, each through ui.form, whose submit button is always filled (core/ui/dom.js:128 has no class option). estate/legacy/view.js:88-92 does the same for the one-checkbox form.
- fix: Health view.js: when !d.count append the settings card before the add card; otherwise add class 'secondary' to its submit button. Legacy view.js: replace the one-field form with a checkbox that calls store.update on change and sets pending = 'Saved.'. (A small ui-kit option, form(..., { submitClass }), would make the outlined Save a one-liner for other pages.)
- evidence: $SP/ux/p-insurance-estate/verify/v7-health-two-filled.png ; $SP/ux/p-insurance-estate/verify/v7-legacy-two-filled.png ; $SP/ux/p-insurance-estate/verify/v7.mjs ; $SP/ux/p-insurance-estate/verify/v7b.mjs

## p-insurance-estate/x-3 (severity 3, understand (defaults), scope page, owner claude-b, confirmed)
**Gifting: the default 'From: Both of us (split)' makes a $500 gift ask for a gift tax return**

- pages: estate/gifting
- reach: 1 page, every couple
- steps: Household family. Open estate/gifting, type To whom 'Sam', Amount 500, change nothing else, tap Add gift.
- saw: The 'From' box was already set to 'Both of us (split, half each)'. After Add, a card 'Gift tax returns to file' appears: '2026: Form 709 by April 15, 2027 (to split gifts or spread a 529; no tax)', directly under the intro that says gifts up to $19,000 need 'no tax and no paperwork'.
- should: The default giver is one person (or 'Both of us' only counts as a split election when the amount is above one person's yearly limit); when a split is what triggers the return, the row says so and offers the way out: 'Only because it is entered as split between you. From one of you, no form is needed.'
- why: A couple entering birthday money is told to file an IRS form. They either worry, or stop trusting the page. The cause is a choice they never made. (This is about the default and the wording on screen, not the tax rule itself.)
- cause: estate/gifting/view.js:74: the new-gift defaults set from: d.couple ? 'both' : ...; compute then treats every 'both' gift as a split election that needs Form 709 (the 'Gift tax returns to file' card at view.js:55-57).
- fix: estate/gifting/view.js:74: default 'from' to the first giver; in compute/view, when a year's only reason for a return is a split of gifts that fit under one giver's limit, show the plain hint above instead of the return card. Money-rule details are for the tax reviewers.
- evidence: $SP/ux/p-insurance-estate/verify/m2-gifting-500-return.png ; $SP/ux/p-insurance-estate/verify/m2.mjs

## p-investments/x-1 (severity 3, touch-input, scope several-pages, owner claude-b pages, confirmed)
**The add form forgets which account or fund you were filling, so the second one silently lands on the first in the list**

- pages: investments/holdings, investments/tax-lots
- reach: every second and later add on Holdings and Tax lots; the import preview's account choice
- steps: held(): Holdings > '+ Add a holding' > choose Brokerage, VXUS, 10 shares > 'Add holding' > '+ Add a holding' again > type SCHD, 20 > 'Add holding' without touching the account. Tax lots > '+ Add a lot' > choose ACME, 40 shares, 2,000 > 'Add lot' > '+ Add a lot' again > 60 shares, 4,000 > 'Add lot'.
- saw: The second form shows 'Ana's 401(k)' again; SCHD is saved into Ana's 401(k). The confirmation says only 'SCHD added.' and the new row is 203 px above the screen, so the Brokerage card in view shows VXUS and no SCHD. Tax lots: the second form shows 'VTI · Brokerage' again; the 60-share lot goes to VTI, which now has 360 shares in lots against 300 held; the confirmation says 'Lot added.' The pasted-file import also preselects 'Ana's 401(k)' for a brokerage file.
- should: The form remembers the last account or fund chosen; the confirmation names the place ('SCHD added to Brokerage.'); the new row is brought into view.
- why: Typing a statement means several funds from one account in a row. One missed dropdown puts a fund in the wrong account or a purchase on the wrong fund, and nothing on screen says so.
- cause: modules/investments/holdings/view.js:53 (accountId: accounts[0]?.id) and :58 (the confirmation has no account), :89 (import: accountId = accounts[0].id); modules/investments/tax-lots/view.js:56 (holdingId: holdingsWithPrice[0]?.id), :52 (showForm is false again on every redraw), :57 ('Lot added.').
- fix: Keep a module-level lastAccountId / lastHoldingId beside `pending` and preselect it; name the place in the confirmation; scroll the new row into view after the redraw. The add form still folds away once there is data (design rule kept).
- evidence: $SP/ux/p-investments/verify/x3-holdings-second-add.png

## p-investments/INV-9 (severity 3, back, scope several-pages, owner claude-b pages, confirmed)
**A typing mistake in a coin or a grant cannot be fixed on its own page**

- pages: investments/crypto, investments/employer-stock
- reach: every coin and every grant
- steps: Blank plan: Crypto > 0.5 coins at 60,000 > 'Add coin'. Look for a way to change it to 0.05; tap the coin's row; then add it again with 0.05. held(): Employer stock > look for the grant; tap its row under 'What you hold'.
- saw: Crypto: the page's only controls are the price box, 'Update price', '+ Add another coin' and three links. Tapping the row does nothing. No words about changing or removing. Adding again leaves two rows, BTC 0.5 and BTC 0.05, both counted ($33,000). The rows can be edited and removed on Holdings (under 'Crypto wallet'), but the page never says so. Employer stock: the grant's row is not tappable; the list of grants sits only inside the fold named '+ Add another grant' (1 grant) at 2,213 px of a 2,514 px page, and offers only 'Remove'; the blank form under it reads like that grant's editor.
- should: Tapping a coin or grant row opens it for editing with Remove inside, as Holdings rows do; or at least one line under the list: 'To change or remove a coin, open it on Holdings' with a button. The grants fold is named 'Your grants' with '+ Add another grant' inside it.
- why: I typed 0.5 instead of 0.05 and cannot take it back; my fix made a second coin. To correct a grant I must find it under a heading that says 'add', delete it and retype eight boxes.
- cause: modules/investments/crypto/view.js:60-72 (a row has only the price box) and :118 (a bare 'Holdings' link); modules/investments/employer-stock/view.js:146-150 (rows with Remove only, inside a fold titled '+ Add another grant').
- fix: Crypto: make each row a link to Holdings with 'Edit ›' and add the sentence above. Employer stock: retitle the fold, and let a row fill the existing form for 'Save changes'. Page-level changes; no logged decision involved.
- evidence: $SP/ux/p-investments/verify/inv9-crypto-two-btc.png, $SP/ux/p-investments/verify/inv9-es-grants-fold.png

## p-investments/x-3 (severity 3, next, scope page, owner claude-b pages, confirmed)
**Tax lots tells you to type your lots, and the only way to do it is 3.6 screens down**

- pages: investments/tax-lots
- reach: every household with a taxable holding
- steps: held(): Investments > Tax lots. Read the first screen; look for where to type a lot.
- saw: The first screen is all text with nothing to tap. The blue note says 'Type the lots (date, shares, cost) from the brokerage's cost-basis page for the real picture.' with no link. The first controls on the page are four 'Remove lot' buttons from 1,808 px; the outlined '+ Add a lot' is at 3,007 px of 3,189. After 'Add lot' the form closes and the new lot is 840 px above the screen.
- should: Each fund's card ends with '+ Add a lot' for that fund; the note carries a button that goes to the first fund without lots.
- why: The page asks for something and gives no way to do it within reach; the first buttons met on the way down delete things.
- cause: modules/investments/tax-lots/view.js:69-70 (the form card is appended after every holding's card), :52-55 (one global add button), :27 (notes are plain text).
- fix: Draw the add button and form at the foot of each holding card with that holding preselected (this also fixes the lot half of x-1). Page-level.
- evidence: $SP/ux/p-investments/verify/inv8-tax-lots.png

## p-investments/INV-8 (severity 3, focus, scope several-pages, owner claude-b pages, confirmed)
**Specialist words on the first screen of seven investment pages**

- pages: investments/performance, investments/tax-lots, investments/rebalance, investments/glide-path, investments/employer-stock, investments/asset-location, investments/fees
- reach: 7 of the 14 investment pages
- steps: held() with three saved balances on the brokerage account: open Performance. held(): open Tax lots, Rebalance, Glide path, Employer stock, Asset location, Fees and read the first screen.
- saw: Performance: 'Time-weighted: deposits between two points are treated as arriving mid-period (Modified Dietz) and the periods chain-linked. Money-weighted: ... (the IRR, with real dates)'; a note 'fewer than two balance points, left out' with nothing to do about it; two tiles both reading +24.9%. Tax lots: '$7,900 of losses could be harvested', 'wash-sale rule'. Rebalance: '3 classes are past the 5-point band'. Glide path: the title itself, '110 minus age', 'target-date'. Employer stock: 'RSU', 'to vest', 'net unrealized appreciation (NUA)'. Asset location: 'Yearly tax drag = income x the rate ... non-qualified dividends (your marginal rate)'. Fees: 'expense ratio'.
- should: The top card says the one thing in plain words; method names move to a folded 'How this is worked out' at the end or to the README (AGENTS.md rule 14). Performance's note becomes 'Three accounts are left out: they have only one saved balance. Save today's totals on Net worth now and again next month.' with a button.
- why: The eye lands on method names instead of the answer; a layperson cannot tell what to do next.
- cause: On-screen copy: modules/investments/performance/view.js:20 and the compute note at :22; tax-lots/view.js:18-22 and :37; rebalance/view.js:34 and :44; glide-path, employer-stock and asset-location/view.js hero paragraphs.
- fix: A wording pass on these seven heroes. The plain-words pass is already on the builder's list (design log 2026-11-06, 'Not yet done'), so this is not an owner choice to keep the words.
- evidence: $SP/ux/p-investments/verify/inv8-performance-history.png, $SP/ux/p-investments/verify/inv8-tax-lots.png

## j-heavy-waiting/W8 (severity 2, understand, scope page, owner claude-b, confirmed)
**Backtest names your mix by a page title: 'The mix on Will the money last?'**

- pages: investments/backtest
- reach: Backtest only: the first chip of 'First mix' and of 'Compared with' (228 px wide) and the first sentence under the headline. The walker's 'seven blue chips filled at once' is a tooling false alarm: the kit counts every chip as filled; on screen only the chosen ones are blue.
- steps: H.family(), phone, Backtest.
- saw: 'The mix on Will the money last? (70% stocks, 30% bonds): 8.8% a year, the worst year -31% (1931)...': a question mark in the middle of a sentence, and a chip that reads like a link to another page.
- should: 'Your plan's mix (70% stocks, 30% bonds)' in the sentence and 'Your plan's mix' on the chip.
- why: A small stumble on the first sentence of the page; the person can still read the answer.
- cause: modules/investments/backtest/compute.js line 60 (label) and view.js line 27 (chip).
- fix: Change the two strings; nothing else.
- evidence: $SP/ux/j-heavy-waiting/verify/w8-backtest-top.png

## p-insurance-estate/IE-6 (severity 2, touch, scope page, owner claude-b, confirmed)
**Estate documents: the square looks like a tick box, but tapping it opens a form set to 'Not yet'**

- pages: estate/documents
- reach: 1 page. estate/beneficiaries uses the same square, but there the walker's claims do not reproduce: the two chip groups have clear headings ('MAIN BENEFICIARIES', 'BACKUPS, IF THE MAIN ONES HAVE DIED') and Save is fully on screen (y 660 of 844); the kit counted the outlined chips as 'filled' by mistake.
- steps: Household family. Open estate/documents, tap the empty square beside 'Will: Ana'.
- saw: Nothing is ticked. A form opens under the row: Status (set to 'Not yet'), a date, 'Where the original is kept', Notes, Save, Cancel (the page grows 447 px). Marking a will signed takes four taps: row, Status, 'Signed', Save. The intro does say 'Tap each one below to mark it signed and note where the original is kept', so this is a small stumble, not a trap.
- should: Tapping the square marks the paper signed in one tap (today's date) with a green line 'Will: Ana marked signed. Add where it is kept', and tapping it again undoes it; tapping the words opens the details as now.
- why: It looks like a checklist. The first tap on a square does not tick it, and the form that opens still says 'Not yet'.
- cause: estate/documents/view.js:47-50: the whole row is one button whose first child is the glyph '⬜' in .ed-ic; the editor's Status select starts from x.status ('none').
- fix: view.js: make .ed-ic its own 44 px button (aria-pressed) that calls store.update to set status 'done' and updatedAt today (or back to 'none'), with pending = '... marked signed.'; the rest of the row keeps opening the editor.
- evidence: $SP/ux/p-insurance-estate/verify/v5-docs-editor-open.png ; $SP/ux/p-insurance-estate/verify/v6-ben-editor.png ; $SP/ux/p-insurance-estate/verify/v5.mjs ; $SP/ux/p-insurance-estate/verify/v6.mjs

## p-investments/INV-6 (severity 2, focus, scope page, owner claude-b pages, confirmed)
**Allocation: 'Type my own' opens the boxes but puts the cursor in none (the Rebalance and Crypto parts are not problems)**

- pages: investments/allocation
- reach: one button
- steps: held() with no target chosen: Allocation > 'Type my own'.
- saw: The page moves 1,160 px to 'Your target mix'; focus stays on the 'Type my own' button, now 695 px above the screen; the first box (US stocks, y 306) is not focused, so no keyboard. Not confirmed as problems: Rebalance, Enter in 'New money to invest' saves, 'Saved.' is in view and 'Buy Bonds $5,000' appears directly under the button (the keyboard closing after Enter is expected); Crypto, after the first coin the new row 'BTC · Bitcoin $30,000' and 'BTC added.' are both on screen.
- should: After opening, the cursor is in 'US stocks'.
- why: One extra tap to start typing; passable.
- cause: modules/investments/allocation/view.js:51: the handler opens the fold and scrolls, nothing more.
- fix: Add f.querySelector("input")?.focus({ preventScroll: true }) after f.open = true. Check on a real iPhone that the keyboard comes up.
- evidence: $SP/ux/p-investments/verify/inv6a-after-type-my-own.png, $SP/ux/p-investments/verify/inv6b-full-after.png, $SP/ux/p-investments/verify/inv6c-crypto-after-add.png

