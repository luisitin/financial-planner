# UI-ERR: A rejected Save or Add: the reason is off screen or is the browser's own bubble; wrong or impossible values are saved without a word; buttons that do nothing

21 verified findings (each reproduced on screen by an independent skeptic). Scripts and pictures for a finding `<walker>/<id>` are in `$SP/ux/<walker>/` and `$SP/ux/<walker>/verify/`.

## j-fat-fingers/FF1 (severity 4, input, scope ui-kit, owner shell, confirmed)
**A rejected Save or Add says why out of sight: the red message goes to the top of the page or form while the button is at the bottom, so the button looks dead**

- pages: property/home, property/rental, property/vehicles, debt/mortgage, investments/crypto, investments/employer-stock, taxes/documents
- reach: Seen on screen on Home, Rental analysis and Vehicles; the same code line (notice prepended, no scroll) is in Mortgage, Crypto, Employer stock and Tax documents. Not on Contributions (short form, message in view), Equity compensation or Budget 50/30/20 (they scroll to the message).
- steps: H.family(). Home (property/home): in 'The home's details' type 1900 in 'Year you bought it', scroll down until Save is on screen, tap Save. Rental analysis: type only a Name, scroll to 'Add rental', tap it. Vehicles: type only 'Which car', tap 'Add car'.
- saw: Home: nothing on the screen changes (v1-b-after-save.png). The red 'Type the year as four digits from 1950 on, like 2019, or leave it blank.' is at page y=78, 1,684 px above the screen; the year box is 138 px above the screen; focus stays on Save; the message deletes itself after 6 s; a second tap adds a second copy. Rental: message 1,308 px above the screen (v1c-property-rental.png). Vehicles: 234 px above. Both stack a second copy on a second tap. Correction to the walker: the page does not 'jump +765 px'; that was Playwright scrolling Save into view. With a real touch scrollY moves by 87, the height of the inserted notice, and the picture stays still. The rest of the form is kept.
- should: The red message appears directly above the button that was tapped and stays until the next try, one at a time; the box at fault is brought below the top bar and focused.
- why: The person taps Save, sees nothing, taps again, and has no way to learn what is wrong; on Home the message is gone before they could scroll up to it. A blank value on Vehicles or a blank rent on Rental is an everyday slip, likelier than the walker's 1900.
- cause: Page code puts the notice with root.prepend / form.prepend and returns: modules/property/home/view.js:124 and :127 (with setTimeout remove 6000), modules/debt/mortgage/view.js:76, modules/property/rental/view.js:167, modules/property/vehicles/view.js:99, modules/investments/crypto/view.js:133-134, modules/investments/employer-stock/view.js:124 and :142, modules/taxes/documents/view.js:72. The shell's bottom echo for off-screen notices (core/app.js:261-264) runs only after a store.update redraw, so a rejection never gets it.
- fix: One change in the UI kit: in core/ui/dom.js form() (line 95), note the .notice.error nodes under #content before calling onSubmit; afterwards move the first new one to just above .form-actions with role=alert and remove any older one there. Then drop the three 6-second timers (home :124, :127, mortgage :76). Optional: a handler may return { field: key } to focus that box.
- evidence: $SP/ux/j-fat-fingers/verify/v1-a-typed.png ; v1-b-after-save.png ; v1c-property-rental.png ; v1c-property-vehicles.png (scripts v1.mjs, v1c.mjs)

## p-debt-property/DP-2 (severity 4, input, scope ui-kit, owner claude-b pages (property/vehicles, property/rental, property/home); shell for the helper in core/ui/dom.js, confirmed)
**Tapping Add or Save with a needed box empty or wrong shows the error 300 to 1,800 px above the button; on screen nothing changes**

- pages: property/vehicles, property/rental, property/home
- reach: Long forms that put their error at the top. Widened to property/home (wrong year). The same code is on investments/crypto, investments/employer-stock and taxes/documents, but those forms are short and the error shows in view (checked on screen), so they are left out.
- steps: H.empty(), open property/rental, scroll to the foot of the open form, tap 'Add rental' with nothing typed. Same on property/vehicles with 'Add car'. H.family(), property/home: type 19 in 'Year you bought it', scroll down, tap Save.
- saw: Rental: the red 'Type what it is worth and the monthly rent first.' is placed about 1,200 px above the screen (inView false). No box is marked or focused, nothing scrolls; the screenshot shows the same form and button. A second tap stacks a second identical notice (two on the page). Vehicles: 'Type what the car is worth today.' about 310 px above the screen, also stacking. Your home: 'Type the year as four digits from 1950 on...' goes to the top of the page about 1,780 px above the Save button and is removed after 6 seconds, before anyone could scroll to it. Reproduced twice each.
- should: The message appears at the box that needs it, the screen scrolls to that box and puts the cursor in it; one message, not a stack.
- why: The button looks dead. The person taps again, then gives up, without learning which box was the problem.
- cause: modules/property/vehicles/view.js:99 and rental/view.js:167 do `form.prepend(ui.notice('error', ...))`; home/view.js:124 and 127 do `root.prepend(n)` with a 6 s removal. None scrolls or focuses, and the boxes are not marked required, so the browser's own message at the box never fires. The shell's floating copy only runs after a store.update redraw (core/app.js:258), and a refused form makes none.
- fix: Add one helper to core/ui/dom.js, for example fieldError(form, name, text): it calls setCustomValidity(text) and reportValidity() on that box (the browser then scrolls to it, focuses it and shows the message there, the same bubble Rent vs buy and Refinance already show) and clears it on the next input. The three views call it instead of prepend. Vehicles' 'What it is worth today' can simply be `required: true` in its ui.form schema.
- evidence: $SP/ux/p-debt-property/verify/v2_rental_emptyadd.png, $SP/ux/p-debt-property/verify/v13_home_badyear.png

## p-debt-property/x-2 (severity 4, touch, scope several-pages, owner claude-b (property/renovation, property/purchase), confirmed)
**Compare does nothing at all when the cost or price box is empty**

- pages: property/renovation, property/purchase
- reach: The two what-if pages whose amount box starts empty. Rent vs buy starts filled in and is fine.
- steps: H.family() (or H.empty()), property/renovation: in 'The project' choose 'Bathroom remodel' from 'What you are doing', leave 'What it will cost' as it is (empty), tap Compare. property/purchase: type 'New sofa' in 'What it is', tap Compare.
- saw: Nothing: no message, no scroll, no mark on the box, no change above. The page still says 'Showing a $30,000 kitchen refresh' although Bathroom remodel is chosen, and the fold's own header shows '$30,000', which reads as if the cost were already set. Purchase still says 'Until then it shows a $3,000 example'. Two runs each, on both households.
- should: The cost box is marked, focused and says 'Type what it will cost.' (or the page uses the example cost for the chosen project and says so).
- why: A filled button that does not answer. The person chose a project and expects the example cost to be used, or at least to be told to type one.
- cause: modules/property/renovation/view.js:61 `if (!(v.cost > 0)) return;` and property/purchase/view.js:71 `if (!(v.price > 0)) return;` leave silently; the fields are not marked required.
- fix: Mark the two fields `required: true` in their ui.form schemas (renovation/view.js:58, purchase/view.js:63); the kit already passes it to the money box, so the browser scrolls to the box, focuses it and says what is missing. Keep the guard for a typed 0 but answer it with the DP-2 helper.
- evidence: $SP/ux/p-debt-property/verify/v11_family_renovation_emptycompare.png

## p-insurance-estate/IE-2 (severity 4, input, scope several-pages, owner claude-b, confirmed)
**Add saves a row with the amount left empty (as $0) and says 'added'; the page then draws conclusions from the $0**

- pages: estate/gifting, estate/inheritance, estate/legacy, insurance/health, insurance/term-vs-permanent
- reach: these 5 pages. Checked and NOT affected: cashflow/income and goals/goals (the amount is required: 'Please fill out this field'), insurance/policies (a blank benefit is saved but shown honestly as 'no death benefit entered').
- steps: Household family. estate/gifting: type 'Sam' in To whom, leave Amount empty, tap Add gift. estate/inheritance: tap Add with every box empty. estate/legacy: type 'Kids', tap Add. insurance/health: type Plan name 'Gold', tap Add plan; then add 'Odd' with premium 200, deductible 9000, out-of-pocket maximum 1000.
- saw: Gifting: 'Gift to Sam added.', row 'Sam: Money ... $0', and a new card 'Gift tax returns to file: 2026: Form 709 by April 15, 2027'. Inheritance: 'Added.', row 'An inheritance $0', and four result rows all saying the same figure. Legacy: 'Kids added.' with $0. Health: 'Gold added.' and the headline 'Gold: cheapest for your usual year, about $1,000 all in' for a plan with $0 premium and $0 deductible. 'Odd' (deductible 9,000 above a maximum of 1,000) is accepted without a word. A gift of 99999999999999 is accepted and shown as '$99,999,999,999,999 ... $49,999,999,981,000 over'. No box is flagged; :invalid is empty in every case.
- should: The figure that makes the row mean something is required: the box is marked and Add stops with a plain line at the box ('Type the amount of the gift.'). Health stops when the maximum is below the deductible ('The out-of-pocket maximum cannot be lower than the deductible: check the two figures.'). Amounts above a sane ceiling are refused the same way ('Use 1,000,000,000 or less.').
- why: One stray tap on Add (or the keyboard's return key, see x-2) and the plan holds a $0 gift that asks for a tax return, or a free health plan that 'wins' the comparison. The person is told it worked, so they do not look again.
- cause: The field lists leave the money boxes optional and the handlers turn blank into 0: estate/gifting/view.js:64 and :76 (amount: v.amount ?? 0), estate/inheritance/view.js:63 and :68, estate/legacy/view.js:67 and :70, insurance/health/view.js:24-29 and :78, insurance/term-vs-permanent/view.js:60-69. ui.form (core/ui/dom.js:104) already supports required, min and max on a money box; the pages do not use them.
- fix: In the five view.js field lists add required: true and min above 0 to the defining amount (gift, inheritance, bequest; health premium, deductible and maximum; the four comparison figures), and max: 1e9. Health's onSubmit returns false with ui.notice('error', ...) at the form when oopMax < deductible (ui.form keeps the typing when the handler returns false). Optional polish in core/ui/dom.js moneyBox: a plain message for an empty required box ('Type an amount.') instead of the browser's.
- evidence: $SP/ux/p-insurance-estate/verify/v2-gifting-empty-amount.png ; $SP/ux/p-insurance-estate/verify/v2-inheritance-empty.png ; $SP/ux/p-insurance-estate/verify/v2-health-gold-empty.png ; $SP/ux/p-insurance-estate/verify/v2-tvp-empty.png ; $SP/ux/p-insurance-estate/verify/v2.mjs ; $SP/ux/p-insurance-estate/verify/v2b.mjs ; $SP/ux/p-insurance-estate/verify/v2c.mjs

## p-investments/x-2 (severity 4, touch-input, scope several-pages, owner claude-b pages (crypto, employer-stock, property/vehicles, property/rental, cashflow/budget-percent, retirement/contributions); claude-a for taxes/documents; the shared helper is shell (core/ui/dom.js), confirmed)
**A missing answer is reported off screen, so 'Add grant' and 'Add coin' look dead**

- pages: investments/employer-stock, investments/crypto, property/vehicles, property/rental, cashflow/budget-percent, taxes/documents, retirement/contributions
- reach: 8 forms on 7 pages; seen on screen on employer-stock, crypto (keyboard up) and property/vehicles; the others by the same line of code
- steps: Family household plus invented holdings and one grant (verify/hh.mjs held()): Investments > Employer stock > open '+ Add another grant' > type 400 in 'Units or options granted', leave 'Vesting starts' empty > scroll to the button > tap 'Add grant'. Also blank plan: Crypto > type 0.5 coins with the keyboard up (508 px of screen), leave the price empty > tap 'Add coin'. Also family: Home, cars > Vehicles > '+ Add' > tap 'Add car' with nothing typed.
- saw: Employer stock: the red message 'Type how many units or options and when vesting starts.' is put at the top of the form, 198 px above the top of the screen (the form is about 800 px tall); on screen the only change is a 99 px jump. No box is marked, nothing is added (grants still 1). A second tap adds a second identical message above (tops at -297 and -198) and the screen jumps again. Crypto with the keyboard up: message at y -240, nothing visible. Vehicles 'Add car': message at y -234. The shell's bottom confirmation does not fire because nothing was saved.
- should: The message appears where the thumb is: directly above the form's buttons (or at the empty box), one at a time, and the empty box is focused and outlined: 'Type the date vesting starts.'
- why: The person taps the one filled button, the screen twitches and nothing else happens. They tap again, harder. Nothing says which box is missing, so they give up or think the app is broken.
- cause: form.prepend(ui.notice("error", ...)) at the top of a tall form, never removed, no scroll, no focus: modules/investments/employer-stock/view.js:124 and :142, modules/investments/crypto/view.js:133-134, modules/property/vehicles/view.js:99, modules/retirement/contributions/view.js:306 (removes the old one, still no scroll). The shell's echo (core/app.js:284) only follows a store.update redraw. modules/career/equity/view.js:39 already does it properly (removes the old message, scrolls the form into view).
- fix: Add ui.formError(form, text, fieldKey) to core/ui/dom.js: remove any earlier message, insert the notice just above .form-actions, focus and mark the named box. Replace the 8 form.prepend calls with it. One helper, 8 one-line call sites; no design-log decision is touched (errors stay red and say what to do next).
- evidence: $SP/ux/p-investments/verify/x6-es-grant-no-date-held.png, $SP/ux/p-investments/verify/x6-crypto-no-price-kb.png

## j-debt-fixer/D2 (severity 3, input, scope page, owner claude-b, confirmed)
**Pay off debts: an amount the box cannot read is saved as $0 and the page says 'Plan saved.'**

- pages: debt/payoff, debt/credit-cards
- reach: Pay off debts (overwrites a saved amount); Credit cards 'Use these numbers'. Update my balances, Emergency fund and Our guesses check before saving (looked at the code only).
- steps: H.renterDebt(), debt/payoff (saved extra $50, 'Debt-free by July 2030'). In 'Extra each month' type 50.. (or abc, 5%, -50), tap Save plan.
- saw: abc, 50.. and 5%: nothing at the box, the headline stays July 2030 as if $50 were kept; Save plan writes extra 0, the box shows 0, headline 'Debt-free by January 2031', green 'Plan saved.' in view. -50: headline moves to January 2031 while typing, saved as 0. 99999999999 is saved as 99,999,999,999 ('Debt-free by December 2026'). An emptied box previews as $50 but saves as $0. 1.2k is read as 1,200 (good). The walker's 'headline already shifts while typing abc' did not happen: it shifts only for -50. On a phone the number pad cannot type letters; a doubled dot (50..), a pasted figure and Android's minus key are the real ways in, hence 3 and not 4. Credit cards has the same habit: an empty 'Promotional 0% months' is saved as 15 with 'Using these numbers.'
- should: An unreadable or negative amount is not saved: the box keeps what was typed, a red line right under it says 'Type an amount in numbers, like 150.' (the kit's own message), and the saved $50 stays. The preview treats an empty box as $0, as the save does.
- why: The $50 a month the person had saved becomes $0 behind a green 'Plan saved.'; only the changed date gives it away.
- cause: modules/debt/payoff/view.js:88: Save plan is a type=button outside any <form>, so the money box's own check (core/ui/dom.js:50-58, setCustomValidity) is never asked; the handler stores Math.max(0, ui.moneyValue(extraIn) ?? 0). Line 80 previews an unreadable or empty box as the saved extra. modules/debt/credit-cards/view.js:143: Number(monthsIn.value) || 15.
- fix: payoff/view.js: put the two fields and the button in ui.h('form', { onSubmit }) with a submit button so the browser holds the form with the kit's message, or in the handler: if (!extraIn.checkValidity()) { extraIn.reportValidity(); return; }; add max to the money box; line 80: typed === null && extraIn.value.trim() === '' ? 0. Same check in credit-cards/view.js:143.
- evidence: $SP/ux/j-debt-fixer/verify/v5-payoff-dots-saved.png, $SP/ux/j-debt-fixer/verify/v5-payoff-abc-saved.png

## j-fat-fingers/FF5 (severity 3, input, scope ui-kit, owner shell, confirmed)
**A rejected box gets only the browser's own bubble ('Please fill out this field.', 'Value must be less than or equal to 100.'), its label slides under the top bar, and nothing stays on the page**

- pages: goals/goals, cashflow/expenses, balance/liabilities, cashflow/income, household/people, cashflow/budget, balance/accounts
- reach: every form built with ui.form (required boxes, number and percent boxes, money boxes)
- steps: H.family(). Goals: '+ Add another goal', type nothing, scroll to 'Add goal', tap it. Debts: tap the Visa card row, type 500 in 'Interest rate per year', scroll to Save, tap it.
- saw: Goals: the page scrolls the empty box to y=68; its label 'What are you saving for' is at y=43, behind the 56 px top bar (measured labelHidden on Goals, Expenses and Debts). The only message is the browser bubble 'Please fill out this field.'; on Debts 'Value must be less than or equal to 100.', covering the help line 'on the statement; type 22.9 for 22.9%' (v5-6-balance-liabilities.png). No error element exists in the page afterwards. Money boxes do better: 'Type an amount in numbers, like 4,500.' and 'Use 0 or more.' are the app's own words.
- should: The box lands below the top bar with its label showing, and a red line under the box stays until it is fixed: 'Fill this in first.', 'Type 100 or less.', 'Type a number, like 3.5.'
- why: The words are the browser's, not plain ones, the name of the box is hidden exactly when it matters, and once the bubble goes nothing says what was wrong. What the bubble looks like and how long it stays on an iPhone could not be seen here: check on the phone (Safari shows a small bubble for a few seconds).
- cause: core/ui/base.css:28 sets scroll-padding-top to the top bar + 12 px, enough for the box but not for the label 25 px above it; core/ui/dom.js form() (lines 92-129) leaves required/min/max to the browser's default messages and has no place for a message under the box.
- fix: UI kit, two small changes: (1) base.css: '.field input, .field select, .field textarea { scroll-margin-top: 40px; }' so the label stays in view; (2) dom.js form(): on the form's 'invalid' event (capture) write plain words into a <small class='help field-error' role='alert'> under that box (valueMissing, rangeOverflow, rangeUnderflow, badInput) and set the same words with setCustomValidity; clear on the next input.
- evidence: $SP/ux/j-fat-fingers/verify/v5-6-balance-liabilities.png ; v5-1-goals-goals.png ; v5-5-cashflow-expenses.png (script v5.mjs)

## j-heavy-waiting/W6 (severity 3, input, scope several-pages, owner claude-b, confirmed)
**A plain amount is refused with a browser sentence: 'The two nearest valid values are 1000 and 2000'**

- pages: scenarios/goal-seek, property/vehicles
- reach: Goal seek 'Or leave at least' (step 1000): 1250 and 500 are refused. Also Vehicles, 'Add a car', 'Miles a year' (step 500): 11200 is refused with '...nearest valid values are 11000 and 11500', which the walker did not check. Boxes with a coarse step that are NOT affected, because they are not inside a form: Capital gains 'Gain', Tax brackets 'Or an amount', Mortgage 'Extra each month' and 'One lump sum' (the page takes 1250), Social Security monthly benefit (2347 saved, green notice). '1.2k' and 'abc' cannot be typed on a phone's number pad, so that part is not a problem.
- steps: H.family(), phone, Goal seek: tap the box, type 1250, tap 'Use this' (node v6-goalbox.mjs). Vehicles: Add a car, Miles a year 11200, Enter (node v6d-two.mjs).
- saw: The browser's own bubble over the box: 'Please enter a valid value. The two nearest valid values are 1000 and 2000.' Nothing else changes. A valid 750000 is taken, but nothing on screen says so: no chip is lit (all four unlit), the only words that changed ('more than the $750,000 you want to leave') are in the headline card above the screen (its top at -51 px), focus drops to the page.
- should: Take any whole amount (round it if the maths needs to and say so: 'Using $1,000'), and after 'Use this' show 'Now showing what it takes to leave $750,000' beside the box, with that amount lit like the chips.
- why: 'Valid values' is computer talk for 'we only take round thousands', and 11,200 miles is what the odometer says. After a good amount the person cannot tell it was used.
- cause: modules/scenarios/goal-seek/view.js: `ui.input({ type: 'number', inputmode: 'decimal', min: '0', step: '1000', ... })` inside `<form class='gs-goal'>`, so the browser validates the step on submit; no confirmation after load(). modules/property/vehicles/view.js: field 'Miles a year' with step '500' passed through core/ui/dom.js form() (line 107 `step: fd.step`).
- fix: Drop the step (or step='any') on both boxes and round in the handler; goal-seek: add `novalidate` to the form, and when `legacy` is not one of the four presets draw a fifth lit chip 'Leave $750,000' and a one-line ui.notice('ok', ...) under the box. A kit guard is possible (core/ui/dom.js form(): never pass a step above 1 to the input), which would cover every ui.form box at once; Goal seek builds its own form and needs its own line.
- evidence: $SP/ux/j-heavy-waiting/verify/w6-typed-1250.png ; $SP/ux/j-heavy-waiting/verify/w6-typed-750000.png ; $SP/ux/j-heavy-waiting/verify/w6c-vehicles-miles.png ; on an iPhone the bubble's words differ (Safari): check that 1250 is still refused there.

## p-career-household-system/F3 (severity 3, input, scope ui-kit, owner shell (core/ui/dom.js), confirmed)
**A wrong entry is not marked at the box; Save jumps to the first one with a browser bubble and names only that one**

- pages: career/offer-compare, household/people, career/equity, every page built with ui.form
- reach: every form with number, percent, money or required boxes
- steps: H.family(), career/offer-compare, open "Your job now: the figures". Paste abc in Salary a year, type 1.5 in Paid days off and 200 in Hours worked, leaving each box. Tap Save. Fix the salary, tap Save again.
- saw: After leaving each box: border unchanged, no aria-invalid, no notice. Save stores nothing, the screen jumps up 1165 px to Salary, the Save button is off screen, and a browser bubble "Type an amount in numbers, like 4,500." covers the help line and half of the next label; the other two bad boxes are not mentioned. Second Save jumps to Paid days off with the browser's "Please enter a valid value. The two nearest valid values are 1 and 2." People, retirement age 150: bubble "Value must be less than or equal to 100." and nothing else. Equity, Add the grant with empty boxes: jumps 964 px, bubble only.
- should: On leaving a box that cannot be used: a red sentence under it in the app's words. On Save with problems: stay put, one red notice at the button ("2 boxes need a fix: Paid days off, Hours worked") that taps to the first; nothing typed is lost.
- why: Reproduced; the bubble shows in my own picture. Narrowed: letters cannot be typed on the number pad (only pasted), so the everyday triggers are a decimal in a whole-number box, a value over the limit and an empty required box.
- cause: core/ui/dom.js:95 form() relies on the browser's own checking (no novalidate); :59 moneyBox only calls setCustomValidity; :107 number and percent boxes carry min, max and step with the browser's wording.
- fix: In core/ui/dom.js form(): f.noValidate = true; one check(control) per box (moneyBox's sentences; number: "Type a whole number, like 10.", "Use 100 or less."; required: "Type this first.") run on blur and on submit, shown in a <small class="help error"> under the box with aria-invalid; on submit with errors append one ui.notice("error", ...) in .form-actions and do not scroll. One change, every ui.form page.
- evidence: $SP/ux/p-career-household-system/verify/f3-typed.png, $SP/ux/p-career-household-system/verify/f3-saved.png, $SP/ux/p-career-household-system/verify/f3-saved2.png (v3.mjs, v4.mjs)

## p-debt-property/DP-4 (severity 3, input, scope several-pages, owner claude-b pages (debt/credit-cards, debt/payoff), confirmed)
**Boxes that have limits never check them: 600 months and a 150% fee are kept under a green 'Using these numbers.'**

- pages: debt/credit-cards, debt/payoff
- reach: Narrowed to the two pages whose button is not a form's submit. Not a problem: debt/mortgage (a negative shows as 0 in the box; a what-if that is never saved), huge amounts (no sensible cap; the box shows commas when you leave it), property/rent-vs-buy price 0 (nobody types it). debt/consolidation's offers form does check its limits.
- steps: H.demo(), debt/credit-cards, open 'Moving a balance to a 0% card', type 600 in 'Promotional 0% months' and 150 in 'Transfer fee, percent' (or 35 for a meant 3.5), tap 'Use these numbers'. H.family(), debt/payoff: paste abc into 'Extra each month', tap 'Save plan'.
- saw: Credit cards: the fold summary reads '600 months, 150% fee', the toast says 'Using these numbers.', and the card above flips to 'Moving to a 0% card does not pay'. The boxes carry min 1 / max 36 and min 0 / max 10 and their own messages ('Value must be less than or equal to 36.') but nothing shows them. Months 0 becomes 15 and a fee of -3 becomes 0 without a word. Pay off debts: the box already holds 'Type an amount in numbers, like 4,500.' as its message, yet Save plan stores $0 and shows a green 'Plan saved.'. On the phone's number pad letters and a minus cannot be typed, so the realistic slips are a missing decimal point or an extra digit, or a pasted figure.
- should: The box that is out of range says so at the box and nothing is saved until it is fixed; nothing is swapped for a default silently.
- why: A slip of one key changes every 0% figure on the page, even the advice, and the page says it used the numbers.
- cause: modules/debt/credit-cards/view.js:143 ('Use these numbers') and debt/payoff/view.js:88 ('Save plan') are plain buttons outside a form, so the validity the inputs already hold (min/max at lines 129-130; ui.moneyBox's check in core/ui/dom.js:53-59) is never reported. Line 143 also does `Number(monthsIn.value) || 15`.
- fix: First line of each handler: `if (!monthsIn.reportValidity() || !feeIn.reportValidity()) return;` and `if (!extraIn.reportValidity()) return;`. Drop the `|| 15` so an empty or zero months box is refused by its min of 1.
- evidence: $SP/ux/p-debt-property/verify/v6_cc_after_600.png, $SP/ux/p-debt-property/verify/v5_payoff_abc.png

## p-insurance-estate/IE-4 (severity 3, input, scope ui-kit, owner shell, confirmed)
**Number boxes refuse a value in the browser's own words, and the bubble covers the line that explains the box**

- pages: insurance/ltc, insurance/term-vs-permanent, estate/gifting, estate/inheritance, insurance/health
- reach: every ui.form number or percent box with a min or max: 53 view.js files. Worst on insurance/ltc 'Costs where you live'.
- steps: Household family. Open insurance/ltc, open 'The care to plan for', type 120000 in 'Costs where you live' (a year in a nursing home costs about that), tap Save. Then type 5 in 'From age' and tap Save.
- saw: Nothing is saved; a browser bubble says 'Value must be less than or equal to 400.' and sits on top of the help line '100% = the national middle price...', the only place that says the box wants a percentage. The box shows a bare '100' with no % sign under a label that invites a dollar figure. 'From age' 5 gives 'Value must be greater than or equal to 50.'; the help under it does not name the range. Narrowed from the walker's version: letters cannot be typed at all on a phone (the box brings up the number pad), and an empty 'From age' is a stated default ('85 if you leave it empty'), so 'abc is eaten and saved' is not a problem a phone user meets.
- should: The message is the app's own, at the box, in plain words: 'Use a number from 10 to 400.' / 'Use an age from 50 to 110.' Percent boxes carry a % sign. The care box is labelled for what it is: 'Prices where you live, compared with the country' with '100 = the same as the national price'.
- why: 'Value must be less than or equal to 400' of what? The person typed a real cost and is told a rule with no unit, while the explanation is hidden by the message.
- cause: core/ui/dom.js:105-107: number and percent fields are plain input type=number with min/max and no custom message, unlike moneyBox (core/ui/dom.js:53-60), which sets its own with setCustomValidity. insurance/ltc/view.js labels the percent box 'Costs where you live'.
- fix: One change in core/ui/dom.js form(): for 'number' and 'percent' fields attach the same kind of check moneyBox has (on input and on invalid: setCustomValidity('Use a number from MIN to MAX.' / 'Use MIN or more.' / 'Use MAX or less.')), and wrap percent boxes with a trailing '%' the way money boxes get a leading sign. Then rename the LTC label in insurance/ltc/view.js. On a real iPhone check that the message shows at the box and does not hide the help line.
- evidence: $SP/ux/p-insurance-estate/verify/v4-ltc-cost-range.png ; $SP/ux/p-insurance-estate/verify/v4.mjs

## p-investments/INV-3 (severity 3, touch-input, scope ui-kit, owner shell, confirmed)
**A wrong value gets the browser's own bubble: computer words, gone at the next touch, nothing left at the box**

- pages: investments/holdings, investments/employer-stock, investments/allocation, investments/fees, investments/crypto, investments/tax-lots, goals/goals, household/people, cashflow/income
- reach: every ui.form in the app: 54 pages have number or percent boxes; required text boxes are everywhere
- steps: held(): Holdings > '+ Add a holding' > Symbol VXUS, Shares 10, Expense ratio 50 > 'Add holding'. Then clear Symbol and tap again. Employer stock grant: -5 units > 'Add grant'. Same on Goals ('Growth per year' -999), People ('Retirement age' -999), Income ('Yearly raise' -999).
- saw: 'Value must be less than or equal to 5.' (the box holds 50 and no unit is named), 'Please fill out this field.', 'Value must be greater than or equal to 1.', 'Value must be greater than or equal to 18.'. After one more touch anywhere the bubble is gone and the page shows no error mark at all (0 error notices, no aria-invalid). Money boxes in the same form speak plainly ('Type an amount in numbers, like 4,500.') but in the same vanishing bubble.
- should: Plain red words under the box that stay until it is fixed: 'A fund's yearly fee is usually under 1. Type 5 or less.', 'Type the symbol, like VTI.', 'Type 1 or more.'
- why: A message in computer language that disappears before it is understood; the person no longer knows which box was wrong or what to type.
- cause: core/ui/dom.js form(), the number/percent case at lines 105-107: a bare <input type=number min max> with no message of its own, and required text boxes the same; only moneyBox (lines 51-63) sets words, and nothing writes a lasting message at the box.
- fix: In form(): one 'invalid' listener per control that writes a <small class="help error" role="alert"> under the box in plain words built from the field (required, min, max, percent), sets aria-invalid, and clears on input; fields may pass their own words. One change in the UI kit fixes every page. On a real iPhone also check what Safari's bubble says and how long it stays.
- evidence: $SP/ux/p-investments/verify/inv3-holdings-50.png, $SP/ux/p-investments/verify/inv3-holdings-50-after-tap.png

## p-retirement-c-scenarios/RC-1 (severity 3, input, scope page, owner claude-b, confirmed)
**Advisor's plan: Compare with nothing typed says "saved" and compares nothing**

- pages: scenarios/advisor-plan
- reach: Advisor's plan only. Checked three others: Compare > Make your own with only a name adds a card that says "Nothing changed yet." (fine); Income holds the form at Amount; Pensions is RC-2.
- steps: H.family() (or H.blank()), scenarios/advisor-plan, scroll to the bottom of the form, tap Compare with every box empty.
- saw: Bottom note "Advisor's plan saved."; no result, the form unchanged; the plan stores an advisor with no figures. On H.blank() the page says "To compare, your plan needs: a person with a birth date..." (no links) and still shows the 12-box form, which also says saved. The walker's "+1,669 px scroll" was its tool scrolling to the button: with a thumb tap the screen does not move.
- should: Nothing is saved. A plain line at the form: "Type at least one figure from their report, such as what they say you can spend a month, or their fee." On a plan missing the basics: the missing items as links and no form.
- why: "Saved" reads as "done"; the person looks for a comparison that does not exist.
- cause: modules/scenarios/advisor-plan/view.js:77-82: the submit handler sets "Advisor's plan saved." and writes the plan without checking that any figure was typed; compute.js:27 then reports entered = false and draw() (:41) shows no result. :40 appends the form even when the plan is not ready.
- fix: In that handler: if there are no changes, no fee and no quoted chance, show the line above and return false (ui.form then keeps the boxes). When !d.ready, link the missing items and leave the form out.
- evidence: $SP/ux/p-retirement-c-scenarios/verify/rc1-family-after.png, rc1-blank-top.png (script rc1.mjs)

## p-retirement-c-scenarios/RC-4 (severity 3, input, scope page, owner claude-b, confirmed)
**Goal seek "Or leave at least": only whole thousands are accepted, and the refusal is the browser's own sentence**

- pages: scenarios/goal-seek
- reach: Goal seek on screen. The same hand-built number box for money is in the code of taxes/capital-gains (view.js:45), taxes/brackets (:36), debt/mortgage (:92-93) and retirement/social-security (:61); those are not inside a form, so nothing blocks, and I did not test them on screen.
- steps: H.family(), scenarios/goal-seek, tap the box under "Or leave at least", type 1500 (or 1.5m, 750500, -100), tap Use this.
- saw: A bubble at the box: "Please enter a valid value. The two nearest valid values are 1000 and 2000." and nothing changes. 1.5m and $1.5M leave 1.5 in the box (letters and $ are dropped) and get the same bubble ("0 and 1000"); -100 gets "Value must be greater than or equal to 0." 1,500,000 is kept as 1500000 (no commas, no $) and works: "short of the $1,500,000 you want to leave". So it is not silent, as the walker wrote (its kit cannot see the bubble), but the words are not plain and real amounts are refused.
- should: The app's own money box: $ in front, 1,500,000 / 1.5m / $750,500 all read, commas put back on leaving the box, and "Type an amount in numbers, like 4,500." when it cannot be read.
- why: A person who wants to leave $750,500, or types 1.5m as every other money box allows, is told about "nearest valid values"; a seven-digit figure with no commas is easy to get wrong by a zero.
- cause: modules/scenarios/goal-seek/view.js:78 builds a bare number box with step 1000 and min 0, and :86 reads it with Number(); the shared ui.moneyBox (core/ui/dom.js:53) is not used.
- fix: Replace the box with ui.moneyBox({ min: 0, label: "Leave at least" }) and read it with ui.moneyValue(...) ?? 0. No step.
- evidence: $SP/ux/p-retirement-c-scenarios/verify/rc4-1p5m.png (script rc4.mjs)

## p-retirement-c-scenarios/RC-2 (severity 3, input, scope several-pages, owner claude-b, confirmed)
**A quote or pension with a name and no amounts is saved as $0**

- pages: retirement/annuities, retirement/pensions
- reach: Annuities and Pensions (both on screen). Income is fine.
- steps: H.family(), retirement/annuities, type only Quote = Test, tap Add quote. Then retirement/pensions, type only Pension = Test pension, tap Add pension.
- saw: Annuities: "Test added." and a card "$0 now for $0 a month from Ana's 65, for life". Pensions: "Test pension added.", headline "$0 Pensions a month, 1 pension, in the plan" and "by Ana's 85th birthday $0 buys what about $0 buys today". Income, for comparison, holds the form: "Amount: Please fill out this field."
- should: The form stays, with the message at the empty amount box, as Income does.
- why: A tap on Add before the amounts are in (or a skipped box) is confirmed in green and leaves a $0 line to find, open and fix.
- cause: modules/retirement/annuities/view.js:69-70 (You pay, It pays a month: not required) and :79 (empty becomes 0); modules/retirement/pensions/view.js:65 and :78.
- fix: required: true on those money fields (ui.form already passes it to the money box, core/ui/dom.js:104).
- evidence: $SP/ux/p-retirement-c-scenarios/verify/rc2-after.png, reach3-pension-nameonly.png (scripts rc2.mjs, reach2.mjs, reach3.mjs)

## p-career-household-system/F7 (severity 2, touch, scope ui-kit, owner shell (core/ui/dom.js) and claude-b (household/contacts), confirmed)
**Phone and Email boxes bring up the letter keyboard**

- pages: household/contacts
- reach: household/contacts add and edit
- steps: H.family(), household/contacts, Add someone; read the boxes' attributes.
- saw: Phone and Email are type=text with no inputmode, autocomplete or autocapitalize. They are the only phone or email boxes in the app (searched every view).
- should: Phone: number pad, autocomplete tel. Email: the @ keyboard, no capital first letter, autocomplete email.
- why: The attributes are measured; the keyboard that follows is certain on a phone. Narrowed to one page: the stock symbol is upper-cased on save (equity/view.js:141) and the PC and AI address boxes sit in the "Advanced: Not needed day to day" fold.
- cause: core/ui/dom.js:108: ui.form knows no tel or email type, so everything else is type=text; household/contacts/view.js:91-92 pass no type.
- fix: dom.js form(): add case "tel" (type tel, inputmode tel, autocomplete tel) and case "email" (type email, inputmode email, autocomplete email, autocapitalize off); contacts/view.js:91-92 set type: "tel" and type: "email".
- evidence: v8.mjs log of the form's attributes; $SP/ux/p-career-household-system/verify/f10-contacts-open.png

## p-cashflow-a/CF-7 (severity 2, input, scope ui-kit, owner shell, confirmed)
**Percent and number boxes answer a wrong value with the browser's own bubble ('Value must be less than or equal to 100.'), drawn over the help line**

- pages: cashflow/income, cashflow/budget-percent
- reach: every percent or number box built by ui.form (54 pages use them)
- steps: H.empty(), cashflow/income: What is it 'Pay', Amount '1.2k' (becomes 1,200), Yearly raise 150, tap 'Add income'. Also try -2 and 2.555.
- saw: Nothing is saved; the focus goes to the raise box and a browser bubble 'Value must be less than or equal to 100.' covers the help line 'type 3 for 3% a year'. -2: 'Value must be greater than or equal to 0.' 2.555: 'Please enter a valid value. The two nearest valid values are 2.55 and 2.56.' The money box in the same form uses the app's words ('Type an amount in numbers, like 4,500.', 'Use 0 or more.').
- should: The app's own sentence at the box: 'Type 100 or less.' / 'Type 0 or more.'; any number of decimals accepted.
- why: Two voices in one form, and 'the two nearest valid values are 2.55 and 2.56' is not something a layperson can act on. The form and the rest of what was typed are kept.
- cause: core/ui/dom.js:105-107: number and percent boxes are type=number with min, max and step 0.01 and no setCustomValidity (moneyBox at lines 53-61 has one).
- fix: dom.js form(): for 'number' and 'percent' use step 'any' unless the field gives one, and add an input listener like moneyBox's: c.setCustomValidity(c.value !== '' && fd.max !== undefined && Number(c.value) > Number(fd.max) ? `Type ${fd.max} or less.` : c.value !== '' && fd.min !== undefined && Number(c.value) < Number(fd.min) ? `Type ${fd.min} or more.` : ''). One change, every page. On a real iPhone: confirm the app's sentence shows in Safari's bubble.
- evidence: $SP/ux/p-cashflow-a/verify/cf7-raise150.png (script v7.mjs)

## p-investments/INV-10 (severity 2, touch-input, scope several-pages, owner claude-b pages, confirmed)
**Boxes take impossible values without a word**

- pages: investments/employer-stock, investments/crypto, investments/tax-lots, investments/allocation
- reach: 4 forms
- steps: Blank plan: Employer stock > symbol 'acme!!', price '$120.50' > Save. Crypto > 0.5 coins, 60000, paid 30000, bought 01/01/2099 > Add coin. held(): Tax lots > '+ Add a lot' > ACME (100 shares held) > 5000 shares, cost 100, bought 02/28/2031 > Add lot. Allocation > 'Your target mix' > US stocks 60, Bonds 60 > Save target.
- saw: 'ACME!! stock, yours and promised' with a green 'Saved.'; 'Jan 1, 2099: $30,000 paid ... long-term from Jan 2, 2100'; 'ACME · 5000 shares short +$589,900 ... bought 2/28/2031 ... long-term in 1937 days'; the 120% target is saved as 50 / 50 and at least says so ('the 120% you typed was scaled to 100%'), the boxes then read 50 and 50.
- should: At the box: 'A purchase date cannot be in the future.'; 'This fund has 100 shares; a lot cannot be bigger.'; 'A symbol is letters, like ACME.'
- why: The app took it, so it must be right; a slip in the year or a zero too many becomes a figure on the page.
- cause: No checks in the field lists: employer-stock/view.js:120, crypto/view.js:129 (date), tax-lots/view.js:44-49 and :56-58, allocation/view.js:82-89.
- fix: Let ui.form's date case (core/ui/dom.js:103) pass fd.max (today) with plain words (ties in with INV-3); a symbol pattern; in tax-lots return false with a message when shares exceed the holding's unassigned shares.
- evidence: $SP/ux/p-investments/verify/inv10-es-acme.png, $SP/ux/p-investments/verify/inv10-crypto-2099.png

## p-retirement-a/R-A10 (severity 2, input, scope several-pages, owner claude-b, confirmed)
**A slip of extra digits is saved without a question**

- pages: retirement/projection, retirement/contributions, retirement/social-security
- reach: These three; Pensions checks ages (40 to 80) but not amounts. The Income form already asks 'did you mean a year?' through the same form helper, so the pattern exists.
- steps: H.family(). Retirement settings: spending 99999999999, Save settings. Contributions: '+ Add another contribution', own money 99999999, Add. Social Security: 99999 in the benefit box, Save. Scripts: $SP/ux/p-retirement-a/verify/a10.mjs, a10b.mjs, a3.mjs.
- saw: All saved. Settings: fold status '$99,999,999,999 a month', heading 'Runs out in 2055', '$1,199,999,999,988 a year'. Contributions: row '$99,999,999 every month, $1,199,999,988 a year', hero '$1,200,018,858 a year ... That is 701765% of your pay', a red over-the-limit bar, toast 'Contribution added.' Social Security: '$99,999 a month at 67'.
- should: Above a believable ceiling the box says so before saving, for example on Social Security 'That is more than Social Security pays anyone. This box is the monthly amount.'
- why: The pages do show the result loudly (red bar, 'Runs out in 2055'), so the person can see something is off; what is missing is the question at the moment of saving. Rough, not blocking.
- cause: No upper bound on these fields: projection/view.js:265 (spendingMonthly has min 0 only), contributions/view.js:93 and :307, social-security/view.js:61; core/ui/dom.js moneyBox takes a max but none is passed.
- fix: Pass max to the three fields (Social Security monthly 10,000; retirement spending 100,000 a month; a contribution 100,000 each time) so the browser's own bubble refuses at the box, with a plain setCustomValidity sentence in core/ui/dom.js moneyBox when the value is over max.
- evidence: $SP/ux/p-retirement-a/verify/a10-spend-huge.png, $SP/ux/p-retirement-a/verify/a10b-contrib-huge.png

## p-taxes/T6 (severity 2, input, scope ui-kit, owner shell, confirmed)
**A money box says nothing about a mistyped amount until Save; then the browser's bubble covers the box's own help and the box's label is under the top bar**

- pages: taxes/federal, taxes/capital-gains, taxes/estimated, taxes/withholding, taxes/hsa-fsa, taxes/state
- reach: every money box (one component, ui.moneyBox) and every required box. On the iPhone's number pad letters cannot be typed, so it is reached by two decimal points ('1.2.3', '12..5'), a pasted figure, or a required box left empty.
- steps: family, taxes/federal, open 'Figures the plan cannot see', type 1.2.3 (or abc) in 'Wages this year', leave the box, scroll to 'Save figures' and tap it. Also H.blank(), taxes/capital-gains: tap 'Add sale' with nothing typed.
- saw: Leaving the box shows nothing (no red line, the help text is unchanged). On Save the page jumps 725 px up to the box, which lands at 68 px with the top bar ending at 56: the box is clear but its label 'Wages this year' is hidden under the bar, and the bubble 'Type an amount in numbers, like 4,500.' lies over the help text. Nothing is saved (good) and the rest of the form is kept (good). Empty sale: 'Please fill out this field.' (the browser's words), label hidden the same way. '1,200', '$1,200.50' and '1.2k' are understood (good).
- should: On leaving the box a short red line under it says what to type ('Type an amount in numbers, like 4,500.'); when Save sends the person back to a box, its label is visible.
- why: 'Which box is this, and what did I do wrong?' The answer comes one long scroll after the mistake.
- cause: core/ui/dom.js:51-63 moneyBox only calls setCustomValidity, which the browser shows on submit; core/ui/base.css:28 gives scroll-padding-top of the bar plus 12 px, enough for the box but not for the label above it.
- fix: core/ui/dom.js moneyBox blur handler: when `why` is set, show it in a <small class="help error"> after the box (cleared on input). core/ui/base.css: .field input, .field select, .field textarea { scroll-margin-top: 36px; } so the label shows.
- evidence: p-taxes/verify/t6-federal-abc.png, p-taxes/verify/t6-cg-empty.png; script p-taxes/verify/t6.mjs. Safari draws its own bubble and scrolls a little differently: look once on the phone.

## p-transactions-helpers/T7 (severity 2, input, scope page, owner claude-b, confirmed)
**Document reader: 'Read it' with nothing pasted does nothing (the 'pick the kind above' half is refuted)**

- pages: ai/reader
- reach: ai/reader (ai/notes already says 'Type or say a note first.').
- steps: H.family(), ai/reader, tap 'Read it' with the box empty. Then type 'hello nothing here' and tap 'Read it'.
- saw: Empty: nothingHappened is true (no notice, no focus, page unchanged). With text: a 'What it is' card with the Kind box appears at y=507 and the line 'Pick what kind of document it is above.' right under it at y=582, both on the first screen; 'above' is correct. With a pay stub the kind is detected ('Looks like: a pay stub') and three changes are offered. Back keeps the pasted text.
- should: Empty: 'Paste the document's text in the box first.' under the box, and the box takes the focus.
- why: Half confirmed. The filled button on a first-time screen answers a tap with nothing; the second claim was a misreading of where the message sits.
- cause: modules/ai/reader/view.js:60 ('Read it' re-renders with text = '') and :63 (returns silently when there is no text).
- fix: In the 'Read it' handler: if (!box.value.trim()) { status.replaceChildren(ui.notice('warn', 'Paste the document\'s text in the box first.')); box.focus(); return; }
- evidence: $SP/ux/p-transactions-helpers/verify/t7-reader-junk.png

