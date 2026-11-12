# SH-DRAFT: What was typed but not saved is not lost: on leaving and coming back, on a reload, on a save elsewhere on the same page; Back with a form open

21 verified findings (each reproduced on screen by an independent skeptic). Scripts and pictures for a finding `<walker>/<id>` are in `$SP/ux/<walker>/` and `$SP/ux/<walker>/verify/`.

## p-insurance-estate/x-1 (severity 5, back / input (lost typing), scope shell, owner shell, confirmed)
**Two forms on one screen: saving one silently wipes what you typed in the other, under a green 'Saved.'**

- pages: insurance/health, estate/legacy, career/equity, taxes/estimated
- reach: every page that shows two open forms at once (4 found by sweeping all 157 pages with the family household; more whenever a person opens a second fold with a form in it)
- steps: Household family (same with a first-open, empty plan). Open insurance/health. In 'Add a plan' type Plan name 'Silver PPO', premium 250, deductible 3,000. The help under Deductible says 'for the coverage you choose below', so go down to 'Your coverage and your bills', choose 'Me and family', tap its Save.
- saw: Green 'Saved.' (banner and bottom toast). The three boxes typed in 'Add a plan' are empty again (form values before: 'Silver PPO|250|3,000|20', after: '|||20'). No plan was added and nothing says so; the green 'Saved.' sits directly above the emptied form. Same on estate/legacy (typed 'Cy' and 50,000, ticked 'The home is part of what we leave', Save: both boxes empty, 'Saved.' above them), career/equity (typed grant name, tapped the other form's Save) and taxes/estimated (both directions: a typed quarter payment is wiped by 'Save' of last year's figures, and the reverse).
- should: Saving one form never touches what is typed in another. After the redraw the other form still holds its typing, and the confirmation names what was saved ('Coverage and bills saved.') beside the button that was tapped.
- why: The person believes the plan (or the bequest) was saved because the page said 'Saved.' right above the form; it was thrown away. On Health the page itself sends them to the second form mid-way through the first. This is lost data with a success message, the worst kind.
- cause: core/app.js:385-388 (store.subscribe -> show(current, { keepScroll: true })) and core/app.js:208 (root.innerHTML = ""): every store.update redraws the whole page from the plan, so any form that was not the one submitted is rebuilt empty. Nothing carries unsaved values across the redraw. The pages add to it: insurance/health/view.js:96-107 and estate/legacy/view.js:88-92 put a second form with its own filled Save under the add form.
- fix: One change in core/app.js show(): when keepScroll is true, before root.innerHTML = "" collect, for every form in #content other than the one whose submit just fired (remember it with one capture-phase 'submit' listener on #content), the controls whose value differs from defaultValue / defaultChecked / defaultSelected, keyed by form order + field name; after m.render() put those values back into the matching controls that are still at their default and fire 'input' so money boxes re-check. Then, on the two pages: Health moves 'Your coverage and your bills' above the add form while there are no plans; Legacy saves the home checkbox on change (no second Save).
- evidence: $SP/ux/p-insurance-estate/verify/x1-health-form-wiped-family.png ; $SP/ux/p-insurance-estate/verify/x1-legacy-form-wiped.png ; $SP/ux/p-insurance-estate/verify/x1.mjs ; $SP/ux/p-insurance-estate/verify/x1b.mjs ; $SP/ux/p-insurance-estate/verify/x1c.mjs

## p-taxes/T1 (severity 5, back, scope ui-kit, owner shell, confirmed)
**Figures typed but not yet saved vanish without a word: when you leave and come back, and also when you save or tap something else on the same page**

- pages: taxes/estimated, taxes/federal, taxes/withholding, taxes/hsa-fsa, taxes/capital-gains, taxes/documents, cashflow/income, goals/goals
- reach: every page built with ui.form (all eight I tried lost the figure); worst on pages with two Save buttons (taxes/federal has three forms, taxes/estimated two) and pages where a tick or a what-if chip redraws the page (taxes/documents, taxes/capital-gains)
- steps: (a) family, taxes/estimated: type 1000 in '1st quarter' (do not tap Save payments), go down to 'Last year's return', type 9000 in 'Last year's total tax', tap its Save. (b) family, taxes/federal: open 'Figures the plan cannot see' and 'Year and people'; type 98000 in 'Wages this year'; type 1 in the last box of Year and people and tap its Save. (c) family, taxes/withholding: type 640 in 'Ana: federal tax taken per paycheck', tap the menu button, tap 'Your plan', press the phone's Back. (d) family, taxes/capital-gains: type 'Index fund' and 12000 in the sale form, then tap the '+$25,000' chip higher up. (e) family, taxes/documents: open 'Add a document of your own', type a name, then tick any paper.
- saw: (a) green 'Last year's figures saved.' and the 1st quarter box is empty again; the plan holds paid [0,0,0,0] (2 runs of 2). (b) green 'Saved.', the Wages box is empty and its section is shut and reads 'none typed'. (c) Back shows Withholding check with the box empty, plan.taxes.withholding is {}, no 'not saved' word anywhere; the same on federal, estimated, hsa-fsa, cashflow/income and goals/goals (0 of 6 kept the figure). (d) the half-typed sale is wiped. (e) the typed name is wiped and the section shut.
- should: A figure that was typed survives any redraw of the page until it is saved or thrown away: it is back in its box, the section that holds it stays open, and a small 'Not saved yet' sits beside that form's Save button.
- why: The person sees a green 'saved' and believes everything they typed on that page was kept. The payments or wages are gone and the page's answer is worked out without them. Withholding's own help text sends them to another page in the middle of the form ('Type the amount withheld so far this year on the Federal estimate page').
- cause: core/app.js:208 empties #content on every show(), and core/app.js:387 redraws the whole page 50 ms after any store.update; each page then rebuilds its forms from the plan only (core/ui/dom.js:92 form(), values passed by the caller). What was typed lived only in the DOM that was thrown away. modules/taxes/capital-gains/view.js:15 (redraw) does the same on a chip tap.
- fix: One change in core/ui/dom.js form(): keep a draft per form in a module-level Map keyed by the page address (location.hash without its query) plus the field keys; write it on input/change; when the form is rebuilt and a draft exists, put the values back, open the closest <details>, and add <small class="help">Not saved yet</small> in .form-actions; delete the draft on submit and on Cancel. Fixes every ui.form page with no page changes and keeps AGENTS rule 4 (commit on save).
- evidence: p-taxes/verify/t1g-before.png, p-taxes/verify/t1g-after.png (estimated: boxes empty under 'Last year's figures saved.'), p-taxes/verify/t1-typed.png, p-taxes/verify/t1-back.png, p-taxes/verify/t1h-federal-after.png; scripts p-taxes/verify/t1.mjs, t1b.mjs, t1g.mjs, t1h.mjs

## j-debt-fixer/x-2 (severity 4, back, scope shell, owner shell, confirmed)
**The phone's Back while an edit form is open leaves the page and drops what was typed, with no question**

- pages: balance/liabilities, balance/net-worth, cashflow/income
- reach: Every list page whose rows open a form in place: Debts, Net worth, Income seen; Expenses, Goals, People are built the same way.
- steps: H.renterDebt(), overview/dashboard, tap the 'You owe' tile, tap 'Store card', type 19.9 in the rate box and 95 in the payment box, press the phone's Back. Then Forward.
- saw: Twice: the form fills the screen after a 1,267 px scroll (heading 'Store card: rate and payments'), the address is still #/balance/liabilities. Back lands on the Dashboard (scrollY 0 to 7); nothing is asked. Forward returns to Debts with the form closed, scrollY 629, Store card still 27.0% and $70. Same on Net worth (Edit, then Back: Dashboard) and Income (Edit, then Back: Dashboard).
- should: Back from an open form closes the form and returns to the row that was tapped; if boxes were changed, one question first: 'Leave without saving your changes to Store card?' with 'Keep editing' as the safe choice.
- why: A form that takes over the screen reads as a new screen, so Back is how a phone user closes it; it throws them out of the page and silently loses two typed figures.
- cause: modules/balance/liabilities/view.js:110 opens the form by setting a local `selected` and scrolling; no history entry is made (the page can already open a debt's form from the address, line 31, ctx.route.rest[0]). Net worth (view.js:110 edit()) and Income open their forms the same way. Nothing in core/router.js or core/app.js show() checks for a changed form before leaving.
- fix: One guard in the shell covers the lost typing on every page: in core/app.js show() (new address, not keepScroll), if #content holds a form with a changed box (value !== defaultValue), ask before leaving and restore the address on 'Keep editing'. Landing on the list needs each list page to open its form through the address (router.go(group, id, [rowId]) on row tap), which the Debts page already understands.
- evidence: $SP/ux/j-debt-fixer/verify/v22-form-typed.png, $SP/ux/j-debt-fixer/verify/v22-after-back.png

## j-fat-fingers/FF2 (severity 4, back, scope shell, owner shell, confirmed)
**What you typed in an open form is thrown away without a word when you tap another row, press the phone's Back, or leave by the menu**

- pages: cashflow/income, cashflow/expenses, goals/goals, balance/liabilities, household/people
- reach: every page with an add or edit form (the forms exist only on screen); worst on the long ones (Rental analysis 22 boxes, Home 11, Vehicles 10). Not Get started: it keeps what was typed.
- steps: H.family(), Dashboard, then Income. Tap 'Ana's salary', type 9999 in Amount, do not save. (1) Scroll up and tap the row 'Bo's salary'. (2) Or press the phone's Back, then Forward. (3) Or '+ Add another income', type 'Half typed' and 777, open the menu, tap Dashboard, press Back.
- saw: (1) The form silently becomes 'Edit Bo's salary' showing $5,200; no question, no notice; Ana's salary is still 3,900 (x8-income-other-row.png). Same on Expenses and Debts. (2) Back lands on the Dashboard; Forward returns to Income with the form closed and the 4100 gone (x9-a-form-open.png, x9-b-after-back.png). (3) Income comes back with the add form closed and empty (v2c-b-after-back.png); same on Goals, Expenses, People. Two parts of the walker's write-up did not hold: 'Back lands at scrollY 0' was its own script scrolling to the top before opening the menu (here Back restores the place: Home 1500 -> 1500, Expenses 900 -> 900; Income lands at 233 only because the page is shorter with the form closed); and Get started does keep a typed birth year across Back and Forward (1985 was still in the box).
- should: When an open form has typed changes and a tap or Back would replace it or leave the page, ask once: 'You have not saved what you typed in Edit Ana's salary. Leave it?' with Stay and Leave. Stay keeps the form exactly as it was. An untouched form closes silently as it does now.
- why: A stray thumb on a neighbouring row while scrolling is the likeliest way to hit this, and nothing tells the person their typing went nowhere: 'I changed Ana's pay, why does it still say 3,900?' Saved plan data is never lost, only unsaved typing, but on a 22-box form that is minutes of work.
- cause: core/app.js show() empties #content on every address change (line 208) with no check, and the row handlers swap the form unconditionally (modules/cashflow/income/view.js:155, modules/cashflow/expenses/view.js:337, same shape on goals/goals, balance/liabilities, household/people). No view keeps a draft.
- fix: One guard in the shell (core/app.js): mark a form dirty on the first input/change event inside '#content form' (cleared on submit and when the form leaves the page). A capture-phase click listener asks through ui.confirm when a dirty form is on screen and the tap is on a link, or on a row or button outside that form; on hashchange (the phone's Back) ask the same and, on Stay, put the address back without redrawing.
- evidence: $SP/ux/j-fat-fingers/verify/x8-income-other-row.png ; x9-a-form-open.png ; x9-b-after-back.png ; v2c-b-after-back.png (scripts v2c.mjs, v2d.mjs, x8.mjs, x9.mjs)

## j-first-family/F2 (severity 4, back, scope page, owner claude-b, confirmed)
**A reload (or a tab the phone dropped) empties every box typed on the current question, while Get started says 'Pick up where you left off'**

- pages: overview/setup/money, overview/setup/ages, overview/setup/have-amounts, overview/setup/owe-amounts, overview/setup/spend, overview/setup/goal-details
- reach: Every question screen with boxes; longest are question 4 amounts (7 boxes) and question 5 debts (10 boxes).
- steps: H.empty(): answer questions 1 to 3 as the family, tick Checking, Savings, A home, A car on question 4, Continue. On 'About how much is in each?' type Checking 5,200, Savings 12000, Dana's retirement 90000. Reload the page. Then open the app in a second tab of the same browser.
- saw: After the reload the same screen is back with all 7 boxes empty (gray guesses again); the plan still holds only the two empty plans at work. The second tab's Get started says 'Question 4 of 7 · Next: how much is in each · Pick up where you left off'. Same on question 2 (both pays and both 'works' taps gone) and on the debts screen (4 typed figures gone). What does keep them: the phone's Back and Forward (4 of 4 figures came back), the ‹ on screen, and Finish later (resume showed 5,200 and 12,000).
- should: What is typed on a question survives leaving the browser: coming back (or reloading) shows the boxes as they were.
- why: Reproduced on three question screens. This screen asks for balances, which sends a person to their bank's app; a phone that drops the browser tab meanwhile reloads it on return. How often a given phone does that needs a real phone, the loss after any reload is certain. Up to ten typed figures on the debts screen.
- cause: modules/overview/setup/view.js L39 `let drafts = {}` lives in memory only (draft() L300); the plan is written only by save() (L305) on Continue, ‹ Back or Finish later.
- fix: view.js render(): on `visibilitychange` to hidden and on `pagehide`, run the writer Finish later already uses, without leaving the screen (`if (current && wouldChange(plan, fn)) store.update(fn)`), and remove the listeners in the page's cleanup. Finish later proves it is lossless: typed boxes come back typed, empty ones gray. Nothing new on screen.
- evidence: verify/f2-after-reload.png (boxes back to gray guesses); box values before and after printed by f2.mjs, f2b.mjs

## j-monthly-return/x-typed-lost (severity 4, back, scope shell, owner shell (core/app.js), or claude-b pages one by one, confirmed)
**Balances, a note or an amount typed but not yet saved vanish without a word when you leave the page: by the menu, the 'Continue your plan' row, a step link, the phone's Back, or the tab reloading**

- pages: balance/update, overview/monthly-review (the note), balance/liquidity, balance/net-worth (edit an account)
- reach: every form that saves with a button; worst on Update my balances (10 boxes, 'Save once at the bottom', and you leave the app to look each balance up)
- steps: H.family(). #/balance/update: type 18,950 in Brokerage, 12,100 in Ally savings, 3,975 in Chase checking; do not save. (a) Tap 'Continue your plan: step 2 of 8' under the form, then the phone's Back. (b) Type again, phone Back, then Forward. (c) Type again, reload the tab (what a phone does when you return from the bank's app after a while). Also: check-in on October, type a note, tap the 'November 2026' chip and back, or open step 7 and tap '‹ Back to the October 2026 check-in'. Also #/balance/liquidity (type 5,400, Back, Forward) and Net worth > Edit House > type 395,000 > menu > Dashboard > Back. Scripts v16.mjs, v17.mjs, v20.mjs.
- saw: Every case: no warning on leaving, and on return the boxes show the saved figures again (18,000 | 11,500 | 4,200), the note is empty, the edit form is closed. The app does have a guard for exactly this ('You typed something on this page that is not saved yet…', modules/overview/guide/frame.js:228-236) but only on the Next buttons of a path step; the quiet row under the form, the check-in's back link, the menu and Back are not covered.
- should: What was typed is still in the boxes when you come back to the page in the same visit, with one line 'We kept what you typed. It is not saved yet.'; in-app links that leave a page with unsaved typing warn once, as the path's Next already does.
- why: Ana looks up seven balances in three bank apps, brushes the edge of the screen (Back) or taps the row under the Save button, and all seven are gone; she only finds out when the boxes show last month's figures. The check-in note sits under eight step links that each lead away, so a note typed first is lost by doing the steps.
- cause: core/app.js show() line 208 wipes the page on every address change and each view rebuilds its boxes from the plan (e.g. modules/balance/update/view.js boxes, modules/overview/monthly-review/view.js:70 `note` textarea rebuilt on every render, including the month chips' store.update(() => {}) at view.js:48). The unsaved-typing guard lives only in modules/overview/guide/frame.js:230 (guard) and is attached at :242, :257, :342 to path links.
- fix: Shell, one place: in core/app.js, before show() clears a page for a new address (and on pagehide), collect the typed controls inside [data-page] whose value differs from their defaultValue and stash them in sessionStorage under the page key (control name / aria-label / index); when that page is drawn again in the same tab, refill the boxes that still exist and show ui.notice('info', 'We kept what you typed here. It is not saved yet.'); clear the stash on store.update. Smaller, partial alternative: attach the frame's existing guard to the 'Continue your plan' row and the '‹ Back to …' links (frame.js contRow and :181/:192) and keep the check-in note in a module-level variable across renders.
- evidence: $SP/ux/j-monthly-return/verify/v17-typed.png ; $SP/ux/j-monthly-return/verify/v17-after-row-back.png ; $SP/ux/j-monthly-return/verify/v16-after-leave-back.png

## j-navigator/x-2 (severity 4, back, scope shell, owner shell, confirmed)
**Leaving a half-typed form drops it without a word: a tap on the status pill, a menu row, the phone's Back or a reload**

- pages: cashflow/income, balance/net-worth, goals/goals, cashflow/expenses, every page with an add or edit form
- reach: every form; four pages tried, all four lost the text
- steps: H.family(), Income, '+ Add another income', type 'Weekend tutoring' and 1200, then tap the pill at the top right ('Sandbox' here, 'Saved on this phone' on the owner's phone). Press the phone's Back.
- saw: The pill opened Settings (first screen: Plan name, Currency; nothing about where the plan is saved) with no question asked. Back: Income at scroll 233 (was 748), the add form folded away, both boxes empty, no notice. Same on Net worth '+ Add another account' (left by the phone's Back, returned by Forward: form closed, nothing kept), Goals '+ Add another goal' (left by Menu > Dashboard), Expenses '+ Add another expense' (form open again but empty), and Reload on Income (which is what an iPhone does to a tab left in the background).
- should: Either ask once ('You typed something on Income that is not saved yet. Leave without saving?') or keep what was typed and show it again on return. Never drop it silently.
- why: On a phone a stray tap or an edge swipe is common; the person switches to the bank app to read a figure, comes back, and the half-filled form is gone with nothing to say so.
- cause: core/app.js show() line 208 `root.innerHTML = ""` on every route change with no look at an open form; no draft is kept anywhere. The pill is a button that navigates: line 384 `router.go("system", "settings")`.
- fix: One place in the shell: at the start of show() for a new address, if #content holds a visible box whose value differs from its defaultValue, ask with ui.confirm (words above); on No, put the address back (history.go by the entry number N1 introduces) and skip the redraw. Better still, store the typed values with N1's per-entry record and put them back when the person returns and the same form is open. Leave the pill's words and size as the owner chose them (design log 2026-09-15, Shell pieces round 10).
- evidence: $SP/ux/j-navigator/verify/x2-form-typed.png, $SP/ux/j-navigator/verify/x2-form-after-back.png; scripts x2.mjs, w1.mjs

## p-balance/B1 (severity 4, back, scope shell, owner shell, confirmed)
**What you typed but did not save is thrown away without a word when you leave the page and come back**

- pages: balance/update, balance/net-worth, balance/accounts, balance/assets, balance/liabilities, cashflow/income, cashflow/expenses, household/people
- reach: every page with a form (8 of 8 tried, two ways of leaving: the Continue row and the menu)
- steps: H.family(), balance/update. Tap Chase checking and type 3,900; tap Ally savings and type 9,999. Do not save. Scroll to the bottom and tap 'Continue your plan: step 2 of 8' (the row right under Save all balances). Press the phone's Back.
- saw: It goes to #/cashflow/expenses with no question (0 dialogs, 0 notices). Back returns to Update my balances at the same scroll (957) but the two boxes read 11,500 and 4,200 again; nothing says the typing was dropped. Leaving by the menu does the same: Net worth, Edit Chase checking, type 777, Dashboard, Back: the form is closed and 777 is gone; Net worth '+ Add another account' with a name and a balance typed: gone and folded; Account detail: 'Balance that day 1,111' and a typed note both gone; Income, Expenses, People, Debts and Asset register the same.
- should: Leaving never drops typing silently. Coming back, the boxes hold what was typed, with one line 'What you typed earlier is still here. It is not saved yet.'; or, before leaving, 'You typed 2 balances that are not saved. Save them first?' with Save and Leave without saving.
- why: Reproduced on every page tried, in a fresh browser, with real taps. The Continue row sits directly under the Save button of the one page where ten boxes are typed in one go. Also worth one check on a real iPhone: type three balances, switch to a bank app for a minute, come back; if Safari reloads the tab the same loss happens.
- cause: core/app.js show(), line 208 (root.innerHTML = ""): every address change wipes the page and the page redraws from the saved plan. Forms keep typing only in the DOM (core/ui/dom.js form()), and nothing in core/app.js or core/router.js looks for changed boxes before leaving.
- fix: One change in core/app.js show(): before line 208 collect the boxes in #content whose value differs from what the page drew (input/textarea value !== defaultValue, select with a changed option), keyed by page + form position + field name or aria-label, and keep them in a per-page Map for the session. After m.render (line 236) put them back into the matching boxes that still show the saved value, fire 'input' so money boxes re-check, and show one ui.notice('info', ...) line at the top. Forget a form's kept values when that form is submitted. Forms the redraw folds away (Net worth Edit and Add: 'editing' and 'showForm' are locals at modules/balance/net-worth/view.js:33 and :54) need those two kept at module level so the form reopens. No design-log decision is touched.
- evidence: $SP/ux/p-balance/verify/b1-typed-bottom.png, $SP/ux/p-balance/verify/b1-after-back.png, $SP/ux/p-balance/verify/v-b1.mjs, $SP/ux/p-balance/verify/v-b1c.mjs, $SP/ux/p-balance/verify/v-b1d.mjs

## p-balance/x-1 (severity 4, focus, scope shell, owner shell, confirmed)
**Saving one thing on a page wipes what you were typing in another part of the same page**

- pages: balance/accounts, balance/net-worth
- reach: any page with two forms or a form and a save button (same redraw as B1)
- steps: H.family(), balance/accounts. Type a sentence in 'Notes on this account' and do not tap Save notes. Type 4,050 in 'Balance that day' and tap 'Add this balance'.
- saw: 'Saved $4,050.00 for 11/11/2026...' and the note box is empty: the sentence is gone, not saved, and nothing says so. The other way round (type a balance, tap Save notes) empties the balance box. Net worth: tap '+ Add another account', type a name and a balance, then tap 'Save today's totals': the add form folds shut and both are gone.
- should: A save changes only what it saved: boxes typed in elsewhere on the page keep their text, and an open form stays open.
- why: Missed by the walker (it tested leaving the page, not a second save on the page). Reproduced three ways.
- cause: Every store.update redraws the whole page: core/app.js:387 calls show(current, { keepScroll: true }) and line 208 empties it. Same root as B1.
- fix: The B1 change, made on the keepScroll path too: keep the changed boxes before line 208 and put them back after the render, leaving out the form that was just submitted (remember it from a capture-phase 'submit' listener). Net worth's add form also needs 'showForm' kept at module level.
- evidence: $SP/ux/p-balance/verify/x1-accounts-after.png, $SP/ux/p-balance/verify/x1-nw-after.png, $SP/ux/p-balance/verify/v-x1.mjs

## p-career-household-system/x-1 (severity 4, back, scope shell, owner shell (plus one line in claude-b's household/people), confirmed)
**A save in one section silently throws away what you typed in another section of the same page, and says "Saved."**

- pages: household/people, career/benefits, career/equity, career/offer-compare, likely every page with more than one Save (career/business, system/settings)
- reach: every page with two or more forms or a form plus a save-on-change control
- steps: H.family(). (a) household/people: tap Bo, type 59 in Retirement age, do not tap Save changes; scroll to Taxes and change "State you live in" to CA. (b) career/benefits: open Commuting, type 120 in Transit pass a month; open Life insurance through work, type 100,000, tap its Save. (c) career/equity: type 400 units and a name in the grant form, then type ACME and 50 under The company and tap its Save. (d) career/offer-compare: type Northwind and 120000 under An offer, open How it compares, set 3 years, Save.
- saw: (a) green "Saved." under Taxes, Bo's edit form is closed, the 59 is gone (stored retirement age still 62), and the screen jumped up 485 px. (b) "Saved.", the Commuting section is closed and reads "none"; only lifeCover 100000 was stored. (c) "Saved.", grant boxes empty, 0 grants stored. (d) "Saved.", offer boxes empty, 0 offers stored. Four pages out of four tried.
- should: Typing that was not saved survives a save elsewhere on the page: the other section stays open with its text, or the save covers every changed section. Never a green "Saved." while typed text is dropped.
- why: Reproduced on four pages in fresh browsers. The person fills two sections, taps the last Save, sees "Saved." and leaves; half of it was never stored. The walker tested only leaving the page (F2), not this.
- cause: core/app.js:208 show() empties #content (root.innerHTML = "") on every store.update and each page rebuilds its forms from the plan; nothing carries unsaved box values across the redraw. household/people/view.js:22 and :58 keep `editing` and `showForm` inside render(), so the edit form also closes (:157-158 the Taxes selects save on change).
- fix: One draft keeper in core/app.js show(): before :208 collect every named box under [data-page] whose value differs from its default (skip the form that was just submitted: mark it from a capture-phase submit listener), after the page is drawn (:246) put the values back into the form with the same field names, re-open its <details>, fire `input`. In household/people/view.js lift `editing`/`showForm` to module level (as household/contacts does) so the form can re-open. Keeps the design-log rule that saves confirm with a green notice and keep your place.
- evidence: $SP/ux/p-career-household-system/verify/f2b-before.png, $SP/ux/p-career-household-system/verify/f2b-after.png, $SP/ux/p-career-household-system/verify/f2c-before.png, $SP/ux/p-career-household-system/verify/f2c-after.png, $SP/ux/p-career-household-system/verify/x1-equity-after.png (v2b.mjs, v9.mjs)

## p-cashflow-b-goals/x-3 (severity 4, back, scope ui-kit, owner shell, confirmed)
**A half-typed form is thrown away without a word when you look at another page**

- pages: goals/goals, goals/travel
- reach: every page with a ui.form add or edit form (two checked)
- steps: Family household, from the Dashboard. goals/goals: tap '+ Add another goal', type 'New roof', 18,000, 300 a month. Open the menu and tap Expenses (say, to check a figure). Press Back. Same on goals/travel with 'Beach week', 450, 180.
- saw: No question before leaving. Back returns to Goals with the add form closed and nothing typed, at scroll 442 where the person had left at 1390. On Travel the form is open but back to its defaults (2 people, 7 nights).
- should: Coming back to a page restores what was typed in its open form (and reopens a folded add form that holds text) until it is saved or cancelled.
- why: Looking up a number on another page in the middle of a form is the normal way to fill in a money app. Here it costs everything typed so far, and the person finds out only on return.
- cause: core/ui/dom.js form() (line 92) keeps typed values only in the DOM; core/app.js show() (line 208) clears the page on every address change; views hold 'adding' and 'editing' in memory that the redraw resets.
- fix: ui.form: on input, keep the values in a module-level Map keyed by page address + submit label; fill from it when the form is drawn; delete on submit and cancel. Views that fold their add form open it when a draft exists (ui.hasDraft()). No dialog on leaving.
- evidence: $SP/ux/p-cashflow-b-goals/verify/x-addform-open.png, $SP/ux/p-cashflow-b-goals/verify/x-halftyped-goals_goals-after-back.png

## p-debt-property/x-3 (severity 4, back, scope shell, owner shell (core/app.js), confirmed)
**A half-typed form is wiped without a word when you leave the page, and the row that leaves sits 32 px under the Add button**

- pages: property/rental, property/vehicles, debt/refinance, balance/net-worth, cashflow/income
- reach: Every page with a form (all five tried lost it). Worst on Rental, whose add form has 20 boxes.
- steps: H.empty(), property/rental. Type Name 'Flat on Elm', worth 250,000, paid 210,000, rent 1,800, property tax 3,100, insurance 1,200. Scroll to 'Add rental'. Tap the 'Start your plan: a few easy questions ›' row just under it (a near miss). Then the phone's Back.
- saw: 'Add rental' is at y=662-706 and the row at y=738-782, a 32 px gap. The tap opens Get started with no question asked. Back returns to Rental at scroll 0 with every box empty (name, value, purchasePrice, rentMonthly all blank). Same on Vehicles, Net worth, Income and Refinance when leaving by any link and coming Back. Two runs.
- should: Coming back to a page puts back what was typed and says 'We kept what you were typing.'
- why: A minute of typing figures from papers is gone and nothing says so; the person finds an empty form and starts again or gives up.
- cause: core/app.js show() empties the page on every address change (line 208 `root.innerHTML = ''`) and nothing remembers unsaved boxes; Back draws a fresh form at the top (line 218).
- fix: In core/app.js show(), before clearing for a different address: collect the named controls of any form whose value differs from its defaultValue into an in-memory Map keyed by the route (never in the plan or in storage). After m.render for a route that has an entry: refill the matching controls, fire 'input', show an info notice above that form and scroll to it. Drop the entry on the next store.update. One change for every ui.form page.
- evidence: $SP/ux/p-debt-property/verify/v12_rental_typed.png, $SP/ux/p-debt-property/verify/v12_rental_after_back.png

## p-insurance-estate/IE-9 (severity 4, back, scope shell, owner shell, confirmed)
**A half-typed form is thrown away, without a word, when you leave the page and come Back**

- pages: insurance/policies, insurance/health, estate/digital, cashflow/income, goals/goals
- reach: every page with a form (the shell rebuilds the page on every visit); the 12-box policy form and the 10-box goal form hurt most
- steps: Household family. Open insurance/policies. In the add form type 'Ana's 20-year term', What it pays 500,000, Premium 45. Without tapping Add, tap any link (for example 'Continue your plan' at the end of the page, or the menu, then Dashboard). Press the phone's Back.
- saw: Back lands on Policies with every box empty again; nothing asked before leaving and nothing says the typing was dropped. Same on cashflow/income and goals/goals (the add form is also folded shut again), estate/digital and insurance/health. An edit in progress on a row behaves the same (the row is closed, the old name is back). Removing a row is a different matter and is fine as it is: it asks 'Remove Term 20?' first and confirms 'Term 20 removed.'.
- should: What I typed is still in the boxes when I come back to the page in the same visit (Back, or opening the page again), with a quiet line 'We kept what you had typed. Clear'. Nothing is saved to the plan until I tap Add.
- why: People leave a form half-way to look a figure up on another page (the death benefit, a balance) and come straight back. They find an empty form and type it all again, or think the app lost their policy. The walker's steps reproduce; its 'no safety net on remove' part does not hold (there is a confirmation), so this finding is narrowed to the lost typing and its severity raised.
- cause: core/app.js:208: show() empties #content on every route change and the page is rebuilt from the plan; core/app.js:201 runs the page's cleanup. No draft of unsaved form values is kept, and each view's module-level 'editing' / open-form state starts over.
- fix: Same mechanism as x-1, in core/app.js: on leaving a route collect the changed controls of its forms into an in-memory Map keyed by 'group/id' (never the plan, never storage); when that route is shown again in the same session, after render put them back into the matching form (open the page's '+ Add another ...' button first when the form is folded) and add one muted line with a 'Clear' button. No dialogs, no new global CSS.
- evidence: $SP/ux/p-insurance-estate/verify/v9-policies-after-back-typed-gone.png ; $SP/ux/p-insurance-estate/verify/v9.mjs ; $SP/ux/p-insurance-estate/verify/v9b.mjs

## p-retirement-a/x-2 (severity 4, back, scope shell, owner shell, confirmed)
**What I typed is dropped without a word when I leave a half-filled form, and Back does not bring it back**

- pages: retirement/pensions, retirement/social-security, retirement/contributions, cashflow/income, goals/goals, balance/net-worth
- reach: Every page with a form (one shell cause); 6 of 6 pages tried.
- steps: H.ruth(), retirement/pensions: type 'County retirement plan' and 1,850, tap 'How long to plan for' under More on this, press Back. H.family(), retirement/social-security: paste a line in the earnings box, tap 'Continue your plan', Back. H.family(), retirement/contributions: '+ Add another contribution', type 250 and 1,500, open the menu, tap Dashboard, Back. Scripts: $SP/ux/p-retirement-a/verify/x1.mjs a, x5.mjs.
- saw: No question on leaving in any case. After Back: Pensions shows both boxes empty; Social Security's earnings box is empty; on contributions (and Income, Goals, Net worth) the add form is closed again and the typed figures are gone.
- should: Either ask before leaving ('You typed something here that is not saved yet. Leave anyway?') or keep what was typed and show it again on return.
- why: A pension form has nine boxes and the earnings record can be 35 pasted lines. The links that take you away sit right under the form ('Will the money last?', 'Continue your plan'), and 'Continue' reads like 'save and go on'. The walker's brief asked 'is anything lost silently when I leave a half-typed form?' and this was not tried.
- cause: core/app.js show() line 208 clears #content for every address and line 240 renders the page from the saved plan only; nothing looks at boxes that were changed and not saved, and whether an add form is open is a variable inside each page's render that starts closed again.
- fix: Smallest, in core/app.js: on a hash change away from the current page, if any input, select or textarea inside #content differs from its defaultValue (or defaultSelected / defaultChecked), ask with ui.confirm('You typed something on this page that is not saved yet. Leave anyway?'); on No, go back to the previous hash and skip the redraw. A fuller version keeps the typed values per page in sessionStorage and puts them back after the page is drawn. Either is one shell change.
- evidence: $SP/ux/p-retirement-a/verify/x1-back-pensions.png

## p-retirement-c-scenarios/x-half-typed-form-lost (severity 4, back, scope ui-kit, owner shell, confirmed)
**A half-filled form is emptied without a word when you follow the page's own link and come back**

- pages: scenarios/advisor-plan, scenarios/compare, retirement/annuities
- reach: Every page with a ui.form (three checked on screen).
- steps: H.family(), scenarios/advisor-plan. Type Advisor or firm, Spend in retirement 9,000, Stock return 9, Their fee 1.2. Tap "Your assumptions" (the button just under the form, the natural way to look up your own figures). Press the phone's Back.
- saw: All four boxes are empty and the page is at the top. Same on Compare what-ifs (Make your own: name and spending typed, tap "Goal seek", Back: the form is folded away and empty) and Annuities (three boxes typed, tap "Pensions", Back: empty). No warning on leaving, no note on return.
- should: What was typed is still in the boxes on return (and after the form is reopened), until it is saved or cancelled.
- why: The advisor form has 16 boxes copied from a paper report, and the link that empties it sits right under it. The person retypes everything or gives up.
- cause: The shell clears the page on every address change (core/app.js:208) and ui.form (core/ui/dom.js:92-129) builds its boxes only from saved values; nothing keeps a draft.
- fix: One change in the UI kit: ui.form keeps each box's typed value in memory under the page address and the field key while it differs from the saved value, fills from that draft when the form is built again, and drops it on submit, Cancel or reset. Covers every form built with ui.form.
- evidence: $SP/ux/p-retirement-c-scenarios/verify/x4-advisor-after-back.png (script x4.mjs)

## j-fat-fingers/x-2 (severity 3, back, scope shell, owner shell, confirmed)
**The phone's Back does not close what you just opened (the menu, an edit form): it leaves the page**

- pages: cashflow/income, cashflow/expenses, balance/liabilities
- reach: the menu on every page; every page with an add or edit form
- steps: H.family(), Dashboard, then Income. (1) Tap the menu button (top left), then press the phone's Back. (2) Tap 'Ana's salary' so its form opens, press the phone's Back.
- saw: (1) The menu closes and the person is on the Dashboard, not on Income (x8-back-with-menu-open.png). (2) Dashboard again; Forward shows Income with the form closed (x9-a-form-open.png, x9-b-after-back.png). Same from an open form on Expenses and Debts.
- should: Back closes the open menu and stays on the page. With an open form that has typed changes, Back asks first (FF2).
- why: Someone who opens the wrong row or the menu by mistake and presses Back to get out is thrown one page further than they meant, and has to find their way back. Rated 3: the menu also closes by tapping beside it or the cross, and forms have Cancel.
- cause: core/app.js toggleDrawer()/closeDrawer() (lines 151-157) open and close the menu without a history entry; views open forms the same way (e.g. modules/cashflow/income/view.js:155).
- fix: Shell, menu only: on open, history.pushState({ menu: true }, '') and on popstate with the menu open just close it (the hash did not change, so no redraw); closing by the cross or the scrim calls history.back() when the top entry is the menu's. Forms are covered by FF2's question; no per-page change.
- evidence: $SP/ux/j-fat-fingers/verify/x8-back-with-menu-open.png ; x9-a-form-open.png ; x9-b-after-back.png (scripts x8.mjs, x9.mjs)

## p-career-household-system/F2 (severity 3, back, scope shell, owner shell, confirmed)
**A half-typed form is empty when you come back to the page**

- pages: household/contacts, household/people, household/calendar, household/documents, every add or edit form (same mechanism)
- reach: every form
- steps: H.family(), household/contacts, tap Add someone, type Name "Dr Lee" and Phone "555-0100". Open the menu, tap Dashboard, then the phone's Back. Same on people (+ Add another person, Name), calendar (reminder name), documents (Write where it is).
- saw: Contacts: back on the page the Add form is still open but Name and Phone are empty, no notice. People: the form is closed and the name gone. Calendar and Documents: the typed text is gone. Nothing warned on leaving.
- should: What was typed in an unsent form is still there on return for the rest of the session (a muted line "We kept what you had typed"), or the form is closed; never an open, empty form.
- why: Reproduced on four pages by leaving through the menu, as a thumb would. On an iPhone the edge swipe is Back, so leaving by accident is common. Same root as x-1; one shell change covers both.
- cause: core/app.js:208 show() rebuilds the page from the plan on every route; box values live only in the DOM. household/contacts/view.js:8 keeps `adding` at module level, which is why the empty form re-opens.
- fix: The draft keeper of x-1, with drafts kept per route in memory for the session and re-applied when that route is shown again.
- evidence: $SP/ux/p-career-household-system/verify/f2-typed.png, $SP/ux/p-career-household-system/verify/f2-back.png (v2.mjs)

## p-cashflow-a/CF-2 (severity 3, back, scope shell, owner shell, confirmed)
**A half-typed add or edit form is emptied without a word when you leave the page and come back**

- pages: cashflow/income, cashflow/expenses, cashflow/budget
- reach: every page whose form is built with ui.form (add and edit forms alike)
- steps: H.empty(), cashflow/income: type 'Half typed' in What is it and 900 in Amount; go to Expenses; press the phone's Back. Edit form: H.family(), Income, tap 'Bo's salary', change Amount to 9999, go to Expenses, press Back.
- saw: Back returns to Income with both boxes empty (name '', amount ''), no notice, no question before leaving (no dialog). Same on Expenses (name and amount empty) and Budget (amount empty). The edit form is closed after Back and the 9999 is gone. What does work: switching apps or locking the phone does not wipe the form (the shell does not redraw while a box has the focus).
- should: Coming back to the page finds the boxes as they were left, with one quiet line 'We kept what you were typing.' and a way to clear it.
- why: A person half-way through a nine-box income form who taps a link to check something loses it all and is not told. They type it again or, worse, think it was saved.
- cause: core/app.js show() empties #content for every address (root.innerHTML = '', about line 209) and core/ui/dom.js form() (line 92) keeps what was typed only in the DOM; nothing remembers it.
- fix: Shell: in show(), before clearing #content for another address, collect for each form whose text boxes differ from their defaultValue { address, heading of the form, field name -> value } into an in-memory Map (this session only, never the plan). After that address is drawn again, if a form with the same field names is on the page (an add form folded behind '+ Add another ...' is opened), put the values back and prepend ui.notice('info', 'We kept what you were typing.') with a small 'Clear' button. One change in core/ covers every ui.form page.
- evidence: $SP/ux/p-cashflow-a/verify/cf2-typed.png, $SP/ux/p-cashflow-a/verify/cf2-after-back.png (script v2.mjs)

## p-cashflow-a/CF-3 (severity 3, back, scope several-pages, owner shell (one helper) + claude-b (the list pages), confirmed)
**With an edit form open, the phone's Back leaves the page and drops the change: the form fills the screen like a new screen but is not a step back**

- pages: cashflow/income, cashflow/expenses, cashflow/budget, goals/goals, balance/liabilities, household/people
- reach: every list page whose rows open an edit form under the list
- steps: H.family(), open the Dashboard, go to Income, tap 'Bo's salary', change Amount to 7777, press the phone's Back; then Forward.
- saw: Tapping the row grows the page 918 px and scrolls 0 -> 827: the list is off screen (the row at -212), 'Edit Bo's salary' is the heading at the top (y 68). Back goes to #/overview/dashboard; Forward returns to Income with no edit form and 7,777 nowhere. Same on Expenses ('Mortgage payment', scroll 1,647) and Budget ('Rent or mortgage', scroll 949). Goals, Debts and People open their edit form the same way (scroll 1,036, 914, 534).
- should: Back closes the edit form first and shows the list with the row where it was (what Cancel does); a second Back leaves the page.
- why: Narrowed. Where the form opens is the owner's logged choice (2026-09-15, Debts round 14: 'the form opens inside the list card'; Net worth round 4: 'Edit opens it filled in; Cancel folds it') and must stay; the heading names the item, and Cancel brings the row back on screen (row at y 467), so that half is not a problem, and Save 862 px down is only the length of a nine-box form. What is left is real: a screen that looks like its own page is left by Back as if it were not there, and the typed change is lost silently.
- cause: The open edit is a local variable of render (`editing`): modules/cashflow/income/view.js:155, expenses/view.js:337, budget/view.js:92, goals/goals/view.js:40, household/people/view.js:140. Opening it adds no history entry and core/router.js listens to hashchange only.
- fix: One helper in the UI kit, for example ui.backCloses(close): history.pushState({ sheet: 1 }, '') when an edit form opens, and one popstate listener (the hash does not change, so the router stays quiet) that calls close(), the page's own Cancel; Save and Cancel call history.back() to use the entry up. Each list page adopts it with one line in its row onClick. The form stays inside the list card.
- evidence: $SP/ux/p-cashflow-a/verify/cf3-cashflow-income-edit-open.png, $SP/ux/p-cashflow-a/verify/cf3-cashflow-income-after-back.png, $SP/ux/p-cashflow-a/verify/cf3-income-after-cancel.png (scripts v3.mjs, v3b.mjs)

## p-investments/INV-4 (severity 3, back, scope shell, owner shell, confirmed)
**A half-typed form is thrown away without a word when you leave the page and come back**

- pages: investments/allocation, investments/holdings, investments/employer-stock, investments/crypto, investments/tax-lots, cashflow/income, goals/goals, household/people
- reach: every add or edit form in the app
- steps: held(): Allocation > open 'Your target mix' > type 55 in US stocks > menu > Investments > Holdings > the phone's Back. Holdings > '+ Add a holding' > VXUS, 10, 620 > menu > Fees > Back. Family: Income > '+ Add' > type 'Bonus' > go to the Dashboard > Back (same on Goals and People).
- saw: Back returns to the right page every time, but: Allocation's fold is closed and US stocks reads 50; the Holdings form is closed and empty; Income, Goals and People forms are closed and empty. No question was asked on leaving. (The scroll position itself does come back: measured on 12 investments pages, twice each, with real taps.)
- should: What was typed is still there on return, with its section open; or, at the least, 'You have not saved what you typed. Leave anyway?'
- why: People leave a form to look up a figure on another page. Coming back to an empty, closed form, they retype or stop trusting long forms.
- cause: core/app.js show() lines 196-218 clears #content and redraws from the plan on every address change, Back included; views hold open/closed state in render-local variables (holdings/view.js:48 showForm; allocation targetFold's open attribute) and ui.form (core/ui/dom.js:92) builds from plan values only. Nothing keeps a draft.
- fix: In ui.form: remember typed values in a session-long map keyed by page + submit label, refill on the next build, clear on submit or Cancel; in show(): remember which folds were open per page and reopen them; pages that fold their add form open it when a draft exists. One kit change plus one shell change covers every form.
- evidence: $SP/ux/p-investments/verify/inv4-alloc-typed.png, $SP/ux/p-investments/verify/inv4-alloc-after-back.png

## j-first-renter/x-4 (severity 2, back, scope page, owner claude-b, confirmed)
**A reload in the middle of a question empties everything typed on it**

- pages: overview/setup
- reach: Every question screen; it costs most on the amounts screens (several balances, rates and payments). Answers already saved with Continue are kept. Back, the in-screen back buttons and a trip through the menu all keep the typing (checked).
- steps: H.empty(); Let's go; Sam; Continue; tap I work; type 3200; tap A month; reload the page (do not tap Continue).
- saw: After the reload question 2 is blank: "I work" is not selected, the pay box is gone, nothing says anything was lost. Before the reload the same typing survived phone Back, "‹ Back", the top arrow and menu > Dashboard > back.
- should: What was typed on the current question comes back after a reload, the same way it does after Back.
- why: People leave this screen to look up a balance in their banking app; if the phone has dropped the page when they come back, the boxes they filled are empty.
- cause: modules/overview/setup/view.js:39 `let drafts = {}` lives only in the page's memory (:300 draft()).
- fix: Keep the drafts in sessionStorage as well (write in draft() and on input, read at :300, clear in save()); same key rule (screen plus plan stamp). On a real phone check how often it happens: open a question, type, switch to another app for a few minutes, come back.
- evidence: $SP/ux/j-first-renter/verify/x1-reload-q2.png (script x1.mjs)

