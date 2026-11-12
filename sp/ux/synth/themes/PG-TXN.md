# PG-TXN: Transactions and helper pages (page-specific)

12 verified findings (each reproduced on screen by an independent skeptic). Scripts and pictures for a finding `<walker>/<id>` are in `$SP/ux/<walker>/` and `$SP/ux/<walker>/verify/`.

## p-transactions-helpers/T3 (severity 5, input, scope page, owner claude-b, confirmed)
**A purchase typed by hand is saved as money in, and an iPhone's number pad has no minus key to say otherwise**

- pages: transactions/ledger
- reach: Ledger add and edit forms. Voice notes already does this right ('Money spent, -$42').
- steps: H.family(), import qa/fixtures/chase-checking.csv on transactions/import, open transactions/ledger, tap 'Add a transaction by hand', Who or what = 'Test shop', Amount = '4.50', tap 'Add transaction'. Repeat with '1.2k' and '$1,200.50'.
- saw: The row is saved as '+$4.50' in green and the 'Money in' tile goes from $3,900 to $3,905 ('1.2k' saved as +$1,200.00, '$1,200.50' as +$1,200.50). Only '-45.20' is saved as money out. The one hint is grey 13 px text under the box: 'money in is positive, money out is negative (-45.20)'. The box is inputmode=decimal (census). 'abc' and '5%' are refused well ('Type an amount in numbers, like 4,500.', form kept).
- should: Ask the direction, never the sign: a two-way choice above the amount, 'Money out (I paid)' / 'Money in (I received)', starting on Money out, and a plain unsigned Amount box ('just the amount, like 45.20'). A typed minus still means money out. The saved row and the confirmation say it in words: 'Added Test shop: $4.50 out.'
- why: Reproduced three times. The person types what they spent and the app counts it as income; nothing asks which way the money went. Worse on the owner's phone: inputmode=decimal brings up the iPhone number pad, which has digits and a point but no minus key, so money out cannot be typed at all. The app's own code says so (modules/transactions/reconcile/view.js:67 'a phone's decimal keypad has no minus key', and overview/setup/view.js:459 switches a signed box to the letter keyboard). The keypad itself cannot be shown in this headless browser: on the phone, open Ledger > Add a transaction by hand, tap Amount and look for a minus key. Severity is 4 on what I measured here and 5 if the keypad is as the code says.
- cause: modules/transactions/ledger/view.js:15 (one signed 'money' field whose only guidance is the help text) and :90 (amount stored as typed); core/ui/dom.js:52 moneyBox sets inputmode=decimal on every money box.
- fix: In ledger/view.js FIELDS add a select { key: 'dir', options: out / in } before 'amount' (default 'out' for a new line, from the sign when editing), show Math.abs(amount) in the box, and in the submit handler store amount = dir === 'out' ? -Math.abs(v.amount) : Math.abs(v.amount) (a typed minus forces 'out'). No kit change needed; the same choice would let transactions/reconcile get its number pad back (see T8).
- evidence: $SP/ux/p-transactions-helpers/verify/t3-form-filled.png

## j-keyboard-reader/x-ledger-search (severity 4, input, scope page, owner claude-b (transactions/ledger), confirmed)
**Transactions search drops the cursor a quarter of a second after each pause, so typing stops working mid-word**

- pages: transactions/ledger
- reach: one page; every phone and desktop user who searches their transactions
- steps: family household with six invented transactions added (three with 'Grocery' in the name), phone 390x844 touch. Open transactions/ledger, tap 'Showing', tap Search, type g r o, wait half a second, type c e r.
- saw: Reproduced twice (touch and keyboard). After g-r-o typed quickly the box holds 'gro' and has the focus. Half a second later the page has redrawn itself: the box still reads 'gro' but the focus is on nothing. The next three letters go nowhere; the box still reads 'gro'. On a phone the keyboard would close at that moment, and most people pause longer than a quarter of a second between letters. All pages, Glossary and Help search do not do this.
- should: The box keeps the cursor while the list under it updates, however slowly you type.
- why: You type a letter or two, the keyboard goes away, you tap the box again, type one more, and it goes away again. Finding a payee by name becomes a fight.
- cause: modules/transactions/ledger/view.js:57 (the Search box's onInput schedules redraw after 250 ms) and :131 (redraw = root.innerHTML = ""; render(root, ctx)), which destroys and rebuilds the box being typed in.
- fix: In that page only: keep the 'Showing' card and its Search box in place and redraw just the totals and the list below it (render them into their own container and clear only that). Putting the focus back by script after the redraw is not enough on an iPhone, where the keyboard would still close.
- evidence: verify/x2.mjs, verify/x-ledger-search-touch.png (box reads 'gro', no focus ring)

## p-career-household-system/F6 (severity 4, back, scope page, owner claude-b (system/settings), confirmed)
**Erase asks with a sentence about a PC copy that may not exist, then says nothing; Restore replaces the plan on one OK with no way back**

- pages: system/settings
- reach: system/settings, Your data card
- steps: H.family(), system/settings, scroll to Your data. Tap "Erase the copy on this device" and read the question; accept. Separately: "Restore from a copy" with a text file that is not a plan, then with another household's plan file.
- saw: Erase asks: "Erase the plan stored in this browser? The copy on the PC is untouched." (the same sentence in every case; in the sandbox and on a phone with no PC there is no other copy). After OK the page reloads to the top of Settings (was at 1083 px) showing "My plan", with no word that anything was erased and no way on. Restore asks only "Replace the current plan with my-plan.json?"; one OK turned the family's plan into Ruth's, green "Restored from my-plan.json.", no Undo. A wrong file shows "Could not restore: Unexpected token 'o', \"not a plan { \" is not valid JSON. Pick a file that was downloaded from this page."
- should: Erase, when no PC holds the plan: "Erase your plan from this phone? This is the only copy. It cannot be undone. Download a copy first if you may want it back." After erasing: land on Get started with "Your plan was erased from this device." Restore says what is replaced ("...Your plan as it is now (3 people, 10 accounts) will be replaced") and offers Undo on its green notice, as People's Remove does. Wrong file: "That file is not a copy made by this app. Pick a file you downloaded from this page."
- why: Reproduced. One part of the walker's finding is refuted: the Erase button is not styled like the main button; it is outlined red, 246x44 (f6-data.png). The button names are the owner's (design log 2026-09-15, Settings round 6, finding 3) and stay. The PC sentence also breaks the design log rule of 2026-11-06 (no PC wording in the household's view).
- cause: modules/system/settings/view.js:79 has two confirm strings and both end "The copy on the PC is untouched.", then store.eraseDevice(); location.reload() with nothing kept to say so. :87 confirm names only the file; :88 prints e.message from JSON.parse.
- fix: view.js:79: choose the sentence by store.backend() === "server" (PC wording only then); before reload set sessionStorage "planner.erased" and location.hash = "#/overview/start"; the start page (or core/app.js boot) shows the notice once. :87: add the counts line already computed for the card (`counts`) to the confirm and keep `undo: structuredClone(plan)` for an Undo button on the notice. :88: catch SyntaxError and say the plain sentence.
- evidence: $SP/ux/p-career-household-system/verify/f6-data.png, $SP/ux/p-career-household-system/verify/f6-badfile.png, $SP/ux/p-career-household-system/verify/f6-erased.png (v6.mjs: dialog texts logged)

## p-cashflow-b-goals/F1 (severity 4, back, scope page, owner claude-b (transactions/ledger); optional helper is shell, confirmed)
**Back from a row that opens the Ledger never leaves the Ledger**

- pages: cashflow/spending, cashflow/income-statement, balance/accounts, transactions/reconcile, overview/monthly-review, transactions/ledger
- reach: every link into the Ledger that carries a month, an account or 'uncategorised'
- steps: Family household plus four months of bank lines (verify/tx.mjs). Open the Dashboard, then Where the money goes (cashflow/spending). Tap the Groceries row. The Ledger opens. Press Back four times. Same from Income statement (tap a month row) and from Account detail (tap 'All transactions for this account').
- saw: One tap added two history entries (history length 3 -> 5; two hashchange events, both ending on #/transactions/ledger). Back 1, 2, 3 and 4 each ended on #/transactions/ledger at scroll 0, title Ledger. Same on cashflow/income-statement and balance/accounts (left at scroll 1309, never returned). Reconcile and Monthly review carry the same links in code but showed none with this household.
- should: The Ledger replaces the deep-link address instead of adding a second one, so one Back returns to the page and scroll position the person came from.
- why: Back is the one control a person trusts to undo a tap. Here it redraws the same page each time, so the place they came from is lost (scroll 283 on Where the money goes, 592 on Income statement, 1309 on Account detail) and the only way out is the menu. Caveat a fixer should know: the kit presses Back with history.back(). Chrome and Safari may skip an address the page itself replaced when the real Back button or swipe is used, so on the owner's phone this may bite less often than in the test. Check once on the phone: tap a category row, press Back; still on Ledger means the trap is live. The fix is one line and right either way.
- cause: modules/transactions/ledger/view.js:39: the deep link (/month/.., /account/.., /uncategorised) is turned into the bare address with ctx.go(...), which is location.hash = ... (core/router.js:28) and always adds a history entry. Back lands on the deep link, which bounces forward again. It is the only page that redirects while drawing.
- fix: ledger/view.js:39: location.replace("#/transactions/ledger" + the same query) instead of ctx.go(...). A hash-only replace keeps ?sandbox=1, fires hashchange and leaves one entry. Optional: add router.replace / ctx.replace in core for the next page that needs it.
- evidence: $SP/ux/p-cashflow-b-goals/verify/f1-cashflow_spending-after-4-backs.png, $SP/ux/p-cashflow-b-goals/verify/f1-cashflow_income-statement-after-4-backs.png

## p-transactions-helpers/T1 (severity 4, next, scope page, owner claude-b, confirmed)
**After choosing a bank file nothing on the screen changes; the preview and the only filled button are two screens down, and the one button in reach throws the file away**

- pages: transactions/import
- reach: transactions/import, file and paste. Checked three other pages that show a result after a tap: ai/reader (result card on the first screen), ai/notes and transactions/reconcile (both scroll the result into view) are fine.
- steps: H.family(), transactions/import, 'Choose the file', pick qa/fixtures/chase-checking.csv. Then tap 'Use the pasted text' (the only button under the file name) with the paste box empty.
- saw: After the file is read: scrollY 0, no notice, no filled button on screen, focus on the page body; only 'chase-checking.csv (1 KB)' appears beside the button. The '3. Check and import' heading is at y=859 (15 px under the 844 px fold) and 'Import 10 transactions' at y=1846 of a 2,028 px page (y=1790 for a 150-line file), about 1,000 px below the first screen (the walker's '1,850 px further down' is the distance from the top of the page). Pasting a real file and tapping 'Use the pasted text' is the same (button at 1846, no scroll). Then: tapping 'Use the pasted text' with the box empty removes the preview (page shrinks 978 px, Import button gone, card 3 says 'Pick a file or paste text first.') while the label still reads 'chase-checking.csv (1 KB)'. The hidden file box still holds the file, so a browser fires no change when the same file is picked again.
- should: When a file has been read (or pasted text used) bring '3. Check and import' to the top of the screen under the top bar, with the Import button on that first screen: heading, 'Read 10 lines from chase-checking.csv', the three counts, then 'Import 10 transactions', then the sample rows. 'Use the pasted text' with an empty box says 'Paste the file's text in the box first.' at the box and leaves a chosen file alone.
- why: Reproduced three times (10-line and 150-line files, and pasted text). Import is the way transactions get in; the person sees a file name and no next step, and the nearest button undoes the step without saying so.
- cause: modules/transactions/import/view.js:33-39 (file read, then prepare(), no scroll or focus), :41 (pasteBtn sets text = '' whatever is in the box), :64-65 (prepare wipes the preview), :122-141 (the Import button is appended after the six sample rows).
- fix: In reader.onload and the paste handler, after prepare(): previewCard.scrollIntoView({ block: 'start' }) with scroll-margin-top: calc(var(--topbar) + 8px) scoped to the page; move ui.row(Import button) to just after the stat tiles (line 102-107), keeping the column fold as the owner chose (2026-09-16); in the paste handler return early with a notice by the box when paste.value.trim() is empty; set file.value = '' after reading so the same file can be chosen again.
- evidence: $SP/ux/p-transactions-helpers/verify/t1-after-file.png

## p-transactions-helpers/x-search (severity 4, focus, scope page, owner claude-b, confirmed)
**The Ledger's search box keeps one letter: a quarter second after any key the page redraws and the box loses focus**

- pages: transactions/ledger
- reach: transactions/ledger only (3 other search boxes checked and fine).
- steps: H.family(), import chase-checking.csv, transactions/ledger, tap 'Showing' to open the filters, tap Search, type k-r-o-g-e-r at a thumb's pace (300 ms a key or slower).
- saw: After 'k' the page redraws: focus goes to the page body and the box holds 'k'; 'r', 'o', 'g', 'e', 'r' go nowhere (measured at 300, 450 and 600 ms a key, three runs). The list shows the 3 rows that contain a 'k'. Typed at 150 ms a key the word arrives, then focus still drops. The glossary, All pages and Help search boxes keep focus and all letters in the same test.
- should: Typing never moves focus. Either filter when the person presses Search / leaves the box, or redraw only the totals and the list while the box itself stays untouched.
- why: On a phone the keyboard closes after the first letter, so the box has to be tapped again for every letter. Finding one shop in three months of lines is the reason this box exists. The walker did not open the 'Showing' fold.
- cause: modules/transactions/ledger/view.js:57 (onInput: setTimeout(redraw, 250)) and :131 (redraw = root.innerHTML = '' then render again, which builds a new search input).
- fix: One line: listen for 'change' (and the Enter / Search key) instead of 'input' on the search box, so the redraw happens once the word is typed; or keep the <details> filter node and rebuild only the totals card and the list. modules/ai/glossary/view.js shows the second way working.
- evidence: $SP/ux/p-transactions-helpers/verify/x-ledger-search.png

## p-career-household-system/x-4 (severity 3, back, scope several-pages, owner claude-b (modules/reports/report-kit.js), confirmed)
**"Print or save as PDF" opens a second tab with a desktop-width sheet and nothing to tap**

- pages: reports/plan-summary, reports/statements, reports/tax, reports/retirement, reports/annual-review
- reach: all five printable reports
- steps: H.family(), reports/plan-summary, tap the filled "Print or save as PDF".
- saw: A second tab opens (2 tabs): a 980 px wide document with no viewport setting, 13 px text, 0 links or buttons, titled "Financial plan summary: Ana and Bo"; the app stays behind in the first tab. Same on reports/statements. It is the only filled button on all five report pages.
- should: Print in the same tab (the browser's print sheet over the app), so closing it leaves the person on the report. If a separate sheet is kept, it needs a phone-width layout and a "Back to the app" button.
- why: Reproduced in this browser on two pages; the walker did not reach printing. On a real iPhone check: does the print sheet open at all (it is called from a timer in another tab), and after closing it is the person left in a tab with tiny text and no way back.
- cause: modules/reports/report-kit.js:62-70 printSheet(): window.open("", "_blank"), document.write of a sheet with no <meta name=viewport>, then w.print() after 250 ms.
- fix: In report-kit.js print in place: add the print rules under @media print to the report's own <style> (hide #topbar, #sidebar and everything in #content but .rp-sheet; .only-narrow off, .only-wide on) and call window.print() in the same tab; drop the new tab.
- evidence: $SP/ux/p-career-household-system/verify/x-print-plan-summary.png (v13.mjs, v14.mjs)

## p-transactions-helpers/T4 (severity 3, smooth, scope several-pages, owner claude-b, confirmed)
**Saves that say nothing: Ledger, Categories, Duplicates, Transfers, Import and one Rules button change the plan without a confirmation**

- pages: transactions/ledger, transactions/categories, transactions/duplicates, transactions/transfers, transactions/import, transactions/rules
- reach: Six pages above. Checked and fine: Rules add / save / remove, Categorize, Check a statement, Voice notes, Document reader.
- steps: H.family() with chase-checking.csv imported. Ledger: add a line (-6.25), edit a row's category and 'Save changes', 'Delete this transaction'. Categories: rename Pets to Dogs and save; add 'Coffee'; 'Hide Travel'. Rules: add a rule, then tap 'File 1 uncategorized transaction now'. Import: 'Import 10 transactions'; then Past imports > Undo. Transfers / Duplicates: import verify/checking2.csv into Chase checking and verify/savings2.csv into Ally savings, then 'Link', 'Unlink', 'Remove the copy'.
- saw: No green notice and no bottom echo in any of these (state().notices unchanged, .save-echo absent). Ledger after 'Save changes': the screen is the same as after Cancel and the changed row is off screen; after delete only the native 'Delete ...?' box was shown. Categories after rename: page sits at scrollY 1546, the renamed row is 1,090 px above, nothing says it saved; same for add and hide. Import lands on Categorize ('10 to file', '0 of 10 filed so far') with no 'Added 10 transactions' line; Undo of an import shows the native question and then nothing. Rules 'File 1 uncategorized transaction now': the button just disappears.
- should: A green line naming what happened, on the next draw: 'Added Corner cafe: $6.25 out.', 'Saved Netflix: now Subscriptions.', 'Deleted Chase Crd, 8/14/2026.', 'Pets is now Dogs.', 'Coffee added.', 'Travel hidden. Show it again under Hidden.', 'Added 10 transactions from chase-checking.csv. Now give them a category.', 'Removed the 10 transactions from chase-checking.csv.', 'Linked: $500.00 from Chase checking to Ally savings.', 'Filed 1 transaction under Car, gas, transit.'
- why: Reproduced on six pages. AGENTS.md: 'Every save, add or remove confirms itself'; design log 2026-09-15 rule 'every save/add/remove confirms with a green notice'. The pages that do it (Rules add, Categorize pick, Check a statement, Voice notes, Document reader) get the shell's bottom echo for free when the notice is off screen, so the fix is only the missing message.
- cause: No module-level pending in ledger/view.js (store.update at :92 and :102), categories/view.js (:37, :52, :56), duplicates/view.js (:27, :30), transfers/view.js (:16-21, :35), import/view.js (:130-140 then ctx.go, and :175), rules/view.js (:27-31).
- fix: Per page: let pending = null; set it before store.update; draw ui.notice('ok', pending) at the top of the list on the next render (the pattern in rules/view.js:14,46,65). core/app.js:256-264 already echoes a fresh notice at the bottom of the screen when it is out of view. Import to Categorize: pass the line along (e.g. export a say(text) from categorize/view.js, or a query value Categorize reads once).
- evidence: $SP/ux/p-transactions-helpers/verify/t4-after-edit-save.png

## p-transactions-helpers/T6 (severity 3, input, scope page, owner claude-b, confirmed)
**Import: text that is not a bank file is answered with eight column pickers and 'already on file'; an empty paste changes nothing on screen**

- pages: transactions/import
- reach: transactions/import.
- steps: H.family(), transactions/import. Tap 'Use the pasted text' with the box empty. Then type 'hello world' / 'not a csv' in the box and tap it again.
- saw: Empty: nothing on the screen changes (card 3, below the fold at y=859, already said 'Pick a file or paste text first.'). Garbage: the first screen does not change either; below it card 3 reads 'pasted text: 0 rows. Columns found: hello world.', opens 'Some columns could not be found: pick them' with eight dropdowns whose only choice is 'hello world', three tiles of 0, and at y=1938 'Everything in this file is already on file. Nothing to do.' (out of view).
- should: Empty: 'Paste the file's text in the box first.' right under the box. Not a bank file: one red line at the box, 'That does not look like a bank file: no dates or amounts were found. A bank file has one line per transaction. Download it again from your bank (Activity > Download > CSV), or paste the whole file with its first line.' No column pickers, no tiles. 'Already on file' only when lines were read and all matched.
- why: Reproduced twice (also with a plain sentence). 'Already on file' is false and reassuring; the column pickers ask a layperson to map columns of a file that has none.
- cause: modules/transactions/import/view.js:65 (empty text only rewrites the muted line in card 3), :85-100 (the fold opens whenever a date or amount column is missing, even with 0 rows), :159 (else-branch says 'already on file' whenever nothing is added and nothing was unreadable).
- fix: In prepare(): after prepareImport, if (!prep.parsed.rows.length || (missing && !prep.add.length && !prep.skip.length)) show the error notice and return before the fold and tiles; guard line 159 with prep.skip.length > 0. Scroll the message into view (same call as T1).
- evidence: $SP/ux/p-transactions-helpers/verify/t6-garbage-card.png

## p-transactions-helpers/T5 (severity 3, input, scope page, owner claude-b, confirmed)
**Rules: the category box starts on the first category, so a rule added without touching it files under 'Car, gas, transit'**

- pages: transactions/rules
- reach: transactions/rules only (Ledger's Category starts on 'Uncategorized', Categorize on 'Pick a category...').
- steps: H.family(), import chase-checking.csv, transactions/rules, type 'netflix' in 'When the bank description contains', tap 'Add rule', then tap 'File 1 uncategorized transaction now'.
- saw: The select holds 'Car, gas, transit' from the start (29 options, no 'pick one' entry). 'Rule added.' and the list shows '"netflix" -> Car, gas, transit, 1 match on file'; the new filled button files it and the Ledger shows 'Netflix, 8/30/2026, Car, gas, transit'. The empty-description case is handled by the browser's 'Please fill out this field.'
- should: The box starts on 'Pick a category...' and the form will not save until one is chosen ('Choose what to file it under'). The button says what it will do: 'File 1 transaction under Car, gas, transit'.
- why: Reproduced. A choice nobody made is saved and then applied by the next filled button.
- cause: modules/transactions/rules/view.js:8 (options with no empty entry) and :40 (default category = categoriesOf(plan)[0].id).
- fix: Line 8: options [{ value: '', label: 'Pick a category...' }, ...], required: true (ui.form passes required to the select); line 40: category: '' for a new rule.
- evidence: $SP/ux/p-transactions-helpers/verify/t5-rules-added.png

## p-career-household-system/F5 (severity 2, next, scope page, owner claude-b (career/equity, career/business), confirmed)
**On a first visit the only filled button is Save, and Save with nothing typed says "Saved."**

- pages: career/equity, career/business
- reach: two pages, first visit only
- steps: H.empty(), career/equity: the one filled button on screen is Save under The company. Tap it without typing. Same on career/business (The business, Save).
- saw: Equity: green "Saved." in view; stored { symbol: "", price: null }; the section still reads "not set yet". Business: "Saved." (off screen, echoed at the bottom).
- should: With nothing typed: "Type the stock symbol or today's share price first." at the button, no green notice.
- why: Reproduced. Narrowed and lowered: nothing is lost and few people tap Save on an empty form; on career/benefits and career/offer-compare the folds hold values, so "Saved." there is true.
- cause: modules/career/equity/view.js:139-142 saves whatever the form holds and always sets "Saved."; career/business the same pattern.
- fix: equity/view.js:139: if (!String(v.symbol).trim() && v.price === null) return formError(form, "Type the stock symbol or today's share price first."); the same guard in career/business.
- evidence: $SP/ux/p-career-household-system/verify/f5-empty.png, $SP/ux/p-career-household-system/verify/f5-saved.png (v4.mjs)

## p-transactions-helpers/T8 (severity 2, input, scope page, owner claude-b, confirmed)
**Check a statement: the two balance boxes open the letter keyboard, on purpose, so a minus can be typed (the rest of the finding is refuted)**

- pages: transactions/reconcile
- reach: transactions/reconcile.
- steps: H.family(), import chase-checking.csv, transactions/reconcile; tap 'Starting balance'; type '$1,807.23' and '4200.83' with dates 8/12 to 9/2 and press Enter.
- saw: Both boxes are type=text with no inputmode (census flags them). Enter already runs Check; the result ('Your transactions match the statement', heading at y=270) and 'Save as checked' scroll into view; '$1,807.23' is accepted, 'abc' is refused with 'Type an amount in numbers, like 4,500.' and kept. The kit's keyboard test only shrinks the screen and does not scroll the box into view as a phone does, so 'the Check button is off screen with the keyboard up' cannot be judged here (on the phone: tap Ending balance and see whether Check or the keyboard's Go is reachable).
- should: Number pad for the balances, and the rare case asked in words: a small tick box under each, 'This balance was below zero (overdrawn)'.
- why: The missing number pad is real but deliberate: modules/transactions/reconcile/view.js:67-68 removes it because a phone's number pad has no minus key and an overdrawn balance needs one. The walker's fix (inputmode=decimal) would bring that problem back. It is a small slowdown for everyone to serve a rare case.
- cause: modules/transactions/reconcile/view.js:67-68 (removeAttribute('inputmode') on startBalance and endBalance).
- fix: Keep inputmode=decimal (delete lines 67-68) and add one checkbox field per balance that negates the value in the submit handler at :62-63; the help text at :59 drops 'a minus if the account was overdrawn'. Same idea as the direction choice in T3.
- evidence: $SP/ux/p-transactions-helpers/verify/t8-rec-after-check.png

